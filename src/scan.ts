import { readFileSync } from 'node:fs'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { legalLinks } from './checks.ts'

// src/ and dist/ both sit next to package.json
export const VERSION: string = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const HOME = 'https://github.com/mmohrx/spurlos'

/** Open about itself, for the requests where a bot check changes nothing: the legal pages and the http probe. */
export const BOT_AGENT = `spurlos/${VERSION} (+${HOME})`

const PLATFORM: Record<string, string> = {
  darwin: 'Macintosh; Intel Mac OS X 10_15_7',
  win32: 'Windows NT 10.0; Win64; x64',
}

/**
 * For the page itself: a regular Chrome, with spurlos added but no URL. Many cookie banners and trackers stay away
 * from what they take for a bot – HeadlessChrome or a URL in the user agent – and the scan would miss what real
 * visitors get. The page still sees spurlos in its logs.
 */
const CH_PLATFORM: Record<string, string> = { darwin: 'macOS', win32: 'Windows' }

/**
 * Chromium still names itself HeadlessChrome in its client hints (sec-ch-ua, navigator.userAgentData), whatever the
 * user agent says; this sets them to plain Chromium, to match. navigator.webdriver stays true on purpose: spurlos
 * does not pretend to be a person.
 */
async function plainBrands(context: BrowserContext, page: Page, userAgent: string, chromeVersion: string) {
  const major = chromeVersion.split('.')[0] ?? ''
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent,
    acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8',
    userAgentMetadata: {
      brands: [
        { brand: 'Chromium', version: major },
        { brand: 'Not/A)Brand', version: '8' },
      ],
      fullVersion: chromeVersion,
      platform: CH_PLATFORM[process.platform] ?? 'Linux',
      platformVersion: '',
      architecture: '',
      model: '',
      mobile: false,
    },
  })
}

export function browserAgent(chromeVersion: string, platform = process.platform): string {
  const major = chromeVersion.split('.')[0]
  return `Mozilla/5.0 (${PLATFORM[platform] ?? 'X11; Linux x86_64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36 spurlos/${VERSION}`
}

export type Request = { url: string; host: string; type: string }
export type Cookie = { name: string; domain: string; expires: number; secure: boolean; httpOnly: boolean }
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
  /** a Content-Security-Policy set in a <meta http-equiv> tag, the only way to one on hosts without own headers */
  metaCsp?: string
  /** a referrer policy set in <meta name="referrer"> */
  metaReferrer?: string
  /** what <meta name="generator"> says, often the CMS and its version */
  generator?: string
  /** the user agent the page was opened with */
  userAgent: string
}

export type ScanOptions = {
  /** how long to wait for the network to go quiet after load, in ms */
  settleMs?: number
  /** hook for tests: route requests before a page is opened */
  setup?: (context: BrowserContext) => Promise<void>
  /** hook for tests: the fetch used to ask the server about http:// */
  fetch?: typeof fetch
  /** replaces the user agent of every request spurlos makes */
  userAgent?: string
}

/**
 * Asks the server directly, not the browser: Chromium upgrades http:// to https:// on its own,
 * which would make a server without redirect look as if it had one.
 */
async function probeHttp(url: string, f: typeof fetch, userAgent: string): Promise<Visit> {
  try {
    const r = await f(url, { redirect: 'follow', headers: { 'user-agent': userAgent }, signal: AbortSignal.timeout(15_000) })
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
    const userAgent = options.userAgent ?? browserAgent(browser.version())
    const context = await browser.newContext({ locale: 'de-DE', userAgent })
    await options.setup?.(context)

    const requests: Request[] = []
    context.on('request', r => {
      const u = new URL(r.url())
      if (u.protocol === 'http:' || u.protocol === 'https:') requests.push({ url: r.url(), host: u.hostname, type: r.resourceType() })
    })

    const page = await context.newPage()
    if (!options.userAgent) await plainBrands(context, page, userAgent, browser.version())
    const response = await page.goto(url, { waitUntil: 'load' })
    if (!response) throw new Error('keine Antwort erhalten')
    const settled = await page
      .waitForLoadState('networkidle', { timeout: options.settleMs ?? 10_000 })
      .then(() => true, () => false)

    const cookies = (await context.cookies()).map(c => ({
      name: c.name,
      domain: c.domain.replace(/^\./, ''),
      expires: c.expires,
      secure: c.secure,
      httpOnly: c.httpOnly,
    }))
    const { storage, links, forms, metaCsp, metaReferrer, generator } = await page.evaluate(() => {
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
      const meta = [...document.querySelectorAll('meta[http-equiv]')].find(m => m.getAttribute('http-equiv')?.toLowerCase() === 'content-security-policy')
      const referrer = document.querySelector('meta[name="referrer" i]')?.getAttribute('content') ?? null
      const generator = document.querySelector('meta[name="generator" i]')?.getAttribute('content') ?? null
      return { storage, links, forms, metaCsp: meta?.getAttribute('content') ?? null, metaReferrer: referrer, generator }
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
      userAgent,
    }
    if (tls?.validTo) result.certificate = { validTo: tls.validTo, issuer: tls.issuer ?? '' }
    if (finalUrl.startsWith('https:')) result.http = await probeHttp(finalUrl.replace(/^https:/, 'http:'), options.fetch ?? fetch, options.userAgent ?? BOT_AGENT)
    if (metaCsp) result.metaCsp = metaCsp
    if (metaReferrer) result.metaReferrer = metaReferrer
    if (generator) result.generator = generator
    // one page can be both Impressum and Datenschutz; open it once
    for (const href of new Set(legalLinks(links).map(l => l.href))) result.legal.push(await visitor(href))
    return result
  } finally {
    await browser.close()
  }
}

/** A second, separate browser for opening single URLs: only the documents load, nothing of it counts towards the scan. */
async function documentsOnly(browser: Browser, options: ScanOptions) {
  const context = await browser.newContext({ userAgent: options.userAgent ?? BOT_AGENT })
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
