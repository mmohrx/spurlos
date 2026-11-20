import { readFile } from 'node:fs/promises'
import type { BrowserContext } from 'playwright'
import { describe, expect, test } from 'vitest'
import { runChecks, type Result } from '../src/checks.ts'
import { text } from '../src/report.ts'
import { scan } from '../src/scan.ts'

const SITE = 'https://shop.example'
const sites = new URL('./sites/', import.meta.url)

const HARDENED = {
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=()',
}

/**
 * Serves test/sites under SITE (clean.html as the start page, /impressum as impressum.html) and answers every other
 * host with an empty 200 – so no test touches the network.
 */
async function offline(context: BrowserContext) {
  await context.route('**/*', async route => {
    const u = new URL(route.request().url())
    if (u.origin !== SITE) return route.fulfill({ status: 200, body: '' })
    const name = u.pathname === '/' ? 'clean.html' : u.pathname.slice(1)
    const file = name.includes('.') ? name : `${name}.html`
    try {
      const body = await readFile(new URL(file, sites))
      const headers: Record<string, string> =
        file === 'tracked.html' ? { 'set-cookie': 'session=abc; Path=/; HttpOnly' } : file === 'clean.html' ? HARDENED : {}
      return route.fulfill({ status: 200, body, headers, contentType: file.endsWith('.js') ? 'text/javascript' : 'text/html' })
    } catch {
      return route.fulfill({ status: 404, body: '' })
    }
  })
}

/** Stands in for the server asked over http://: it answers from `finalUrl`, as if it had redirected there. */
const answersFrom = (finalUrl: (url: string) => string): typeof fetch => async input => {
  const r = new Response(null, { status: 200 })
  Object.defineProperty(r, 'url', { value: finalUrl(String(input)) })
  return r
}
const redirects = answersFrom(u => u.replace(/^http:/, 'https:'))
const staysOnHttp = answersFrom(u => u)

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
    })
    expect(pick(results, 'https').http).toBe('redirects')
    expect(s.legal.map(v => v.url)).toEqual([`${SITE}/impressum`, `${SITE}/datenschutz`])
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
    expect(cookies.storage).toEqual([{ area: 'localStorage', key: 'theme' }])

    const legal = pick(results, 'legal')
    expect(legal.level).toBe('red')
    expect(legal.pages.map(p => [p.kind, p.visit && 'status' in p.visit ? p.visit.status : undefined])).toEqual([
      ['impressum', 404],
      ['datenschutz', undefined],
    ])

    expect(pick(results, 'https')).toMatchObject({ level: 'red', hsts: false, http: 'no-redirect' })
    expect(pick(results, 'headers').missing).toHaveLength(5)
    expect(pick(results, 'forms').forms.map(f => f.problem)).toEqual(['unencrypted', 'third-party'])

    const report = text(s, results)
    expect(report).toContain('Google Fonts')
    expect(report).toContain('Cookie _ga (shop.example) – eigen, Google Analytics')
    expect(report).toContain('Datenschutzerklärung: kein Link auf der Seite gefunden')
    expect(report).toContain('http://shop.example/newsletter – sendet unverschlüsselt über http')

    const english = text(s, results, 'en')
    expect(english).toContain('Privacy policy: no link found on the page')
    expect(english).toContain('Cookie _ga (shop.example) – first-party, Google Analytics')
    expect(english).toContain('http:// serves the page without redirecting to https://.')
    expect(english).not.toMatch(/[äöüß„]/)
  })
})
