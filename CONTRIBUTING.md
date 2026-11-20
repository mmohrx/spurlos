# Mitmachen

Danke, dass du spurlos besser machen willst. Issues und Pull Requests dürfen auf Deutsch oder Englisch sein.

## Am häufigsten: ein Dienst fehlt

spurlos meldet einen Host oder ein Cookie als „unbekannt“, obwohl du weißt, wozu es gehört? Dann trag den Dienst in [`src/services.json`](src/services.json) ein:

```json
{ "name": "Matomo", "category": "tracking", "hosts": ["matomo.cloud"], "cookies": ["_pk_id", "_pk_ses"] }
```

- `category`: `fonts`, `tracking`, `video`, `maps`, `captcha`, `cdn`, `necessary` (für den Betrieb nötig, etwa ein CSRF-Token) oder `other`
- `hosts` gelten samt Subdomains, `cookies` als Anfang des Namens (`_pk_id` deckt auch `_pk_id.1.abcd` ab), mit `*` vorn als Ende (`*-session`). Einträge im Browser-Speicher stehen unter `storage`.
- Nenn im Pull Request eine Quelle, etwa die Doku des Anbieters, die Host oder Cookie belegt.

## Fehler und Ideen

Öffne ein Issue mit der Vorlage. Bei einem Fehler hilft die Ausgabe von `spurlos <url> --json`; kürze darin, was du nicht teilen magst.

Neue Prüfungen müssen passiv bleiben: spurlos ruft die Seite so auf wie ein Besucher und rät keine Pfade wie `/.env` oder `/wp-admin`. Ideen, die darüber hinausgehen, nehme ich nicht auf, auch wenn sie nützlich wären.

## Entwickeln

```
pnpm install
pnpm exec playwright install chromium-headless-shell
node src/cli.ts <url>
```

Vor dem Pull Request:

```
pnpm typecheck
pnpm test       # läuft ohne Netz gegen test/sites
```

- Eine neue Prüfung bekommt einen Fall in `test/sites/` und eine Zeile in der Ampel-Tabelle im README.
- Jede Meldung im Bericht gibt es auf Deutsch und Englisch, in [`src/report.ts`](src/report.ts).
- Ändert sich der Bericht, `pnpm examples` laufen lassen und `examples/` mit committen.

## Lizenz

Mit deinem Beitrag stimmst du zu, dass er unter der [MIT-Lizenz](LICENSE) des Projekts steht.
