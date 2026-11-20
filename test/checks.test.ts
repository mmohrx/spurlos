import { describe, expect, test } from 'vitest'
import { cookies, forms, headers, https, legal, legalLinks, serviceOfCookie, serviceOfHost, thirdParty } from '../src/checks.ts'
import type { Scan } from '../src/scan.ts'

const base: Scan = { url: 'https://www.firma.de/', finalUrl: 'https://www.firma.de/', settled: true, requests: [], cookies: [], storage: [], headers: {}, links: [], legal: [], forms: [] }
const req = (host: string) => ({ url: `https://${host}/x`, host, type: 'script' })

describe('thirdParty', () => {
  test('subdomains of the own site are not third parties', () => {
    const r = thirdParty({ ...base, requests: [req('www.firma.de'), req('cdn.firma.de'), req('firma.de')] })
    expect(r).toMatchObject({ level: 'green', hosts: [] })
  })

  test('other sites are red and counted per host', () => {
    const r = thirdParty({ ...base, requests: [req('fonts.gstatic.com'), req('fonts.gstatic.com'), req('cdn.anders.de')] })
    expect(r.level).toBe('red')
    if (r.check !== 'third-party') throw new Error()
    expect(r.hosts.map(h => [h.host, h.service?.name, h.requests])).toEqual([
      ['cdn.anders.de', undefined, 1],
      ['fonts.gstatic.com', 'Google Fonts', 2],
    ])
  })

  test('registrable domain respects public suffixes', () => {
    const uk = { ...base, finalUrl: 'https://www.firma.co.uk/' }
    expect(thirdParty({ ...uk, requests: [req('shop.firma.co.uk')] }).level).toBe('green')
    expect(thirdParty({ ...uk, requests: [req('andere.co.uk')] }).level).toBe('red')
  })
})

describe('services', () => {
  test('the most specific host wins', () => {
    expect(serviceOfHost('maps.googleapis.com')?.name).toBe('Google Maps')
    expect(serviceOfHost('www.googleapis.com')?.name).toBe('Google')
    expect(serviceOfHost('region1.google-analytics.com')?.name).toBe('Google Analytics')
    expect(serviceOfHost('notgoogle.com')).toBeUndefined()
  })

  test('cookie names are prefixes', () => {
    expect(serviceOfCookie('_ga_ABC123')?.name).toBe('Google Analytics')
    expect(serviceOfCookie('_hjSessionUser_1')?.name).toBe('Hotjar')
    expect(serviceOfCookie('PHPSESSID')).toBeUndefined()
  })
})

describe('cookies', () => {
  const cookie = (name: string, domain = 'www.firma.de') => ({ name, domain, expires: -1 })

  test('nothing set is green', () => {
    expect(cookies(base).level).toBe('green')
  })

  test('own cookies and storage without a known tracker are yellow', () => {
    expect(cookies({ ...base, cookies: [cookie('PHPSESSID')] }).level).toBe('yellow')
    expect(cookies({ ...base, storage: [{ area: 'localStorage', key: 'theme' }] }).level).toBe('yellow')
  })

  test('known tracking cookies are red, even when set on the own domain', () => {
    expect(cookies({ ...base, cookies: [cookie('_ga')] }).level).toBe('red')
  })

  test('third-party cookies are red', () => {
    const r = cookies({ ...base, cookies: [cookie('id', 'tracker.net')] })
    expect(r.level).toBe('red')
    if (r.check !== 'cookies') throw new Error()
    expect(r.cookies[0]?.thirdParty).toBe(true)
  })
})

describe('legal', () => {
  const links = [
    { text: 'Start', href: 'https://www.firma.de/' },
    { text: 'Impressum', href: 'https://www.firma.de/impressum' },
    { text: 'Privacy', href: 'https://www.firma.de/en/privacy' },
  ]
  const visit = (url: string, status = 200) => ({ url, status, finalUrl: url })

  test('finds links by text or address, one per kind', () => {
    expect(legalLinks(links).map(l => [l.kind, l.href])).toEqual([
      ['impressum', 'https://www.firma.de/impressum'],
      ['datenschutz', 'https://www.firma.de/en/privacy'],
    ])
    expect(legalLinks([{ text: 'Rechtliches', href: 'https://www.firma.de/datenschutz.html' }])[0]?.kind).toBe('datenschutz')
  })

  test('a link that names both counts once, as Impressum', () => {
    expect(legalLinks([{ text: 'Impressum & Datenschutz', href: 'https://www.firma.de/rechtliches' }]).map(l => l.kind)).toEqual(['impressum'])
  })

  test('both linked and reachable is green', () => {
    const scan = { ...base, links, legal: [visit('https://www.firma.de/impressum'), visit('https://www.firma.de/en/privacy')] }
    expect(legal(scan).level).toBe('green')
  })

  test('a missing link or a broken page is red', () => {
    expect(legal({ ...base, links: links.slice(0, 2), legal: [visit('https://www.firma.de/impressum')] }).level).toBe('red')
    const broken = { ...base, links, legal: [visit('https://www.firma.de/impressum'), visit('https://www.firma.de/en/privacy', 404)] }
    expect(legal(broken).level).toBe('red')
  })
})

describe('https', () => {
  const NOW = Date.UTC(2026, 10, 20)
  const days = (n: number) => ({ validTo: NOW / 1000 + n * 86_400, issuer: 'R3' })
  const good = {
    ...base,
    headers: { 'strict-transport-security': 'max-age=31536000' },
    certificate: days(60),
    http: { url: 'http://www.firma.de/', status: 200, finalUrl: 'https://www.firma.de/' },
  }

  test('https with redirect, HSTS and a fresh certificate is green', () => {
    expect(https(good, NOW)).toMatchObject({ level: 'green', certDaysLeft: 60, http: 'redirects', hsts: true })
  })

  test('the certificate decides near its end', () => {
    expect(https({ ...good, certificate: days(10) }, NOW).level).toBe('yellow')
    expect(https({ ...good, certificate: days(3) }, NOW).level).toBe('red')
    expect(https({ ...good, certificate: days(-1) }, NOW).level).toBe('red')
  })

  test('no HSTS is yellow, http without redirect red, nothing on http fine', () => {
    expect(https({ ...good, headers: {} }, NOW).level).toBe('yellow')
    expect(https({ ...good, http: { url: 'http://www.firma.de/', status: 200, finalUrl: 'http://www.firma.de/' } }, NOW)).toMatchObject({ level: 'red', http: 'no-redirect' })
    expect(https({ ...good, http: { url: 'http://www.firma.de/', error: 'refused' } }, NOW)).toMatchObject({ level: 'green', http: 'unreachable' })
  })

  test('a page over plain http is red', () => {
    expect(https({ ...base, finalUrl: 'http://www.firma.de/' }, NOW)).toMatchObject({ level: 'red', https: false })
  })
})

describe('headers', () => {
  test('all set is green', () => {
    const h = {
      'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'camera=()',
    }
    expect(headers({ ...base, headers: h })).toEqual({ check: 'headers', level: 'green', missing: [] })
  })

  test('frame-ancestors in the CSP stands in for X-Frame-Options, otherwise each missing one is listed', () => {
    expect(headers({ ...base, headers: { 'x-frame-options': 'DENY' } })).toMatchObject({
      level: 'yellow',
      missing: ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy'],
    })
  })
})

describe('forms', () => {
  const form = (action: string) => ({ action, method: 'post' })

  test('own https forms are green, foreign ones yellow, http ones red', () => {
    expect(forms({ ...base, forms: [form('https://www.firma.de/kontakt')] }).level).toBe('green')
    expect(forms({ ...base, forms: [form('https://formspree.io/f/abc')] })).toMatchObject({ level: 'yellow', forms: [{ problem: 'third-party' }] })
    expect(forms({ ...base, forms: [form('http://www.firma.de/kontakt')] })).toMatchObject({ level: 'red', forms: [{ problem: 'unencrypted' }] })
  })

  test('no forms, or only javascript ones, is green', () => {
    expect(forms(base).level).toBe('green')
    expect(forms({ ...base, forms: [form('javascript:void(0)')] })).toMatchObject({ level: 'green', forms: [] })
  })
})
