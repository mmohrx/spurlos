import { describe, expect, test } from 'vitest'
import { runChecks, type Result } from '../src/checks.ts'
import { text } from '../src/report.ts'
import { BOT_AGENT, scan } from '../src/scan.ts'
import { fetched, offline, redirects, seen, SITE, staysOnHttp } from './site.ts'

const pick = <C extends Result['check']>(results: Result[], check: C) => {
  const r = results.find(r => r.check === check)
  if (!r) throw new Error(`no ${check} result`)
  return r as Extract<Result, { check: C }>
}

describe('scan', { timeout: 30_000 }, () => {
  test('a clean page passes every check', async () => {
    const s = await scan(`${SITE}/`, { setup: offline, fetch: redirects })
    const results = runChecks(s)
    expect(Object.fromEntries(results.map(r => [r.check, r.level]))).toEqual({
      'third-party': 'green',
      cookies: 'green',
      legal: 'green',
      https: 'green',
      headers: 'green',
      forms: 'green',
      disclosure: 'green',
    })
    expect(pick(results, 'https').http).toBe('redirects')
    expect(s.legal.map(v => v.url)).toEqual([`${SITE}/impressum`, `${SITE}/datenschutz`])
    expect(s).toMatchObject({ metaCsp: "default-src 'self'", metaReferrer: 'no-referrer' })

    // green checks take one line each; their findings show with verbose
    const short = text(s, results)
    expect(short).not.toContain('Impressum: „Impressum“')
    expect(short).toContain('--verbose')
    const long = text(s, results, 'de', { verbose: true })
    expect(long).toContain('Impressum: „Impressum“')
    expect(long).not.toContain('--verbose')
  })

  test('a page with fonts, tag manager, video, cookies and leaky forms', async () => {
    const s = await scan(`${SITE}/tracked.html`, { setup: offline, fetch: staysOnHttp })
    const results = runChecks(s)

    const third = pick(results, 'third-party')
    expect(third.level).toBe('red')
    expect(third.hosts.map(h => h.host)).toEqual(
      expect.arrayContaining(['fonts.googleapis.com', 'www.googletagmanager.com', 'www.youtube.com', 'cdn.unbekannt.example']),
    )
    // the second browser that opens the legal pages and http:// must not add to the scan
    expect(s.requests.some(r => r.url.includes('/rechtliches'))).toBe(false)

    const cookies = pick(results, 'cookies')
    expect(cookies.level).toBe('red')
    expect(cookies.cookies.map(c => c.name).sort()).toEqual(['_ga', 'session'])
    expect(cookies.storage).toEqual([{ area: 'localStorage', key: 'theme', service: undefined }])

    const legal = pick(results, 'legal')
    expect(legal.level).toBe('red')
    expect(legal.pages.map(p => [p.kind, p.visit && 'status' in p.visit ? p.visit.status : undefined])).toEqual([
      ['impressum', 404],
      ['datenschutz', undefined],
    ])

    expect(pick(results, 'https')).toMatchObject({ level: 'red', hsts: false, http: 'no-redirect' })
    expect(pick(results, 'headers').missing).toHaveLength(5)
    expect(pick(results, 'forms').forms.map(f => f.problem)).toEqual(['unencrypted', 'third-party'])
    expect(pick(results, 'disclosure').findings.map(d => `${d.name}: ${d.value}`)).toEqual([
      'server: Apache/2.4.41 (Ubuntu)',
      'x-powered-by: PHP/8.1.2',
      'generator: WordPress 6.2',
    ])
    // set without Secure on an https page
    expect(pick(results, 'cookies').cookies.find(c => c.name === 'session')?.missing).toEqual(['Secure'])

    const report = text(s, results)
    expect(report).toContain('Google Fonts')
    // each finding carries its own light, so the reader sees which one makes the check red or yellow
    expect(report).toContain('🔴 Cookie _ga (shop.example) – eigen, Google Analytics')
    expect(report).toContain('🟡 Cookie session (shop.example) – eigen, unbekannt, bis Sitzungsende, ohne Secure')
    expect(report).toContain('🟡 Header x-powered-by: PHP/8.1.2')
    expect(report).toContain('🟡 localStorage: theme – unbekannt')
    expect(report).toContain('Datenschutzerklärung: kein Link auf der Seite gefunden')
    expect(report).toContain('http://shop.example/newsletter – sendet unverschlüsselt über http')
    // the summary comes first, the worst checks lead, and without color the text holds no escape codes
    const lines = report.split('\n')
    expect(lines.slice(0, 3)).toContainEqual(expect.stringMatching(/^\d+ Mängel · \d+ Hinweise?$/))
    const lights = lines.filter(l => /^\S/.test(l) && /^(🔴|🟡|🟢)/.test(l)).map(l => l.slice(0, 2))
    expect(lights).toEqual([...lights].sort((a, b) => ['🔴', '🟡', '🟢'].indexOf(a) - ['🔴', '🟡', '🟢'].indexOf(b)))
    expect(report).not.toContain('\x1b[')
    expect(text(s, results, 'de', { color: true })).toContain('\x1b[1m')

    const english = text(s, results, 'en')
    expect(english).toContain('Privacy policy: no link found on the page')
    expect(english).toContain('Cookie _ga (shop.example) – first-party, Google Analytics')
    expect(english).toContain('http:// serves the page without redirecting to https://.')
    expect(english).not.toMatch(/[äöüß„]/)
  })

  test('the page sees a regular Chrome with spurlos added, the side requests an open bot', async () => {
    seen.length = 0
    fetched.length = 0
    const s = await scan(`${SITE}/`, { setup: offline, fetch: redirects })

    expect(s.userAgent).toMatch(/^Mozilla\/5\.0 \(.+\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/\d+\.0\.0\.0 Safari\/537\.36 spurlos\/\d+\.\d+\.\d+$/)
    const page = seen.find(r => r.url === `${SITE}/`)
    expect(page?.ua).toBe(s.userAgent)
    expect(page?.ch).toMatch(/"Chromium"/)
    expect(page?.ch).not.toMatch(/Headless/)

    expect(seen.find(r => r.url === `${SITE}/impressum`)?.ua).toBe(BOT_AGENT)
    expect(fetched).toEqual([BOT_AGENT])
    expect(BOT_AGENT).toMatch(/^spurlos\/\d+\.\d+\.\d+ \(\+https:\/\/github\.com\/mmohrx\/spurlos\)$/)
  })

  test('--user-agent replaces every one of them', async () => {
    seen.length = 0
    fetched.length = 0
    await scan(`${SITE}/`, { setup: offline, fetch: redirects, userAgent: 'Test/1' })
    expect(new Set(seen.map(r => r.ua))).toEqual(new Set(['Test/1']))
    expect(fetched).toEqual(['Test/1'])
  })
})
