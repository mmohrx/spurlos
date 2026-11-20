import { getDomain } from 'tldts'
import knownServices from './services.json' with { type: 'json' }
import type { Cookie, Form, Link, Scan, Visit } from './scan.ts'

export type Level = 'green' | 'yellow' | 'red'
/** httpOnly: its cookies hold a session and should be out of reach of JavaScript */
export type Service = { name: string; category: string; hosts: string[]; cookies?: string[]; storage?: string[]; httpOnly?: boolean }

export type ThirdParty = { host: string; service: Service | undefined; requests: number }
/** missing: attributes the cookie should have – Secure on an https page, HttpOnly for a session cookie */
export type CookieFinding = Cookie & { thirdParty: boolean; service: Service | undefined; missing: ('Secure' | 'HttpOnly')[] }
export type StorageFinding = Scan['storage'][number] & { service: Service | undefined }
/** a header or meta tag that names the software behind the page; version: it names its version too */
export type Disclosure = { source: 'header' | 'meta'; name: string; value: string; version: boolean }
export type LegalKind = 'impressum' | 'datenschutz'
export type LegalPage = { kind: LegalKind; link?: Link; visit?: Visit }
/** redirects: http sends on to https · no-redirect: the page answers over plain http · unreachable: nothing answers on http */
export type HttpRedirect = 'redirects' | 'no-redirect' | 'unreachable'
export type FormFinding = Form & { problem?: 'unencrypted' | 'third-party' }

export type Result =
  | { check: 'third-party'; level: Level; hosts: ThirdParty[] }
  | { check: 'cookies'; level: Level; cookies: CookieFinding[]; storage: StorageFinding[] }
  | { check: 'legal'; level: Level; pages: LegalPage[] }
  | { check: 'https'; level: Level; https: boolean; certDaysLeft?: number; http?: HttpRedirect; hsts: boolean }
  | { check: 'headers'; level: Level; missing: string[] }
  | { check: 'forms'; level: Level; forms: FormFinding[] }
  | { check: 'disclosure'; level: Level; findings: Disclosure[] }

export const worst = (levels: Level[]): Level => (levels.includes('red') ? 'red' : levels.includes('yellow') ? 'yellow' : 'green')

const services = knownServices as Service[]
// the most specific host wins: maps.googleapis.com before googleapis.com
const byHost = services
  .flatMap(s => s.hosts.map(h => ({ h, s })))
  .sort((a, b) => b.h.length - a.h.length)

/** The site a host belongs to (example.co.uk for www.example.co.uk); IPs and localhost stand for themselves. */
export function site(host: string): string {
  return getDomain(host) ?? host
}

export function serviceOfHost(host: string): Service | undefined {
  return byHost.find(({ h }) => host === h || host.endsWith('.' + h))?.s
}

/** Session and security cookies of common frameworks and proxies: needed to run the site, not to follow anyone. */
export const isNecessary = (s: Service | undefined) => s?.category === 'necessary'

// names in services.json are prefixes (_ga also covers GA4's _ga_ABC123),
// or with a leading * suffixes (*-session covers Laravel's <app>-session)
const matches = (name: string) => (pattern: string) => (pattern.startsWith('*') ? name.endsWith(pattern.slice(1)) : name.startsWith(pattern))

export function serviceOfCookie(name: string): Service | undefined {
  return services.find(s => s.cookies?.some(matches(name)))
}

/** for keys in localStorage and sessionStorage, such as Vue Router's saved scroll positions */
export function serviceOfStorage(key: string): Service | undefined {
  return services.find(s => s.storage?.some(matches(key)))
}

/** Every request to another site than the page's own counts: it hands the visitor's IP to someone else. */
export function thirdParty(scan: Scan): Result {
  const own = site(new URL(scan.finalUrl).hostname)
  const counts = new Map<string, number>()
  for (const r of scan.requests) if (site(r.host) !== own) counts.set(r.host, (counts.get(r.host) ?? 0) + 1)
  const hosts = [...counts]
    .map(([host, requests]) => ({ host, service: serviceOfHost(host), requests }))
    .sort((a, b) => a.host.localeCompare(b.host))
  return { check: 'third-party', level: hosts.length ? 'red' : 'green', hosts }
}

const ok = (v: Visit | undefined) => v !== undefined && 'status' in v && v.status >= 200 && v.status < 300

// The level of each single finding; a check's level is the worst of its findings.

/**
 * A third-party cookie or a known tracker's is red; a known session or security cookie green, unless it lacks
 * Secure or HttpOnly; any other yellow.
 */
export const cookieLevel = (c: CookieFinding): Level =>
  c.thirdParty || (c.service && !isNecessary(c.service)) ? 'red' : isNecessary(c.service) && !c.missing.length ? 'green' : 'yellow'
/** a version number tells an attacker which known holes to try; the bare name of the software is only a hint */
export const disclosureLevel = (d: Disclosure): Level => (d.version ? 'yellow' : 'green')
/** what a framework keeps there to run is green; anything else an app stores wants a look */
export const storageLevel = (e: StorageFinding): Level => (isNecessary(e.service) ? 'green' : 'yellow')
export const legalLevel = (p: LegalPage): Level => (ok(p.visit) ? 'green' : 'red')
export const certLevel = (daysLeft: number): Level => (daysLeft < 7 ? 'red' : daysLeft < 14 ? 'yellow' : 'green')
/** nothing on http is yellow: browsers mostly try https first, but old http:// links break */
export const httpLevel = (h: HttpRedirect): Level => (h === 'no-redirect' ? 'red' : h === 'unreachable' ? 'yellow' : 'green')
export const formLevel = (f: FormFinding): Level => (f.problem === 'unencrypted' ? 'red' : f.problem ? 'yellow' : 'green')

/**
 * Cookies and storage present before any click. A third-party cookie or a known tracker's is red; known session and
 * security cookies (Laravel's XSRF-TOKEN, PHPSESSID, Cloudflare's __cf_bm …) are green; any other own cookie or
 * storage entry is yellow, as it may be needed to run the site and wants a look.
 */
export function cookies(scan: Scan): Result {
  const own = site(new URL(scan.finalUrl).hostname)
  const https = scan.finalUrl.startsWith('https:')
  const found = scan.cookies.map((c): CookieFinding => {
    const service = serviceOfCookie(c.name)
    const missing: CookieFinding['missing'] = []
    if (https && !c.secure) missing.push('Secure')
    if (service?.httpOnly && !c.httpOnly) missing.push('HttpOnly')
    return { ...c, thirdParty: site(c.domain) !== own, service, missing }
  })
  const storage = scan.storage.map(e => ({ ...e, service: serviceOfStorage(e.key) }))
  const level = worst([...found.map(cookieLevel), ...storage.map(storageLevel)])
  return { check: 'cookies', level, cookies: found, storage }
}

const LEGAL: Record<LegalKind, RegExp> = {
  impressum: /impressum|imprint|legal[ -]?notice|anbieterkennzeichnung/i,
  datenschutz: /datenschutz|privacy|data[ -]?protection/i,
}

/** The first link per kind whose text or address names it. A link like „Impressum & Datenschutz“ counts for both. */
export function legalLinks(links: Link[]): (Link & { kind: LegalKind })[] {
  const out: (Link & { kind: LegalKind })[] = []
  for (const kind of ['impressum', 'datenschutz'] as const) {
    const l = links.find(l => /^https?:/.test(l.href) && (LEGAL[kind].test(l.text) || LEGAL[kind].test(l.href)))
    if (l) out.push({ ...l, kind })
  }
  return out
}


/** Impressum and Datenschutz each need a link on the page that opens without error. */
export function legal(scan: Scan): Result {
  const found = legalLinks(scan.links)
  const pages = (['impressum', 'datenschutz'] as const).map(kind => {
    const link = found.find(l => l.kind === kind)
    const page: LegalPage = { kind }
    if (link) {
      page.link = { text: link.text, href: link.href }
      const visit = scan.legal.find(v => v.url === link.href)
      if (visit) page.visit = visit
    }
    return page
  })
  return { check: 'legal', level: worst(pages.map(legalLevel)), pages }
}

/** A page without https, an expired certificate or http left without redirect is red; a certificate close to its end or no HSTS yellow. */
export function https(scan: Scan, now = Date.now()): Result {
  const isHttps = scan.finalUrl.startsWith('https:')
  const hsts = 'strict-transport-security' in scan.headers
  const levels: Level[] = [isHttps ? 'green' : 'red']
  const r: Extract<Result, { check: 'https' }> = { check: 'https', level: 'green', https: isHttps, hsts }

  if (scan.certificate) {
    r.certDaysLeft = Math.floor((scan.certificate.validTo * 1000 - now) / 86_400_000)
    levels.push(certLevel(r.certDaysLeft))
  }
  if (scan.http) {
    r.http = 'error' in scan.http ? 'unreachable' : scan.http.finalUrl.startsWith('https:') ? 'redirects' : 'no-redirect'
    levels.push(httpLevel(r.http))
  }
  if (isHttps && !hsts) levels.push('yellow')
  r.level = worst(levels)
  return r
}

/** Hardening headers of the page; each one missing is yellow. HSTS is part of the https check. */
export function headers(scan: Scan): Result {
  const h = scan.headers
  const csp = h['content-security-policy'] ?? ''
  // a CSP or referrer policy in a <meta> tag counts, but browsers ignore frame-ancestors there
  const missing = [
    !csp && !scan.metaCsp && 'Content-Security-Policy',
    !h['x-frame-options'] && !/frame-ancestors/i.test(csp) && 'X-Frame-Options',
    h['x-content-type-options']?.toLowerCase() !== 'nosniff' && 'X-Content-Type-Options',
    !h['referrer-policy'] && !scan.metaReferrer && 'Referrer-Policy',
    !h['permissions-policy'] && 'Permissions-Policy',
  ].filter((m): m is string => typeof m === 'string')
  return { check: 'headers', level: missing.length ? 'yellow' : 'green', missing }
}

/** A form that sends over plain http is red; one that sends to another site yellow, as the entries go to someone else. */
export function forms(scan: Scan): Result {
  const own = site(new URL(scan.finalUrl).hostname)
  const found = scan.forms
    .filter(f => /^https?:/.test(f.action))
    .map((f): FormFinding => {
      const u = new URL(f.action)
      if (u.protocol === 'http:') return { ...f, problem: 'unencrypted' }
      if (site(u.hostname) !== own) return { ...f, problem: 'third-party' }
      return f
    })
  const level = worst(found.map(formLevel))
  return { check: 'forms', level, forms: found }
}

const DISCLOSING = ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator']
const VERSION_NUMBER = /\d+\.\d+/

/** Headers and the generator meta tag that name the software behind the page – passive: only what the page sends anyway. */
export function disclosure(scan: Scan): Result {
  const findings: Disclosure[] = DISCLOSING.filter(h => scan.headers[h]).map(h => {
    const value = scan.headers[h] ?? ''
    return { source: 'header', name: h, value, version: VERSION_NUMBER.test(value) }
  })
  if (scan.generator) findings.push({ source: 'meta', name: 'generator', value: scan.generator, version: VERSION_NUMBER.test(scan.generator) })
  return { check: 'disclosure', level: worst(findings.map(disclosureLevel)), findings }
}

export function runChecks(scan: Scan, now = Date.now()): Result[] {
  return [thirdParty(scan), cookies(scan), legal(scan), https(scan, now), headers(scan), forms(scan), disclosure(scan)]
}
