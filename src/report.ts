import { certLevel, cookieLevel, disclosureLevel, formLevel, httpLevel, legalLevel, storageLevel, type FormFinding, type HttpRedirect, type LegalKind, type Level, type Result } from './checks.ts'
import { styleText } from 'node:util'
import { VERSION, type Scan } from './scan.ts'

export type Lang = 'de' | 'en'

const LIGHT: Record<Level, string> = { green: '🟢', yellow: '🟡', red: '🔴' }
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const de = {
  disclaimer: 'Technische Vorprüfung – keine Rechtsberatung und keine Aussage darüber, ob die Seite DSGVO-konform ist.',
  openedAs: (url: string) => `aufgerufen als ${url}`,
  title: {
    'third-party': 'Fremde Server',
    cookies: 'Cookies und Speicher',
    legal: 'Impressum und Datenschutz',
    https: 'HTTPS',
    headers: 'Sicherheits-Header',
    forms: 'Formulare',
    disclosure: 'Verratene Details',
  } satisfies Record<Result['check'], string>,
  summary: {
    red: (n: number) => plural(n, 'Mangel', 'Mängel'),
    yellow: (n: number) => plural(n, 'Hinweis', 'Hinweise'),
    green: (n: number) => `${n} in Ordnung`,
  } satisfies Record<Level, (n: number) => string>,
  none: 'keine',
  verbose: 'Details auch zu den grünen Prüfungen: --verbose',
  quote: (s: string) => `„${s}“`,
  unsettled: 'Hinweis: Die Seite lud noch nach, als die Messung endete. Später geladene Anfragen fehlen hier womöglich.',

  thirdPartyNone: 'Beim Aufruf ging keine Anfrage an einen anderen Server.',
  thirdParty: 'Jeder davon erfährt beim Aufruf die IP-Adresse des Besuchers, noch bevor er etwas anklickt.',
  requests: (n: number) => plural(n, 'Anfrage', 'Anfragen'),

  cookiesNone: 'nichts gesetzt',
  cookies: (c: number, s: number) => `${plural(c, 'Cookie', 'Cookies')}, ${plural(s, 'Eintrag', 'Einträge')} im Browser-Speicher`,
  cookiesBefore: 'Gesetzt beim ersten Aufruf, bevor jemand etwas anklickt.',
  cookieOwn: 'eigen',
  cookieForeign: 'fremd',
  session: 'bis Sitzungsende',
  underADay: 'unter 1 Tag',
  days: (n: number) => plural(n, 'Tag', 'Tage'),
  cookiesReview: 'Keine bekannten Tracker. Prüfe bei den gelb markierten Einträgen, ob sie technisch nötig sind.',
  unknown: 'unbekannt',
  cookieMissing: (attrs: string[]) => `ohne ${attrs.join(' und ')}`,
  cookieMissingNote: 'Secure: Das Cookie geht auch über unverschlüsseltes http. HttpOnly: Skripte auf der Seite können die Sitzung auslesen.',
  disclosureNone: 'Weder Header noch Seite nennen die Software dahinter.',
  disclosure: (versions: number) => (versions ? `${plural(versions, 'Angabe', 'Angaben')} mit Versionsnummer` : 'nur Namen, keine Versionen'),
  disclosureWhy: 'Mit der Versionsnummer lässt sich gezielt nach bekannten Lücken suchen.',
  disclosureHeader: (name: string, value: string) => `Header ${name}: ${value}`,
  disclosureMeta: (value: string) => `<meta name="generator">: ${value}`,
  disclosureHint: 'Versionsnummern lassen sich meist abschalten, etwa mit expose_php = Off in PHP oder server_tokens off in nginx.',
  cookiesNecessary: 'Nur bekannte Einträge, wie sie Frameworks und Proxys für den Betrieb setzen.',

  legal: (green: boolean): string => (green ? 'beide verlinkt und erreichbar' : 'nicht vollständig'),
  legalName: { impressum: 'Impressum', datenschutz: 'Datenschutzerklärung' } satisfies Record<LegalKind, string>,
  legalNoLink: 'kein Link auf der Seite gefunden',
  legalNotChecked: 'nicht geprüft',
  legalUnreachable: (error: string) => `nicht erreichbar (${error})`,
  legalOk: 'erreichbar',
  legalStatus: (status: number) => `antwortet mit Status ${status}`,

  https: { green: 'in Ordnung', yellow: 'mit Hinweisen', red: 'mit Mängeln' } satisfies Record<Level, string>,
  noHttps: 'Die Seite wird ohne HTTPS ausgeliefert. Alles, was Besucher eingeben, geht unverschlüsselt durchs Netz.',
  certExpired: 'Das Zertifikat ist abgelaufen.',
  certDays: (n: number) => `Zertifikat gültig für noch ${plural(n, 'Tag', 'Tage')}.`,
  certRenew: ' Prüfe, ob es automatisch erneuert wird.',
  http: {
    redirects: 'http:// leitet auf https:// weiter.',
    'no-redirect': 'http:// liefert die Seite ohne Weiterleitung auf https:// aus.',
    unreachable: 'Über http:// antwortet nichts. Browser versuchen meist zuerst https, alte Links auf http:// laufen aber ins Leere.',
  } satisfies Record<HttpRedirect, string>,
  noHsts: 'Kein HSTS-Header (Strict-Transport-Security): Browser merken sich nicht, dass sie nur https nutzen sollen.',

  headersOk: 'alle gesetzt',
  headersMissing: (n: number) => `${n} von 5 fehlen`,
  headerMissing: (h: string) => `${h} fehlt`,

  formsNone: 'keine auf der Seite',
  forms: (n: number) => `${n}`,
  form: {
    unencrypted: 'sendet unverschlüsselt über http',
    'third-party': 'sendet an einen fremden Server',
    ok: 'sendet verschlüsselt an die eigene Seite',
  } satisfies Record<NonNullable<FormFinding['problem']> | 'ok', string>,
}

const en: typeof de = {
  disclaimer: 'Technical pre-check – not legal advice, and no statement on whether the site complies with the GDPR.',
  openedAs: url => `opened as ${url}`,
  title: {
    'third-party': 'Third-party servers',
    cookies: 'Cookies and storage',
    legal: 'Legal notice and privacy policy',
    https: 'HTTPS',
    headers: 'Security headers',
    forms: 'Forms',
    disclosure: 'Software details',
  },
  summary: {
    red: n => plural(n, 'problem', 'problems'),
    yellow: n => plural(n, 'note', 'notes'),
    green: n => `${n} fine`,
  },
  none: 'none',
  verbose: 'Details for the green checks too: --verbose',
  quote: s => `“${s}”`,
  unsettled: 'Note: the page was still loading when the measurement ended. Requests made later may be missing here.',

  thirdPartyNone: 'Opening the page sent no request to another server.',
  thirdParty: "Each of them learns the visitor's IP address on opening the page, before any click.",
  requests: n => plural(n, 'request', 'requests'),

  cookiesNone: 'nothing set',
  cookies: (c, s) => `${plural(c, 'cookie', 'cookies')}, ${plural(s, 'entry', 'entries')} in browser storage`,
  cookiesBefore: 'Set on the first visit, before any click.',
  cookieOwn: 'first-party',
  cookieForeign: 'third-party',
  session: 'until the session ends',
  underADay: 'under 1 day',
  days: n => plural(n, 'day', 'days'),
  cookiesReview: 'No known trackers. For the entries marked yellow, check whether they are technically necessary.',
  unknown: 'unknown',
  cookieMissing: attrs => `without ${attrs.join(' and ')}`,
  cookieMissingNote: 'Secure: the cookie also travels over unencrypted http. HttpOnly: scripts on the page can read the session.',
  disclosureNone: 'Neither headers nor the page name the software behind it.',
  disclosure: versions => (versions ? `${plural(versions, 'entry', 'entries')} with a version number` : 'names only, no versions'),
  disclosureWhy: 'A version number allows a targeted search for known holes.',
  disclosureHeader: (name, value) => `Header ${name}: ${value}`,
  disclosureMeta: value => `<meta name="generator">: ${value}`,
  disclosureHint: 'Version numbers can usually be switched off, e.g. with expose_php = Off in PHP or server_tokens off in nginx.',
  cookiesNecessary: 'Only known entries, as frameworks and proxies set them to run a site.',

  legal: green => (green ? 'both linked and reachable' : 'incomplete'),
  legalName: { impressum: 'Legal notice (Impressum)', datenschutz: 'Privacy policy' },
  legalNoLink: 'no link found on the page',
  legalNotChecked: 'not checked',
  legalUnreachable: error => `not reachable (${error})`,
  legalOk: 'reachable',
  legalStatus: status => `answers with status ${status}`,

  https: { green: 'fine', yellow: 'with notes', red: 'with problems' },
  noHttps: 'The page is served without HTTPS. Everything visitors enter travels the network unencrypted.',
  certExpired: 'The certificate has expired.',
  certDays: n => `Certificate valid for another ${plural(n, 'day', 'days')}.`,
  certRenew: ' Check that it renews automatically.',
  http: {
    redirects: 'http:// redirects to https://.',
    'no-redirect': 'http:// serves the page without redirecting to https://.',
    unreachable: 'Nothing answers on http://. Browsers mostly try https first, but old links to http:// lead nowhere.',
  },
  noHsts: 'No HSTS header (Strict-Transport-Security): browsers do not remember to use https only.',

  headersOk: 'all set',
  headersMissing: n => `${n} of 5 missing`,
  headerMissing: h => `${h} missing`,

  formsNone: 'none on the page',
  forms: n => `${n}`,
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

type Item = [Level, string]
/** a check as the report shows it: a short value next to the title, an explanation under it, then each finding with its own light */
type Section = { value: string; explain?: string; items?: Item[]; notes?: string[] }

function section(t: typeof de, r: Result, now: number): Section {
  switch (r.check) {
    case 'third-party':
      if (!r.hosts.length) return { value: t.none, explain: t.thirdPartyNone }
      return {
        value: `${r.hosts.length}`,
        explain: t.thirdParty,
        items: r.hosts.map(h => ['red', `${h.host}${h.service ? ` – ${h.service.name}` : ''} (${t.requests(h.requests)})`]),
      }

    case 'cookies': {
      if (!r.cookies.length && !r.storage.length) return { value: t.cookiesNone }
      const items: Item[] = [
        ...r.cookies.map((c): Item => {
          const notes = [
            c.thirdParty ? t.cookieForeign : t.cookieOwn,
            c.service?.name ?? t.unknown,
            lifetime(t, c.expires, now),
            ...(c.missing.length ? [t.cookieMissing(c.missing)] : []),
          ]
          return [cookieLevel(c), `Cookie ${c.name} (${c.domain}) – ${notes.join(', ')}`]
        }),
        ...r.storage.map((s): Item => [storageLevel(s), `${s.area}: ${s.key} – ${s.service?.name ?? t.unknown}`]),
      ]
      const unknown = r.storage.some(s => !s.service) || r.cookies.some(c => !c.service && !c.thirdParty)
      const note = unknown && r.level !== 'red' ? t.cookiesReview : r.level === 'green' ? t.cookiesNecessary : null
      const notes = [...(note ? [note] : []), ...(r.cookies.some(c => c.missing.length) ? [t.cookieMissingNote] : [])]
      return { value: t.cookies(r.cookies.length, r.storage.length), explain: t.cookiesBefore, items, notes }
    }

    case 'legal':
      return {
        value: t.legal(r.level === 'green'),
        items: r.pages.map((p): Item => {
          if (!p.link) return [legalLevel(p), `${t.legalName[p.kind]}: ${t.legalNoLink}`]
          const v = p.visit
          const state = !v ? t.legalNotChecked : 'error' in v ? t.legalUnreachable(v.error) : v.status < 300 ? t.legalOk : t.legalStatus(v.status)
          return [legalLevel(p), `${t.legalName[p.kind]}: ${t.quote(p.link.text || p.link.href)} → ${p.link.href} – ${state}`]
        }),
      }

    case 'https': {
      const items: (Item | null)[] = [
        r.https ? null : ['red', t.noHttps],
        r.certDaysLeft === undefined
          ? null
          : [certLevel(r.certDaysLeft), r.certDaysLeft < 0 ? t.certExpired : t.certDays(r.certDaysLeft) + (r.certDaysLeft < 14 ? t.certRenew : '')],
        r.http ? [httpLevel(r.http), t.http[r.http]] : null,
        r.https && !r.hsts ? ['yellow', t.noHsts] : null,
      ]
      return { value: t.https[r.level], items: items.filter((i): i is Item => i !== null) }
    }

    case 'headers':
      if (!r.missing.length) return { value: t.headersOk }
      return { value: t.headersMissing(r.missing.length), items: r.missing.map(m => ['yellow', t.headerMissing(m)]) }

    case 'disclosure': {
      if (!r.findings.length) return { value: t.none, explain: t.disclosureNone }
      const versions = r.findings.filter(d => d.version).length
      return {
        value: t.disclosure(versions),
        ...(versions ? { explain: t.disclosureWhy } : {}),
        items: r.findings.map((d): Item => [disclosureLevel(d), d.source === 'header' ? t.disclosureHeader(d.name, d.value) : t.disclosureMeta(d.value)]),
        ...(versions ? { notes: [t.disclosureHint] } : {}),
      }
    }

    case 'forms':
      if (!r.forms.length) return { value: t.formsNone }
      return { value: t.forms(r.forms.length), items: r.forms.map(f => [formLevel(f), `${f.method.toUpperCase()} ${f.action} – ${t.form[f.problem ?? 'ok']}`]) }
  }
}

const SEVERITY: Level[] = ['red', 'yellow', 'green']
/** in a terminal with colors the lights become colored marks, which line up better than emoji */
const MARK: Record<Level, string> = { red: '✖', yellow: '▲', green: '✔' }
const BADGE = { red: ['bgRed', 'white', 'bold'], yellow: ['bgYellow', 'black', 'bold'], green: ['bgGreen', 'black', 'bold'] } as const

export type TextOptions = { now?: number; color?: boolean; verbose?: boolean; width?: number }

/** words to lines of at most max characters; a longer word keeps a line of its own */
function wrap(s: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of s.split(' ')) {
    if (line && line.length + 1 + word.length > max) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  return [...lines, line]
}

/**
 * The report as text: the summary on top, then the checks, the worst first.
 * Red and yellow checks show their findings as a tree, green ones a single line unless verbose.
 * Explanations wrap to the width; findings keep one line each, so names and addresses stay whole.
 * With color, for a terminal: colored marks and badges; without, the same layout with emoji lights.
 */
export function text(scan: Scan, results: Result[], lang: Lang = 'de', options: TextOptions = {}): string {
  const { now = Date.now(), color = false, verbose = false, width = 80 } = options
  const t = MESSAGES[lang]
  type Format = Parameters<typeof styleText>[0]
  const style = (format: Format, s: string) => (color ? styleText(format, s, { validateStream: false }) : s)
  const mark = (l: Level) => (color ? style([l, 'bold'], MARK[l]) : LIGHT[l])
  const dot = (l: Level) => (color ? style(l, '●') : LIGHT[l])
  const titleWidth = Math.max(...Object.values(t.title).map(s => s.length))

  const counts = SEVERITY.map(level => [level, results.filter(r => r.level === level).length] as const).filter(([, n]) => n)
  const summary = color
    ? counts.map(([l, n]) => style(BADGE[l], ` ${t.summary[l](n).toLocaleUpperCase(lang)} `)).join(' ')
    : counts.map(([l, n]) => t.summary[l](n)).join(' · ')

  const block = (r: Result): string[] => {
    const s = section(t, r, now)
    const head = `${mark(r.level)} ${style('bold', t.title[r.check].padEnd(titleWidth))}  ${style(r.level, s.value)}`
    if (r.level === 'green' && !verbose) return [head]

    const items = s.items ?? []
    const tree = items.map(([l, text], i) => {
      // what follows the dash says what the finding is; dimmed, the thing itself stands out
      const dash = text.indexOf(' – ')
      const shown = dash > 0 ? text.slice(0, dash) + style('dim', text.slice(dash)) : text
      return `  ${style('dim', i === items.length - 1 ? '└─' : '├─')} ${dot(l)} ${shown}`
    })
    const indent = items.length ? '     ' : '  '
    const tail = [...(s.explain ? [s.explain] : []), ...(s.notes ?? [])].flatMap(note =>
      wrap(note, width - indent.length - 2).map((line, i) => `${indent}${style('dim', `${i ? ' ' : '→'} ${line}`)}`),
    )
    return [head, ...tree, ...tail]
  }

  // the worst first, so a reader sees at once what to fix; checks with the same light keep their order
  const sorted = [...results].sort((a, b) => SEVERITY.indexOf(a.level) - SEVERITY.indexOf(b.level))
  const blocks = sorted.map(block)
  // single lines stay together, anything longer gets air around it
  const body = blocks.flatMap((b, i) => (b.length > 1 || (blocks[i + 1]?.length ?? 0) > 1 || i === blocks.length - 1 ? [...b, ''] : b))
  const hidden = !verbose && results.some(r => r.level === 'green' && section(t, r, now).items?.length)

  return [
    `${style('bold', 'spurlos')} ${style('dim', VERSION)}  ${style('cyan', scan.finalUrl)}`,
    ...(scan.finalUrl !== scan.url ? [style('dim', t.openedAs(scan.url))] : []),
    summary,
    '',
    ...body,
    ...(scan.settled ? [] : [...wrap(t.unsettled, width).map(l => style('yellow', l)), '']),
    ...(hidden ? [style('dim', t.verbose)] : []),
    ...wrap(t.disclaimer, width).map(l => style('dim', l)),
  ].join('\n')
}
