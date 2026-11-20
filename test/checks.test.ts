import { describe, expect, test } from 'vitest'
import { cookies, serviceOfCookie, serviceOfHost, thirdParty } from '../src/checks.ts'
import type { Scan } from '../src/scan.ts'

const base: Scan = { url: 'https://www.firma.de/', finalUrl: 'https://www.firma.de/', settled: true, requests: [], cookies: [], storage: [] }
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
    expect(serviceOfHost('www.googleapis.com')?.name).toBe('Google (allgemein)')
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
