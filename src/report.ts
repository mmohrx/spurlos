import type { FormFinding, HttpRedirect, LegalKind, Level, Result } from './checks.ts'
import type { Scan } from './scan.ts'

export type Lang = 'de' | 'en'

const LIGHT: Record<Level, string> = { green: '🟢', yellow: '🟡', red: '🔴' }
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const de = {
  disclaimer: 'Technische Vorprüfung – keine Rechtsberatung und keine Aussage darüber, ob die Seite DSGVO-konform ist.',
  openedAs: (url: string) => `(aufgerufen als ${url})`,
  quote: (s: string) => `„${s}“`,
  unsettled: 'Hinweis: Die Seite lud noch nach, als die Messung endete. Später geladene Anfragen fehlen hier womöglich.',

  thirdPartyNone: 'Fremde Server: keine. Beim Aufruf ging keine Anfrage an einen anderen Server.',
  thirdParty: (n: number) => `Fremde Server: ${n}. Jeder davon erfährt beim Aufruf die IP-Adresse des Besuchers, noch bevor er etwas anklickt.`,
  requests: (n: number) => plural(n, 'Anfrage', 'Anfragen'),

  cookiesNone: 'Cookies und Speicher: nichts gesetzt.',
  cookies: (c: number, s: number) => `Cookies und Speicher vor jedem Klick: ${plural(c, 'Cookie', 'Cookies')}, ${plural(s, 'Eintrag', 'Einträge')} im Browser-Speicher.`,
  cookieOwn: 'eigen',
  cookieForeign: 'fremd',
  session: 'bis Sitzungsende',
  underADay: 'unter 1 Tag',
  days: (n: number) => plural(n, 'Tag', 'Tage'),
  cookiesReview: 'Nur eigene Einträge ohne bekannten Tracker. Prüfe, ob sie technisch nötig sind.',

  legal: (green: boolean) => `Impressum und Datenschutz: ${green ? 'beide verlinkt und erreichbar.' : 'nicht vollständig.'}`,
  legalName: { impressum: 'Impressum', datenschutz: 'Datenschutzerklärung' } satisfies Record<LegalKind, string>,
  legalNoLink: 'kein Link auf der Seite gefunden',
  legalNotChecked: 'nicht geprüft',
  legalUnreachable: (error: string) => `nicht erreichbar (${error})`,
  legalOk: 'erreichbar',
  legalStatus: (status: number) => `antwortet mit Status ${status}`,

  https: { green: 'HTTPS: in Ordnung.', yellow: 'HTTPS: mit Hinweisen.', red: 'HTTPS: mit Mängeln.' } satisfies Record<Level, string>,
  noHttps: 'Die Seite wird ohne HTTPS ausgeliefert. Alles, was Besucher eingeben, geht unverschlüsselt durchs Netz.',
  certExpired: 'Das Zertifikat ist abgelaufen.',
  certDays: (n: number) => `Zertifikat gültig für noch ${plural(n, 'Tag', 'Tage')}.`,
  certRenew: ' Prüfe, ob es automatisch erneuert wird.',
  http: {
    redirects: 'http:// leitet auf https:// weiter.',
    'no-redirect': 'http:// liefert die Seite ohne Weiterleitung auf https:// aus.',
    unreachable: 'Über http:// antwortet nichts. Wer die Adresse ohne https eintippt, landet womöglich im Leeren.',
  } satisfies Record<HttpRedirect, string>,
  noHsts: 'Kein HSTS-Header (Strict-Transport-Security): Browser merken sich nicht, dass sie nur https nutzen sollen.',

  headersOk: 'Sicherheits-Header: alle gesetzt.',
  headersMissing: (n: number) => `Sicherheits-Header: ${n} von 5 fehlen.`,
  headerMissing: (h: string) => `${h} fehlt`,

  formsNone: 'Formulare: keine auf der Seite.',
  forms: (n: number) => `Formulare: ${n}.`,
  form: {
    unencrypted: 'sendet unverschlüsselt über http',
    'third-party': 'sendet an einen fremden Server',
    ok: 'sendet verschlüsselt an die eigene Seite',
  } satisfies Record<NonNullable<FormFinding['problem']> | 'ok', string>,
}

const en: typeof de = {
  disclaimer: 'Technical pre-check – not legal advice, and no statement on whether the site complies with the GDPR.',
  openedAs: url => `(opened as ${url})`,
  quote: s => `“${s}”`,
  unsettled: 'Note: the page was still loading when the measurement ended. Requests made later may be missing here.',

  thirdPartyNone: 'Third-party servers: none. Opening the page sent no request to another server.',
  thirdParty: n => `Third-party servers: ${n}. Each of them learns the visitor's IP address on opening the page, before any click.`,
  requests: n => plural(n, 'request', 'requests'),

  cookiesNone: 'Cookies and storage: nothing set.',
  cookies: (c, s) => `Cookies and storage before any click: ${plural(c, 'cookie', 'cookies')}, ${plural(s, 'entry', 'entries')} in browser storage.`,
  cookieOwn: 'first-party',
  cookieForeign: 'third-party',
  session: 'until the session ends',
  underADay: 'under 1 day',
  days: n => plural(n, 'day', 'days'),
  cookiesReview: 'Only first-party entries without a known tracker. Check whether they are technically necessary.',

  legal: green => `Legal notice and privacy policy: ${green ? 'both linked and reachable.' : 'incomplete.'}`,
  legalName: { impressum: 'Legal notice (Impressum)', datenschutz: 'Privacy policy' },
  legalNoLink: 'no link found on the page',
  legalNotChecked: 'not checked',
  legalUnreachable: error => `not reachable (${error})`,
  legalOk: 'reachable',
  legalStatus: status => `answers with status ${status}`,

  https: { green: 'HTTPS: fine.', yellow: 'HTTPS: with notes.', red: 'HTTPS: with problems.' },
  noHttps: 'The page is served without HTTPS. Everything visitors enter travels the network unencrypted.',
  certExpired: 'The certificate has expired.',
  certDays: n => `Certificate valid for another ${plural(n, 'day', 'days')}.`,
  certRenew: ' Check that it renews automatically.',
  http: {
    redirects: 'http:// redirects to https://.',
    'no-redirect': 'http:// serves the page without redirecting to https://.',
    unreachable: 'Nothing answers on http://. Someone typing the address without https may end up nowhere.',
  },
  noHsts: 'No HSTS header (Strict-Transport-Security): browsers do not remember to use https only.',

  headersOk: 'Security headers: all set.',
  headersMissing: n => `Security headers: ${n} of 5 missing.`,
  headerMissing: h => `${h} missing`,

  formsNone: 'Forms: none on the page.',
  forms: n => `Forms: ${n}.`,
  form: {
    unencrypted: 'sends unencrypted over http',
    'third-party': 'sends to a third-party server',
    ok: 'sends encrypted to the site itself',
  },
}

export const MESSAGES: Record<Lang, typeof de> = { de, en }

function lifetime(t: typeof de, expires: number, now: number): string {
  if (expires < 0) return t.session
  const days = Math.round((expires * 1000 - now) / 86_400_000)
  return days < 1 ? t.underADay : t.days(days)
}

const indent = (lines: string[]) => lines.map(l => `   ${l}`)

function section(t: typeof de, r: Result, now: number): string[] {
  const head = (s: string) => `${LIGHT[r.level]} ${s}`
  switch (r.check) {
    case 'third-party':
      if (!r.hosts.length) return [head(t.thirdPartyNone)]
      return [head(t.thirdParty(r.hosts.length)), ...indent(r.hosts.map(h => `${h.host}${h.service ? ` – ${h.service.name}` : ''} (${t.requests(h.requests)})`))]

    case 'cookies':
      if (!r.cookies.length && !r.storage.length) return [head(t.cookiesNone)]
      return [
        head(t.cookies(r.cookies.length, r.storage.length)),
        ...indent([
          ...r.cookies.map(c => {
            const notes = [c.thirdParty ? t.cookieForeign : t.cookieOwn, c.service?.name, lifetime(t, c.expires, now)].filter(Boolean)
            return `Cookie ${c.name} (${c.domain}) – ${notes.join(', ')}`
          }),
          ...r.storage.map(s => `${s.area}: ${s.key}`),
          ...(r.level === 'yellow' ? [t.cookiesReview] : []),
        ]),
      ]

    case 'legal':
      return [
        head(t.legal(r.level === 'green')),
        ...indent(
          r.pages.map(p => {
            if (!p.link) return `${t.legalName[p.kind]}: ${t.legalNoLink}`
            const v = p.visit
            const state = !v ? t.legalNotChecked : 'error' in v ? t.legalUnreachable(v.error) : v.status < 300 ? t.legalOk : t.legalStatus(v.status)
            return `${t.legalName[p.kind]}: ${t.quote(p.link.text || p.link.href)} → ${p.link.href} – ${state}`
          }),
        ),
      ]

    case 'https': {
      const cert =
        r.certDaysLeft === undefined ? null : r.certDaysLeft < 0 ? t.certExpired : t.certDays(r.certDaysLeft) + (r.certDaysLeft < 14 ? t.certRenew : '')
      const lines = [r.https ? null : t.noHttps, cert, r.http ? t.http[r.http] : null, r.https && !r.hsts ? t.noHsts : null]
      return [head(t.https[r.level]), ...indent(lines.filter((l): l is string => l !== null))]
    }

    case 'headers':
      if (!r.missing.length) return [head(t.headersOk)]
      return [head(t.headersMissing(r.missing.length)), ...indent(r.missing.map(t.headerMissing))]

    case 'forms':
      if (!r.forms.length) return [head(t.formsNone)]
      return [head(t.forms(r.forms.length)), ...indent(r.forms.map(f => `${f.method.toUpperCase()} ${f.action} – ${t.form[f.problem ?? 'ok']}`))]
  }
}

export function text(scan: Scan, results: Result[], lang: Lang = 'de', now = Date.now()): string {
  const t = MESSAGES[lang]
  return [
    `spurlos – ${scan.finalUrl}`,
    ...(scan.finalUrl !== scan.url ? [t.openedAs(scan.url)] : []),
    '',
    ...results.flatMap(r => [...section(t, r, now), '']),
    ...(scan.settled ? [] : [t.unsettled, '']),
    t.disclaimer,
  ].join('\n')
}
