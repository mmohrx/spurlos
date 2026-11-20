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
  if (r.check === 'legal') {
    const name = { impressum: 'Impressum', datenschutz: 'Datenschutzerklärung' }
    const lines = r.pages.map(p => {
      if (!p.link) return `   ${name[p.kind]}: kein Link auf der Seite gefunden`
      const v = p.visit
      const state = !v ? 'nicht geprüft' : 'error' in v ? `nicht erreichbar (${v.error})` : v.status < 300 ? 'erreichbar' : `antwortet mit Status ${v.status}`
      return `   ${name[p.kind]}: „${p.link.text || p.link.href}“ → ${p.link.href} – ${state}`
    })
    return [`${LIGHT[r.level]} Impressum und Datenschutz: ${r.level === 'green' ? 'beide verlinkt und erreichbar.' : 'nicht vollständig.'}`, ...lines]
  }
  if (r.check === 'https') {
    const lines = [
      r.https ? null : '   Die Seite wird ohne HTTPS ausgeliefert. Alles, was Besucher eingeben, geht unverschlüsselt durchs Netz.',
      r.certDaysLeft === undefined
        ? null
        : r.certDaysLeft < 0
          ? '   Das Zertifikat ist abgelaufen.'
          : `   Zertifikat gültig für noch ${r.certDaysLeft} ${r.certDaysLeft === 1 ? 'Tag' : 'Tage'}.${r.certDaysLeft < 14 ? ' Prüfe, ob es automatisch erneuert wird.' : ''}`,
      r.http === 'redirects'
        ? '   http:// leitet auf https:// weiter.'
        : r.http === 'no-redirect'
          ? '   http:// liefert die Seite ohne Weiterleitung auf https:// aus.'
          : r.http === 'unreachable'
            ? '   Über http:// antwortet nichts. Wer die Adresse ohne https eintippt, landet womöglich im Leeren.'
            : null,
      r.https && !r.hsts ? '   Kein HSTS-Header (Strict-Transport-Security): Browser merken sich nicht, dass sie nur https nutzen sollen.' : null,
    ].filter((l): l is string => l !== null)
    return [`${LIGHT[r.level]} HTTPS: ${r.level === 'green' ? 'in Ordnung.' : r.level === 'yellow' ? 'mit Hinweisen.' : 'mit Mängeln.'}`, ...lines]
  }
  if (r.check === 'headers') {
    if (!r.missing.length) return [`${LIGHT.green} Sicherheits-Header: alle gesetzt.`]
    return [`${LIGHT.yellow} Sicherheits-Header: ${r.missing.length} von 5 fehlen.`, ...r.missing.map(m => `   ${m} fehlt`)]
  }
  if (r.check === 'forms') {
    if (!r.forms.length) return [`${LIGHT.green} Formulare: keine auf der Seite.`]
    const what = { unencrypted: 'sendet unverschlüsselt über http', 'third-party': 'sendet an einen fremden Server' }
    return [
      `${LIGHT[r.level]} Formulare: ${r.forms.length}.`,
      ...r.forms.map(f => `   ${f.method.toUpperCase()} ${f.action} – ${f.problem ? what[f.problem] : 'sendet verschlüsselt an die eigene Seite'}`),
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
