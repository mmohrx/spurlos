import { getDomain } from 'tldts'
import knownServices from './services.json' with { type: 'json' }
import type { Cookie, Form, Link, Scan, Visit } from './scan.ts'

export type Level = 'green' | 'yellow' | 'red'
export type Service = { name: string; category: string; hosts: string[]; cookies?: string[] }

export type ThirdParty = { host: string; service: Service | undefined; requests: number }
export type CookieFinding = Cookie & { thirdParty: boolean; service: Service | undefined }
export type LegalKind = 'impressum' | 'datenschutz'
export type LegalPage = { kind: LegalKind; link?: Link; visit?: Visit }
/** redirects: http sends on to https · no-redirect: the page answers over plain http · unreachable: nothing answers on http */
export type HttpRedirect = 'redirects' | 'no-redirect' | 'unreachable'
export type FormFinding = Form & { problem?: 'unencrypted' | 'third-party' }

export type Result =
  | { check: 'third-party'; level: Level; hosts: ThirdParty[] }
  | { check: 'cookies'; level: Level; cookies: CookieFinding[]; storage: Scan['storage'] }
  | { check: 'legal'; level: Level; pages: LegalPage[] }
  | { check: 'https'; level: Level; https: boolean; certDaysLeft?: number; http?: HttpRedirect; hsts: boolean }
  | { check: 'headers'; level: Level; missing: string[] }
  | { check: 'forms'; level: Level; forms: FormFinding[] }

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

export function serviceOfCookie(name: string): Service | undefined {
  // cookie names in services.json are prefixes (_ga also covers GA4's _ga_ABC123),
  // or with a leading * suffixes (*-session covers Laravel's <app>-session)
  return services.find(s => s.cookies?.some(c => (c.startsWith('*') ? name.endsWith(c.slice(1)) : name.startsWith(c))))
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

/** A third-party cookie or a known tracker's is red, a known session or security cookie green, any other yellow. */
export const cookieLevel = (c: CookieFinding): Level =>
  c.thirdParty || (c.service && !isNecessary(c.service)) ? 'red' : isNecessary(c.service) ? 'green' : 'yellow'
/** spurlos cannot tell what an app keeps in browser storage, so each entry wants a look. */
export const STORAGE_LEVEL: Level = 'yellow'
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
  const found = scan.cookies.map(c => ({ ...c, thirdParty: site(c.domain) !== own, service: serviceOfCookie(c.name) }))
  const level = worst([...found.map(cookieLevel), ...scan.storage.map((): Level => STORAGE_LEVEL)])
  return { check: 'cookies', level, cookies: found, storage: scan.storage }
}

const LEGAL: Record<LegalKind, RegExp> = {
  impressum: /impressum|imprint|legal[ -]?notice|anbieterkennzeichnung/i,
  datenschutz: /datenschutz|privacy|data[ -]?protection/i,
}

/** The first link per kind whose text or address names it; Impressum wins over Datenschutz for a link that says both. */
export function legalLinks(links: Link[]): (Link & { kind: LegalKind })[] {
  const out: (Link & { kind: LegalKind })[] = []
  for (const kind of ['impressum', 'datenschutz'] as const) {
    const l = links.find(l => /^https?:/.test(l.href) && !out.some(o => o.href === l.href) && (LEGAL[kind].test(l.text) || LEGAL[kind].test(l.href)))
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
  const missing = [
    !csp && 'Content-Security-Policy',
    !h['x-frame-options'] && !/frame-ancestors/i.test(csp) && 'X-Frame-Options',
    h['x-content-type-options']?.toLowerCase() !== 'nosniff' && 'X-Content-Type-Options',
    !h['referrer-policy'] && 'Referrer-Policy',
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

export function runChecks(scan: Scan, now = Date.now()): Result[] {
  return [thirdParty(scan), cookies(scan), legal(scan), https(scan, now), headers(scan), forms(scan)]
}
