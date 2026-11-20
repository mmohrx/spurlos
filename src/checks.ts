import { getDomain } from 'tldts'
import knownServices from './services.json' with { type: 'json' }
import type { Cookie, Scan } from './scan.ts'

export type Level = 'green' | 'yellow' | 'red'
export type Service = { name: string; category: string; hosts: string[]; cookies?: string[] }

export type ThirdParty = { host: string; service: Service | undefined; requests: number }
export type CookieFinding = Cookie & { thirdParty: boolean; service: Service | undefined }

export type Result =
  | { check: 'third-party'; level: Level; hosts: ThirdParty[] }
  | { check: 'cookies'; level: Level; cookies: CookieFinding[]; storage: Scan['storage'] }

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

export function serviceOfCookie(name: string): Service | undefined {
  // cookie names in services.json are prefixes: _ga also covers GA4's _ga_ABC123
  return services.find(s => s.cookies?.some(c => name.startsWith(c)))
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

/**
 * Cookies and storage present before any click. A third-party or known tracking cookie is red;
 * other own cookies and storage are yellow, as they may be technically necessary and need a look.
 */
export function cookies(scan: Scan): Result {
  const own = site(new URL(scan.finalUrl).hostname)
  const found = scan.cookies.map(c => ({ ...c, thirdParty: site(c.domain) !== own, service: serviceOfCookie(c.name) }))
  const level: Level = found.some(c => c.thirdParty || c.service)
    ? 'red'
    : found.length || scan.storage.length
      ? 'yellow'
      : 'green'
  return { check: 'cookies', level, cookies: found, storage: scan.storage }
}

export function runChecks(scan: Scan): Result[] {
  return [thirdParty(scan), cookies(scan)]
}
