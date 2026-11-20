import type { Level, Result } from './checks.ts'
import type { Scan } from './scan.ts'

const LIGHT: Record<Level, string> = { green: '🟢', yellow: '🟡', red: '🔴' }

export const DISCLAIMER = 'Technische Vorprüfung – keine Rechtsberatung und keine Aussage darüber, ob die Seite DSGVO-konform ist.'

function lifetime(expires: number, now: number): string {
  if (expires < 0) return 'bis Sitzungsende'
  const days = Math.round((expires * 1000 - now) / 86_400_000)
  return days < 1 ? 'unter 1 Tag' : days === 1 ? '1 Tag' : `${days} Tage`
}

function section(r: Result, now: number): string[] {
  if (r.check === 'third-party') {
    if (!r.hosts.length) return [`${LIGHT.green} Fremde Server: keine. Beim Aufruf ging keine Anfrage an einen anderen Server.`]
    return [
      `${LIGHT[r.level]} Fremde Server: ${r.hosts.length}. Jeder davon erfährt beim Aufruf die IP-Adresse des Besuchers, noch bevor er etwas anklickt.`,
      ...r.hosts.map(h => `   ${h.host}${h.service ? ` – ${h.service.name}` : ''} (${h.requests} ${h.requests === 1 ? 'Anfrage' : 'Anfragen'})`),
    ]
  }
  if (!r.cookies.length && !r.storage.length) return [`${LIGHT.green} Cookies und Speicher: nichts gesetzt.`]
  return [
    `${LIGHT[r.level]} Cookies und Speicher vor jedem Klick: ${r.cookies.length} ${r.cookies.length === 1 ? 'Cookie' : 'Cookies'}, ${r.storage.length} ${r.storage.length === 1 ? 'Eintrag' : 'Einträge'} im Browser-Speicher.`,
    ...r.cookies.map(c => {
      const notes = [c.thirdParty ? 'fremd' : 'eigen', c.service?.name, lifetime(c.expires, now)].filter(Boolean)
      return `   Cookie ${c.name} (${c.domain}) – ${notes.join(', ')}`
    }),
    ...r.storage.map(s => `   ${s.area}: ${s.key}`),
    ...(r.level === 'yellow' ? ['   Nur eigene Einträge ohne bekannten Tracker. Prüfe, ob sie technisch nötig sind.'] : []),
  ]
}

export function text(scan: Scan, results: Result[], now = Date.now()): string {
  return [
    `spurlos – ${scan.finalUrl}`,
    ...(scan.finalUrl !== scan.url ? [`(aufgerufen als ${scan.url})`] : []),
    '',
    ...results.flatMap(r => [...section(r, now), '']),
    ...(scan.settled ? [] : ['Hinweis: Die Seite lud noch nach, als die Messung endete. Später geladene Anfragen fehlen hier womöglich.', '']),
    DISCLAIMER,
  ].join('\n')
}
