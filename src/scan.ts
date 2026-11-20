import { chromium, type BrowserContext } from 'playwright'

export type Request = { url: string; host: string; type: string }
export type Cookie = { name: string; domain: string; expires: number }
export type StorageEntry = { area: 'localStorage' | 'sessionStorage'; key: string }

export type Scan = {
  url: string
  finalUrl: string
  /** false when the page still had requests running when we stopped waiting */
  settled: boolean
  requests: Request[]
  cookies: Cookie[]
  storage: StorageEntry[]
}

export type ScanOptions = {
  /** how long to wait for the network to go quiet after load, in ms */
  settleMs?: number
  /** hook for tests: route requests before the page is opened */
  setup?: (context: BrowserContext) => Promise<void>
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
    await page.goto(url, { waitUntil: 'load' })
    const settled = await page
      .waitForLoadState('networkidle', { timeout: options.settleMs ?? 10_000 })
      .then(() => true, () => false)

    const cookies = (await context.cookies()).map(c => ({ name: c.name, domain: c.domain.replace(/^\./, ''), expires: c.expires }))
    const storage = await page.evaluate(() => {
      const out: { area: 'localStorage' | 'sessionStorage'; key: string }[] = []
      for (const area of ['localStorage', 'sessionStorage'] as const) {
        const s = window[area]
        for (let i = 0; i < s.length; i++) out.push({ area, key: s.key(i) ?? '' })
      }
      return out
    })

    return { url, finalUrl: page.url(), settled, requests, cookies, storage }
  } finally {
    await browser.close()
  }
}
