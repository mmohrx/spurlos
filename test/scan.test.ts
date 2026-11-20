import { readFile } from 'node:fs/promises'
import type { BrowserContext } from 'playwright'
import { describe, expect, test } from 'vitest'
import { runChecks } from '../src/checks.ts'
import { text } from '../src/report.ts'
import { scan } from '../src/scan.ts'

const SITE = 'https://shop.example'
const sites = new URL('./sites/', import.meta.url)

/** Serves test/sites under SITE and answers every other host with an empty 200, so no test touches the network. */
async function offline(context: BrowserContext) {
  await context.route('**/*', async route => {
    const u = new URL(route.request().url())
    if (u.origin !== SITE) return route.fulfill({ status: 200, body: '' })
    const file = u.pathname === '/' ? 'clean.html' : u.pathname.slice(1)
    try {
      const body = await readFile(new URL(file, sites))
      const headers: Record<string, string> = file === 'tracked.html' ? { 'set-cookie': 'session=abc; Path=/; HttpOnly' } : {}
      return route.fulfill({ status: 200, body, headers, contentType: file.endsWith('.js') ? 'text/javascript' : 'text/html' })
    } catch {
      return route.fulfill({ status: 404, body: '' })
    }
  })
}

describe('scan', { timeout: 30_000 }, () => {
  test('a clean page leaves no traces', async () => {
    const s = await scan(`${SITE}/`, { setup: offline })
    expect(runChecks(s).map(r => r.level)).toEqual(['green', 'green'])
  })

  test('a page with fonts, tag manager, video and cookies', async () => {
    const s = await scan(`${SITE}/tracked.html`, { setup: offline })
    const [third, cookies] = runChecks(s)

    if (third?.check !== 'third-party' || cookies?.check !== 'cookies') throw new Error('unexpected checks')
    expect(third.level).toBe('red')
    const hosts = third.hosts.map(h => h.host)
    expect(hosts).toEqual(expect.arrayContaining(['fonts.googleapis.com', 'www.googletagmanager.com', 'www.youtube.com', 'cdn.unbekannt.example']))

    expect(cookies.level).toBe('red')
    expect(cookies.cookies.map(c => c.name).sort()).toEqual(['_ga', 'session'])
    expect(cookies.storage).toEqual([{ area: 'localStorage', key: 'theme' }])

    const report = text(s, runChecks(s))
    expect(report).toContain('Google Fonts')
    expect(report).toContain('Cookie _ga (shop.example) – eigen, Google Analytics')
  })
})
