// Writes the logo to assets/: a magnifier with the three lights of the report in its lens, next to the
// word "spurlos" in JetBrains Mono ExtraBold, turned into paths so it looks the same without the font.
//
// Needs two packages that are not part of the project, installed anywhere and passed in LOGO_DEPS:
//   npm i --prefix /tmp/spurlos-logo fontkit @fontsource/jetbrains-mono
//   LOGO_DEPS=/tmp/spurlos-logo node scripts/logo.mjs
// The social preview (assets/social.png) is rendered with Playwright, which the project has.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { chromium } from 'playwright'

const deps = process.env.LOGO_DEPS
if (!deps) throw new Error('LOGO_DEPS fehlt, siehe Kopf von scripts/logo.mjs')
const require = createRequire(path.join(path.resolve(deps), 'package.json'))
const fontkit = require('fontkit')
const font = fontkit.openSync(require.resolve('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-800-normal.woff'))

// the lights as the terminal report shows them, a little deeper on white so they keep their contrast
const C = {
  dark: { fg: '#e9e9ee', red: '#ff6b6b', yellow: '#f2c94c', green: '#4cd17a' },
  light: { fg: '#1e1f24', red: '#e5484d', yellow: '#e0a800', green: '#1f9d55' },
  tile: '#1e1f24',
}

// the mark on a 64 grid: lens, handle down to the right, three lights in the lens
const MARK = { cx: 28, cy: 28, r: 20, ring: 5.5, handle: [42.5, 42.5, 57, 57], grip: 8, dot: 4.6, gap: 10.5 }
// for 16 to 32 pixels: thicker lines and one big light, finer detail would blur
const SMALL = { ...MARK, ring: 7.5, grip: 10, dot: 5.6 }
const BOX = { x: 5, y: 5, w: 56, h: 56 } // extent including stroke widths

const n = v => +v.toFixed(2)

const markEls = (m, c, lights = ['red', 'yellow', 'green']) => {
  const [x1, y1, x2, y2] = m.handle
  const dots = lights.length === 1 ? [[m.cx, lights[0], m.dot * 1.5]] : lights.map((l, i) => [m.cx + (i - 1) * m.gap, l, m.dot])
  return (
    `<circle cx="${m.cx}" cy="${m.cy}" r="${m.r}" fill="none" stroke="${c.fg}" stroke-width="${m.ring}"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c.fg}" stroke-width="${m.grip}" stroke-linecap="round"/>` +
    dots.map(([x, l, r]) => `<circle cx="${n(x)}" cy="${m.cy}" r="${n(r)}" fill="${c[l]}"/>`).join('')
  )
}

// the word as one path, baseline at y = 0, in font units (1000 per em)
const TRACKING = -20
function wordPath(text) {
  const run = font.layout(text)
  let x = 0
  const parts = []
  run.glyphs.forEach((g, i) => {
    parts.push(g.path.scale(1, -1).translate(x, 0).toSVG())
    x += run.positions[i].xAdvance + (i < run.glyphs.length - 1 ? TRACKING : 0)
  })
  const width = x - run.positions.at(-1).xAdvance + run.glyphs.at(-1).bbox.maxX
  return { d: parts.join(''), width }
}

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" role="img" aria-label="spurlos"><title>spurlos</title>${body}</svg>\n`

// mark and word: the mark as tall as an ascender plus a bit, sitting on the baseline like the word
function logo(c) {
  const word = wordPath('spurlos')
  const asc = font.ascent * 0.8 // top of l and the like
  const desc = -font.descent * 0.6 // bottom of p
  const pad = 30
  const gap = 150
  const h = (asc + desc) * 1.02
  const s = h / BOX.h
  const markW = BOX.w * s
  const baseY = pad + asc
  const top = baseY - asc - (h - asc - desc) / 2
  const mark = `<g transform="translate(${n(pad - BOX.x * s)} ${n(top - BOX.y * s)}) scale(${n(s)})">${markEls(MARK, c)}</g>`
  const text = `<path transform="translate(${n(pad + markW + gap)} ${n(baseY)})" fill="${c.fg}" d="${word.d}"/>`
  return svg(pad + markW + gap + word.width + pad, pad + asc + desc + pad, mark + text)
}

// only the mark, tightly cut
const mark = c => svg(BOX.w + 4, BOX.h + 4, `<g transform="translate(${2 - BOX.x} ${2 - BOX.y})">${markEls(MARK, c)}</g>`)

// tile for avatars and app icons; small sizes get a single green light, three would blur into one
const tile = (m, lights, inset) => {
  const s = (64 - 2 * inset) / BOX.w
  return svg(64, 64, `<rect width="64" height="64" rx="14" fill="${C.tile}"/><g transform="translate(${n(inset - BOX.x * s)} ${n(inset - BOX.y * s)}) scale(${n(s)})">${markEls(m, C.dark, lights)}</g>`)
}

const out = new URL('../assets/', import.meta.url)
fs.mkdirSync(out, { recursive: true })
const files = {
  'logo-dark.svg': logo(C.dark),
  'logo-light.svg': logo(C.light),
  'mark-dark.svg': mark(C.dark),
  'mark-light.svg': mark(C.light),
  'icon.svg': tile(MARK, ['red', 'yellow', 'green'], 9),
  // one per light, e.g. as a status badge: green when spurlos finds nothing, red when it finds something
  'icon-small-green.svg': tile(SMALL, ['green'], 5),
  'icon-small-yellow.svg': tile(SMALL, ['yellow'], 5),
  'icon-small-red.svg': tile(SMALL, ['red'], 5),
}
for (const [name, content] of Object.entries(files)) fs.writeFileSync(new URL(name, out), content)

// GitHub's social preview: 1280 × 640, with the logo and what spurlos does
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } })
await page.setContent(`<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; width: 1280px; height: 640px; background: ${C.tile}; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 44px;
         font: 500 34px/1.35 -apple-system, "Segoe UI", system-ui, sans-serif; color: #a9abb6 }
  img { width: 760px }
  p { margin: 0; text-align: center }
</style><img src="data:image/svg+xml;base64,${Buffer.from(files['logo-dark.svg']).toString('base64')}">
<p>Was eine Website vor dem ersten Klick verrät:<br>fremde Server, Cookies, Header, Formulare</p>`)
await page.screenshot({ path: new URL('social.png', out).pathname })
await browser.close()
console.log([...Object.keys(files), 'social.png'].join('\n'))
