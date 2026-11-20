import { readFile } from 'node:fs/promises'
import type { BrowserContext } from 'playwright'

export const SITE = 'https://shop.example'
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
/** what each request to SITE was sent with, newest last */
export const seen: { url: string; ua: string | undefined; ch: string | undefined }[] = []

export async function offline(context: BrowserContext) {
  await context.route('**/*', async route => {
    const u = new URL(route.request().url())
    const h = route.request().headers()
    if (u.origin === SITE) seen.push({ url: u.href, ua: h['user-agent'], ch: h['sec-ch-ua'] })
    if (u.origin !== SITE) return route.fulfill({ status: 200, body: '' })
    const name = u.pathname === '/' ? 'clean.html' : u.pathname.slice(1)
    const file = name.includes('.') ? name : `${name}.html`
    try {
      const body = await readFile(new URL(file, sites))
      const headers: Record<string, string> =
        file === 'tracked.html'
          ? { 'set-cookie': 'session=abc; Path=/; HttpOnly', server: 'Apache/2.4.41 (Ubuntu)', 'x-powered-by': 'PHP/8.1.2' }
          : file === 'clean.html'
            ? HARDENED
            : {}
      return route.fulfill({ status: 200, body, headers, contentType: file.endsWith('.js') ? 'text/javascript' : 'text/html' })
    } catch {
      return route.fulfill({ status: 404, body: '' })
    }
  })
}

/** Stands in for the server asked over http://: it answers from `finalUrl`, as if it had redirected there. */
export const fetched: (string | null)[] = []
const answersFrom = (finalUrl: (url: string) => string): typeof fetch => async (input, init) => {
  fetched.push(new Headers(init?.headers).get('user-agent'))
  const r = new Response(null, { status: 200 })
  Object.defineProperty(r, 'url', { value: finalUrl(String(input)) })
  return r
}
export const redirects = answersFrom(u => u.replace(/^http:/, 'https:'))
export const staysOnHttp = answersFrom(u => u)
