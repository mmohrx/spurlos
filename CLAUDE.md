# spurlos

CLI, die eine Website wie ein neuer Besucher aufruft und zeigt, was vor dem ersten Klick passiert. Node 22+, TypeScript ohne Build-Schritt für die Entwicklung (`node src/cli.ts`), Playwright mit Chromium. Was es prüft und wie man es nutzt: `README.md`. Wie man beiträgt: `CONTRIBUTING.md`.

## Grundsätze

- Nur passive Prüfungen: die Seite aufrufen, Impressum und Datenschutz über ihre Links öffnen, http:// einmal anfragen. Keine Abfragen geratener Pfade wie `/.env`, `/.git/` oder `/wp-admin`, kein Ausfüllen von Formularen, keine Last.
- Der Browser gibt sich nicht als Mensch aus: `spurlos/<version>` steht in der Browserkennung, `navigator.webdriver` bleibt `true`.
- Keine Rechtsaussagen. Der Bericht sagt, was technisch passiert, nicht ob die Seite DSGVO-konform ist; der Hinweis „keine Rechtsberatung“ bleibt am Ende jedes Berichts.
- Keine neuen Abhängigkeiten ohne guten Grund. Farben im Terminal kommen aus `node:util`.

## Code

- Prüfungen und ihre Ampel: `src/checks.ts`. Eine neue Prüfung bekommt einen eigenen `check` im Typ `Result`, eine Zeile in der Ampel-Tabelle im README und einen Fall in `test/sites/`.
- Texte des Berichts: `src/report.ts`. Jede Meldung gibt es auf Deutsch (`de`) und Englisch (`en`) mit derselben Aussage; der Typ von `en` erzwingt, dass keine fehlt. Deutsch mit „du“, Anführungszeichen als Paar „…“.
- Bekannte Dienste: nur in `src/services.json`. Hosts gelten samt Subdomains, Cookie-Namen als Anfang, mit `*` vorn als Ende.
- Paketmanager ist pnpm (`packageManager` in `package.json`), nicht npm.

## Tests

- `pnpm test` läuft ohne Netz: `test/site.ts` liefert `test/sites/` unter `https://shop.example` aus und beantwortet jeden anderen Host leer. Neue Tests nutzen dasselbe, nie echte Websites.
- Vor jedem Commit: `pnpm typecheck && pnpm test`.
- Ändert sich der Bericht, danach `pnpm examples` und `examples/` mit committen, damit README-Bild und Beispielberichte zum Code passen.

## Logo

`scripts/logo.mjs` erzeugt alles in `assets/` (Anleitung im Kopf der Datei). Die Dateien dort nicht von Hand ändern.

## Release

Version in `package.json` erhöhen, Eintrag in `CHANGELOG.md`, dann Tag `vX.Y.Z` pushen. Der Workflow `release.yml` prüft, dass Tag und Version übereinstimmen, und veröffentlicht das Image auf ghcr. Tags und Releases nur nach Martins Freigabe.
