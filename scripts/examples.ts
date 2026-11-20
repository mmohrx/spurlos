// Writes the example reports in examples/: both test pages, checked offline as https://shop.example,
// as text (de, en), as JSON and as a picture of the colored output. Run with `npm run examples`.
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { runChecks } from '../src/checks.ts'
import { MESSAGES, text } from '../src/report.ts'
import { scan } from '../src/scan.ts'
import { offline, redirects, SITE, staysOnHttp } from '../test/site.ts'

const out = new URL('../examples/', import.meta.url)
await mkdir(out, { recursive: true })

const pages = [
  { name: 'mit-maengeln', url: `${SITE}/tracked.html`, fetch: staysOnHttp },
  { name: 'sauber', url: `${SITE}/`, fetch: redirects },
]

const colored: string[] = []
for (const p of pages) {
  const s = await scan(p.url, { setup: offline, fetch: p.fetch })
  const results = runChecks(s)
  await writeFile(new URL(`${p.name}.txt`, out), text(s, results, 'de', { verbose: true }) + '\n')
  await writeFile(new URL(`${p.name}.en.txt`, out), text(s, results, 'en', { verbose: true }) + '\n')
  await writeFile(new URL(`${p.name}.json`, out), JSON.stringify({ scan: s, results, note: MESSAGES.de.disclaimer }, null, 2) + '\n')
  colored.push(text(s, results, 'de', { color: true }))
}

// the colored output as a terminal would show it, for the README
const FG: Record<number, string> = { 30: '#1e1f24', 31: '#ff6b6b', 32: '#4cd17a', 33: '#f2c94c', 36: '#6cb6ff', 37: '#ffffff' }
const BG: Record<number, string> = { 41: '#e5484d', 42: '#30a46c', 43: '#f2c94c' }
function html(ansi: string): string {
  let st: { bold?: boolean; dim?: boolean; fg?: string; bg?: string } = {}
  let res = ''
  for (const part of ansi.split(/(\x1b\[[\d;]*m)/)) {
    const code = part.match(/^\x1b\[([\d;]*)m$/)
    if (code) {
      for (const c of (code[1] ?? '').split(';').map(Number)) {
        if (c === 1) st.bold = true
        else if (c === 2) st.dim = true
        else if (c === 22) st = { ...st, bold: false, dim: false }
        else if (c === 39) delete st.fg
        else if (c === 49) delete st.bg
        else if (FG[c]) st.fg = FG[c]
        else if (BG[c]) st.bg = BG[c]
      }
      continue
    }
    const css = [st.bold && 'font-weight:700', st.dim && 'color:#7d7f8a', st.fg && `color:${st.fg}`, st.bg && `background:${st.bg}`].filter(Boolean).join(';')
    const body = part.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    res += css ? `<span style="${css}">${body}</span>` : body
  }
  return res
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 400 }, deviceScaleFactor: 2 })
await page.setContent(`<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 20px; background: #fff; display: flex; gap: 20px; align-items: flex-start; width: max-content }
  pre { margin: 0; padding: 16px 18px; border-radius: 10px; background: #1e1f24; color: #d6d6dc; font: 13px/1.45 Menlo, "DejaVu Sans Mono", monospace }
</style>${colored.map(c => `<pre>${html(c)}</pre>`).join('')}`)
await page.screenshot({ path: new URL('vorschau.png', out).pathname, fullPage: true })
await browser.close()
