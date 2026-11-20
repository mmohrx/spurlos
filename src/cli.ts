#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { runChecks } from './checks.ts'
import { MESSAGES, text, type Lang } from './report.ts'
import { scan } from './scan.ts'

const USAGE = `spurlos <url> [--lang de|en] [--json] [--user-agent <kennung>]

Ruft die Seite wie ein neuer Besucher auf, der nichts anklickt, und zeigt,
welche fremden Server dabei angefragt und welche Cookies gesetzt werden.

  --lang   Sprache des Berichts: de (Standard) oder en
  --json   Ergebnis als JSON statt als Text
  --user-agent  eigene Browserkennung für alle Aufrufe
  --help   diese Hilfe

Exit-Code: 0 ohne roten Befund, 1 mit rotem Befund, 2 bei einem Fehler.`

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { json: { type: 'boolean' }, lang: { type: 'string', default: 'de' }, 'user-agent': { type: 'string' }, help: { type: 'boolean', short: 'h' } },
})

const arg = positionals[0]
if (values.help || !arg) {
  console.log(USAGE)
  process.exit(values.help ? 0 : 2)
}

if (values.lang !== 'de' && values.lang !== 'en') {
  console.error(`spurlos: --lang kennt nur de und en, nicht ${values.lang}.`)
  process.exit(2)
}
const lang: Lang = values.lang

let url: string
try {
  url = new URL(/^https?:\/\//.test(arg) ? arg : `https://${arg}`).href
} catch {
  console.error(`spurlos: ${arg} ist keine gültige Adresse.`)
  process.exit(2)
}

try {
  const ua = values['user-agent']
  const s = await scan(url, ua ? { userAgent: ua } : {})
  const results = runChecks(s)
  console.log(values.json ? JSON.stringify({ scan: s, results, note: MESSAGES[lang].disclaimer }, null, 2) : text(s, results, lang))
  process.exit(results.some(r => r.level === 'red') ? 1 : 0)
} catch (e) {
  console.error(`spurlos: ${url} ließ sich nicht prüfen: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(2)
}
