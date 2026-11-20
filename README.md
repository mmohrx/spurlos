# spurlos

Ruft eine Website so auf wie ein neuer Besucher, der noch nichts angeklickt hat, und zeigt dir:

- **welche fremden Server** dabei angefragt werden, etwa Google Fonts, Tag Manager, YouTube oder ein CDN. Jeder davon erfährt die IP-Adresse des Besuchers.
- **welche Cookies und Einträge im Browser-Speicher** schon vor jeder Einwilligung gesetzt sind, und ob darunter bekannte Tracker oder Cookies fremder Domains sind.

```
$ npx spurlos beispiel-firma.de

spurlos – https://beispiel-firma.de/

🔴 Fremde Server: 2. Jeder davon erfährt beim Aufruf die IP-Adresse des Besuchers, noch bevor er etwas anklickt.
   fonts.googleapis.com – Google Fonts (1 Anfrage)
   fonts.gstatic.com – Google Fonts (2 Anfragen)

🟡 Cookies und Speicher vor jedem Klick: 1 Cookie, 0 Einträge im Browser-Speicher.
   Cookie PHPSESSID (beispiel-firma.de) – eigen, bis Sitzungsende
   Nur eigene Einträge ohne bekannten Tracker. Prüfe, ob sie technisch nötig sind.

Technische Vorprüfung – keine Rechtsberatung und keine Aussage darüber, ob die Seite DSGVO-konform ist.
```

spurlos nutzt einen echten Browser (Chromium über Playwright). Es findet also auch Anfragen und Cookies, die erst per JavaScript entstehen.

## Installation

Node.js 22 oder neuer. Beim ersten Mal braucht Playwright seinen Browser:

```
npx playwright install chromium-headless-shell
npx spurlos <url>
```

## Ampel

| Prüfung | 🟢 | 🟡 | 🔴 |
|---|---|---|---|
| Fremde Server | keine | – | mindestens eine Anfrage an eine andere Domain |
| Cookies und Speicher | nichts gesetzt | nur eigene Cookies oder Einträge ohne bekannten Tracker | Cookie einer fremden Domain oder eines bekannten Trackers |

Subdomains zählen zur eigenen Seite (`cdn.firma.de` gehört zu `www.firma.de`), dabei gilt die Public Suffix List (`firma.co.uk`).

## In der CI

```
npx spurlos https://staging.firma.de || echo "neue Spuren"
```

Exit-Code `0` ohne roten Befund, `1` mit rotem Befund, `2`, wenn die Seite sich nicht prüfen ließ. Mit `--json` kommt das vollständige Ergebnis samt aller Anfragen als JSON.

## Bekannte Dienste ergänzen

Welche Hosts und Cookies zu welchem Dienst gehören, steht in [`src/services.json`](src/services.json). Hosts gelten samt Subdomains, Cookie-Namen als Anfang (`_ga` deckt auch `_ga_ABC123` ab). Fehlt ein Dienst, freue ich mich über einen Pull Request.

## Was spurlos nicht tut

- Es klickt keinen Cookie-Banner an. Geprüft wird der Zustand vor jeder Entscheidung des Besuchers.
- Es bewertet keine Texte, also weder Impressum noch Datenschutzerklärung.
- Es gibt keine Rechtsberatung. Ein grüner Bericht heißt nicht, dass eine Seite DSGVO-konform ist, und ein roter nicht, dass sie es nicht ist.

## Entwickeln

```
pnpm install
pnpm exec playwright install chromium-headless-shell
pnpm test        # Unit-Tests und Browser-Tests gegen test/sites, ohne Netz
pnpm typecheck
pnpm build       # nach dist/
node src/cli.ts <url>
```

## Lizenz

MIT, © 2026 Martin Mohr
