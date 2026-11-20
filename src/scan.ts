import { chromium, type Browser, type BrowserContext } from 'playwright'
import { legalLinks } from './checks.ts'

export type Request = { url: string; host: string; type: string }
export type Cookie = { name: string; domain: string; expires: number }
export type StorageEntry = { area: 'localStorage' | 'sessionStorage'; key: string }
export type Link = { text: string; href: string }
export type Form = { action: string; method: string }
/** Where a URL ended up when opened on its own: status and final URL, or why it could not be opened. */
export type Visit = { url: string; status: number; finalUrl: string } | { url: string; error: string }

export type Scan = {
  url: string
  finalUrl: string
  /** false when the page still had requests running when we stopped waiting */
  settled: boolean
  requests: Request[]
  cookies: Cookie[]
  storage: StorageEntry[]
  /** response headers of the page itself, names in lower case */
  headers: Record<string, string>
  /** the page's TLS certificate; missing for http pages (and for pages the tests serve themselves) */
  certificate?: { validTo: number; issuer: string }
  /** the server asked for the page over http://, to see whether it sends visitors on to https; missing when the page is http */
  http?: Visit
  links: Link[]
  /** the links that look like Impressum or Datenschutz, each opened on its own */
  legal: Visit[]
  forms: Form[]
}

export type ScanOptions = {
  /** how long to wait for the network to go quiet after load, in ms */
  settleMs?: number
  /** hook for tests: route requests before a page is opened */
  setup?: (context: BrowserContext) => Promise<void>
  /** hook for tests: the fetch used to ask the server about http:// */
  fetch?: typeof fetch
}

/**
 * Asks the server directly, not the browser: Chromium upgrades http:// to https:// on its own,
 * which would make a server without redirect look as if it had one.
 */
async function probeHttp(url: string, f: typeof fetch): Promise<Visit> {
  try {
    const r = await f(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) })
    await r.body?.cancel()
    return { url, status: r.status, finalUrl: r.url || url }
  } catch (e) {
    const cause = e instanceof Error && e.cause instanceof Error ? `: ${e.cause.message}` : ''
    return { url, error: e instanceof Error ? e.message + cause : String(e) }
  }
}

/** Opens the URL in a fresh browser, as a first-time visitor who clicks nothing, and records what happens. */
export async function scan(url: string, options: ScanOptions = {}): Promise<Scan> {
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ locale: 'de-DE' })
    await options.setup?.(context)

    const requests: Request[] = []
    context.on('request', r => {
      const u = new URL(r.url())
      if (u.protocol === 'http:' || u.protocol === 'https:') requests.push({ url: r.url(), host: u.hostname, type: r.resourceType() })
    })

    const page = await context.newPage()
    const response = await page.goto(url, { waitUntil: 'load' })
    if (!response) throw new Error('keine Antwort erhalten')
    const settled = await page
      .waitForLoadState('networkidle', { timeout: options.settleMs ?? 10_000 })
      .then(() => true, () => false)

    const cookies = (await context.cookies()).map(c => ({ name: c.name, domain: c.domain.replace(/^\./, ''), expires: c.expires }))
    const { storage, links, forms } = await page.evaluate(() => {
      const storage: { area: 'localStorage' | 'sessionStorage'; key: string }[] = []
      for (const area of ['localStorage', 'sessionStorage'] as const) {
        const s = window[area]
        for (let i = 0; i < s.length; i++) storage.push({ area, key: s.key(i) ?? '' })
      }
      const links = [...document.querySelectorAll('a[href]')].map(a => ({
        text: (a.textContent ?? '').trim().replace(/\s+/g, ' '),
        href: (a as HTMLAnchorElement).href,
      }))
      const forms = [...document.forms].map(f => ({ action: f.action, method: (f.getAttribute('method') ?? 'get').toLowerCase() }))
      return { storage, links, forms }
    })

    const headers = await response.allHeaders()
    const tls = await response.securityDetails()
    const finalUrl = page.url()
    const visitor = await documentsOnly(browser, options)

    const result: Scan = {
      url,
      finalUrl,
      settled,
      requests,
      cookies,
      storage,
      headers,
      links,
      legal: [],
      forms,
    }
    if (tls?.validTo) result.certificate = { validTo: tls.validTo, issuer: tls.issuer ?? '' }
    if (finalUrl.startsWith('https:')) result.http = await probeHttp(finalUrl.replace(/^https:/, 'http:'), options.fetch ?? fetch)
    for (const l of legalLinks(links)) result.legal.push(await visitor(l.href))
    return result
  } finally {
    await browser.close()
  }
}

/** A second, separate browser for opening single URLs: only the documents load, nothing of it counts towards the scan. */
async function documentsOnly(browser: Browser, options: ScanOptions) {
  const context = await browser.newContext()
  await context.route('**/*', route => (route.request().resourceType() === 'document' ? route.continue() : route.abort()))
  // registered after the filter, so the tests' routes take precedence over it
  await options.setup?.(context)
  return async (url: string): Promise<Visit> => {
    const page = await context.newPage()
    try {
      const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      return r ? { url, status: r.status(), finalUrl: page.url() } : { url, error: 'keine Antwort' }
    } catch (e) {
      return { url, error: e instanceof Error ? (e.message.split('\n')[0] ?? e.message) : String(e) }
    } finally {
      await page.close()
    }
  }
}
