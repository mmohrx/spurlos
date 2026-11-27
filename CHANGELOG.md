# Changelog

## Unreleased

- The Docker image and the action now run on Node 26, the current LTS, instead of Node 24.

## 0.6.0 – 2026-11-25

- Known services now carry where their provider has its seat (`country` in `services.json`, that of the parent company), for 193 of 247. The check "Third-party servers" names those based outside the EU and the EEA with their country, such as "United States: Google Analytics, Meta Pixel". It is the company's seat, not where its servers stand, and changes no light.
- The check "Third-party servers" names the videos, maps and social media posts a page embeds as a frame that loads with the page, instead of behind a placeholder that waits for a click (`embeds` in `--json`). A frame the browser never asks for, such as one with `loading="lazy"` further down, does not count. A frame from `youtube-nocookie.com` is named as such, with what it changes and what not. Google Maps embedded from `www.google.com/maps/embed` is now known as Google Maps, not only as Google.
- The check "Third-party servers" now reads the buttons a cookie banner shows without a click, on the page or in a frame from the server of a known banner provider, and says whether one refuses next to the one that agrees. If only agreeing takes one click, the finding is yellow. spurlos knows the buttons by their words in German and English and clicks none of them. In `--json`, the result has `banner` with `accept` and `reject`, the scan the texts of the buttons under `banner`.
- Hotjar, Microsoft Clarity, FullStory, Mouseflow, Smartlook, Lucky Orange and Crazy Egg are now their own category, `session-replay`. They still count as trackers, and the check "Third-party servers" names them in a note of its own, since they record mouse movements, clicks and scrolling, depending on their settings also what someone types into form fields.
- Google reCAPTCHA is now recognized when it loads from `www.google.com/recaptcha/` or `www.gstatic.com/recaptcha/`, as on most sites. Before, those servers were only "Google" and red; now they are yellow like other captchas, and so is reCAPTCHA reading the browser's canvas or audio. A path in `services.json` now wins over a host entry of category `other`, if every request to that host names the same service: reCAPTCHA next to Google's ads on `www.google.com` stays Google, and red.
- An Impressum or privacy policy that a page shows as another element with `href`, such as a `<div href="/impressum">` a script opens on click, now counts as a link. Before, the report said "no link found on the page" although the footer had one.
- The check "Data passed on" now names a service by the path asked for too, as "Third-party servers" does: a leak to `www.google.com/recaptcha/` is Google reCAPTCHA, one to `/matomo.php` on an unknown server Matomo.
- With `--baseline`, every server of a known service that is new is now marked `[new]`, and has `baselineState` `new` in `--sarif`. Before, only the first was; the others counted as unchanged.
- A check now ends after 2 minutes at most. Before, a page that blocked its own rendering after loading, with a script that never ends, held the check for good: in the MCP server it kept one of the two slots, so two such pages stopped every later call, and in CI the job hung until its timeout.
- If printing the PDF fails, spurlos now says so, ends with exit code `2` instead of `1`, and still writes the other files of `-o`.

## 0.5.4 – 2026-11-25

- Google Tag Manager, Adobe Tags and Tealium iQ are now their own category, `tag-manager`. When only a tag manager loads before the cookie banner's choice, the report no longer says "the trackers above still load" but has a note of its own: it counts nothing itself, but starts trackers once the site is set up to. The server stays red. Tealium's collect server (`tealiumiq.com`) stays a tracker.
- New known services, found in a check of 1000 German websites: Salesforce Commerce Cloud Einstein, Google Merchant Center, BidSwitch, Index Exchange, an OpenAI pixel, Stape, PagePulse, New Relic, Pandectes (cookie banner), Eye-Able, Doofinder, Bazaarvoice, Reviews.io, Loox, Judge.me, Trustindex, DIRS21, Apotheken Umschau, IhreApotheken.de, Cloudflare Network Error Logging, Speed Kit, Duda, CM4all, and the session cookies of Salesforce Commerce Cloud, JTL-Shop and Magento. More servers and cookies for Google Ads (`www.google.de`, `NID`, `test_cookie`), Microsoft Advertising (`bat.bing.net`, `c.bing.com`, `MUID`), TikTok, Awin, Kameleoon, Google Maps and Trusted Shops (`etrusted.com`).
- A page that removes `window.localStorage` or `window.sessionStorage` is checked again; before, spurlos stopped with "Cannot read properties of undefined".

## 0.5.3 – 2026-11-24

- Without `--lang`, `SPURLOS_LANG` or a system language spurlos knows, the report is now in English instead of German. This applies in Docker, on CI runners (`C.UTF-8`), often for the MCP server, and for locales without texts such as `fr_FR`. A German system still gets German; elsewhere use `--lang de` or `SPURLOS_LANG=de`, and `lang: de` in the action.
- The README on GitHub and npm is now English; the German one is `README.de.md`. `CONTRIBUTING.md`, `SECURITY.md` and the issue and pull request templates are in English.
- The examples in `examples/` keep the bare names for English (`mit-maengeln.txt`, `vorschau.png`) and `.de` for German.

## 0.5.2 – 2026-11-24

- Die Action heißt jetzt „spurlos website check“, denn im GitHub Marketplace ist der Name „spurlos“ vergeben. `uses: mmohrx/spurlos@…` bleibt gleich.
- Jedes Release legt ein GitHub-Release mit dem Eintrag aus diesem Changelog an; in den GitHub Marketplace kommt es weiter von Hand (Edit, Haken setzen).

## 0.5.1 – 2026-11-24

- spurlos steht in der offiziellen MCP Registry als `io.github.mmohrx/spurlos`: `mcpName` in `package.json`, der Eintrag in `server.json`. Jedes Release veröffentlicht ihn nach dem npm-Paket.

## 0.5.0 – 2026-11-22

- Neue Prüfung „Datenschutzerklärung“ (`policy`): spurlos liest den Text der Datenschutzerklärung und sucht darin nach den bekannten Diensten, die vor dem ersten Klick laden; jeder, den er nicht nennt, ist gelb. Lässt sie sich nicht als Text lesen (PDF, per JavaScript geladen), bleibt es offen. In `services.json` neu `aliases` für andere Namen (`Facebook` für Meta Pixel). In `--json` unter `scan.policy` nur die Adresse und die genannten Dienste, nicht der Text.
- Weitergegebene Daten: Steht der Wert des Cookies eines fremden Servers in der Adresse einer Anfrage an einen dritten, ist das rot (Cookie-Sync, Werbe-Server tauschen ihre IDs aus); in `--json` als `what: "id"` mit dem Cookie unter `param` und `from`, an der Anfrage als `id:<cookie>@<domain>` unter `carries`.
- Unter der Datenmenge steht, wann der erste Inhalt zu sehen war und wann alles geladen war (unter einer Sekunde in ms), ohne Ampel; in `--json` unter `timing`.
- `--gpc`: die Seite mit Global Privacy Control aufrufen (`Sec-GPC: 1` bei jeder Anfrage, `navigator.globalPrivacyControl`); mit `--baseline` gegen einen Lauf ohne zeigt der Bericht, was wegfällt. Im MCP-Werkzeug `gpc`, in `--json` `gpc: true`.
- Google Consent Mode: Meldet eine Anfrage der Google-Tags vor jedem Klick Zustimmung (`gcs=G101`, `G110`, `G111`), ist das ein roter Befund bei „Fremde Server“; `G100` nennt der Bericht als Hinweis. In `--json` unter `consentMode`.
- Neue Prüfung „Suchmaschinen“ (`indexing`): `noindex` oder `none` in `X-Robots-Tag` oder `<meta name="robots">` (auch `googlebot`) ist gelb, etwa vergessen nach dem Livegang.
- `--sarif` (und `-o bericht.sarif`): die Befunde als SARIF 2.1.0 für GitHub Code Scanning, mit dem Schlüssel jedes Befunds als Fingerabdruck und, mit `--baseline`, `baselineState`. Die Action legt `report.sarif` ab, Pfad in der Ausgabe `sarif`.
- Neue Prüfung „Weitergegebene Daten“ (`leaks`): E-Mail-Adressen in Anfragen an fremde Server rot, Werte aus der Query der geprüften Adresse gelb (ohne Kampagnen-Parameter und Klick-IDs), etwa von einer Danke-Seite an Analytics. In `--json` je Anfrage unter `carries`.
- Nach dem Laden bewegt spurlos einmal die Maus und scrollt, ohne zu klicken: Viele Seiten halten Skripte, auch Tracker, bis zur ersten Bewegung zurück (etwa WP Rocket), und spurlos sah sie bisher nicht. Was erst dann kommt, markiert der Bericht mit „erst nach der ersten Bewegung“, `--json` mit `afterMove: true`.
- Cookies: Eines, das länger als 13 Monate gilt, ist mindestens gelb (`long: true` in `--json`); `SameSite=None` bei eigenen Cookies nennt der Bericht, ohne dass sich die Ampel ändert. In `--json` hat jedes Cookie `sameSite`.
- `--mobile`: die Seite als Smartphone aufrufen (Bildschirm eines Pixel 7, Touch, Kennung von Chrome auf Android mit `spurlos/<version>`); im MCP-Werkzeug `mobile`. Manche Seiten laden dort andere Tracker und Cookie-Banner.
- Neue Prüfung „Mobil“ (`mobile`): kein Viewport mit `width=device-width` und eine Seite, die breiter ist als das Fenster, je gelb.
- Fingerprinting erkennt auch WebRTC: Ein Skript, das über STUN oder TURN die IP-Adresse erfragt, ist ein Befund, die STUN- und TURN-Server zählen als fremde Server (`type: "webrtc"`).
- Fremde Server: Server, zu denen die Seite per `preconnect` (Markup oder `Link`-Header) vorab eine Verbindung aufbaut, zählen mit, auch ohne Anfrage („nur preconnect“, in `--json` `preconnect: true`).
- Fremde Server: WebSocket-Verbindungen zählen als Anfragen; vorher fehlten sie, etwa die eines Chats, weil Playwright sie getrennt meldet. In `--json` mit `type: "websocket"`.
- Neue Prüfung „Fingerprinting“ (`fingerprinting`): Skripte, die vor jedem Klick ein Canvas mit Text, die Grafikkarte über WebGL oder Audio im `OfflineAudioContext` auslesen. Rot bei einem fremden Skript, gelb bei einem eigenen, einem Captcha oder einem Server, der zur Seite zu gehören scheint. In `--json` unter `scan.fingerprinting` die Rohdaten.
- Neue Prüfung „Browser-Zugriffe“ (`access`): Skripte, die beim Laden nach Benachrichtigungen, Push, Standort, Kamera oder Mikrofon fragen oder einen Service Worker registrieren. Benachrichtigungen und Push gelb, Standort, Kamera und Mikrofon rot bei einem fremden Skript, sonst gelb; ein Service Worker grün.
- Neue Prüfung „Barrierefreiheit“ (`accessibility`): `lang` am `<html>`, Bilder ohne `alt`, Formularfelder ohne Beschriftung, ein Viewport, der Zoomen sperrt, je gelb; ein Link auf eine Erklärung zur Barrierefreiheit wird genannt. Nur Grundlagen, keine Aussage darüber, ob die Seite barrierefrei ist.
- Über den Prüfungen steht, wie viele Anfragen und Daten die Seite beim ersten Aufruf lädt und wie viel davon an andere Domains geht; in `--json` je Anfrage unter `bytes`.
- Öffnet Chromium eine Seite nicht, weil ihr Zertifikat ungültig ist oder ihr Server nur veraltete TLS-Versionen anbietet, sagt die Meldung das, statt die Meldung von Chromium zu zeigen.

## 0.4.0 – 2026-11-21

- Doku: Das README gibt den Überblick, die Einzelheiten zur Ampel, zur CI und dazu, wie spurlos aufruft, stehen in `docs/`.
- `--baseline <datei>`: mit einer früheren Ausgabe von `--json` vergleichen. Der Bericht markiert neue Befunde mit `[neu]` und listet, was weggefallen ist; Exit-Code 1 nur noch bei neuen roten Befunden. In `--json` unter `compare`.
- GitHub Action (`uses: mmohrx/spurlos@…`): prüft, schreibt den Bericht in die Zusammenfassung des Laufs und legt JSON, HTML und Text ab, auf Wunsch gegen eine Baseline.
- Mehrere Adressen in einem Lauf: `spurlos a.de b.de/kontakt`, je ein Bericht; in `--json` dann eine Liste, im HTML und PDF eine Seite mit allen.
- `-o` mehrmals: ein Lauf schreibt mehrere Formate, etwa `-o bericht.json -o bericht.html`; das Format nach der Endung, ohne `--json`, `--html` oder `--pdf`.
- Eine Anmeldung (`--auth`, `SPURLOS_AUTH`) gilt bei mehreren Adressen nur, wenn sie dieselbe Adresse (Schema, Host, Port) teilen.
- Neue Prüfung „Eingebundene Dateien“ (`resources`): Skripte, Stylesheets und Frames über http auf einer https-Seite rot, Bilder und Medien gelb; fremde Skripte und Stylesheets ohne `integrity` gelb.
- Sicherheits-Header: eine CSP, die Skripte durchlässt (`'unsafe-inline'` ohne Nonce oder Hash, `'unsafe-eval'`, `*`, `https:`, `http:`, `data:`, oder gar keine Regel für Skripte), ist gelb.
- Cookie-Banner erkannt (Usercentrics, Cookiebot, OneTrust, Borlabs Cookie, Complianz und weitere), samt Hinweis, wenn Tracker trotzdem vorher laden. Cookies, in denen der Banner die Wahl speichert, sind grün.
- Rot sind bei den Cookies nur noch fremde Domains und bekannte Tracker; bekannte Cookies etwa eines Chats oder Zahlungsanbieters sind gelb.
- Tipps im Bericht: Schriften und Bibliotheken selbst ausliefern, Einbettungen erst nach einem Klick laden, Beispielwerte für fehlende Header und HSTS.
- Bildschirmfoto der Seite beim ersten Aufruf im HTML- und PDF-Bericht.
- Fremde Server: Cookie-Banner und Captchas sind gelb statt rot, denn die Seite braucht sie; alle anderen bleiben rot.
- Eingebundene Dateien: Skripte, die nicht laufen (`type="text/plain"`, wie Cookie-Banner sie zurückhalten, oder `nomodule`), zählen nicht; Adressen im Bericht ohne Query, in der etwa API-Schlüssel stehen.
- `src/services.json` kennt rund 200 Dienste statt 25, mit neuen Kategorien (`analytics`, `consent`, `social`, `chat`, `payment`) und `paths` für Dienste auf der eigenen Seite.
- HTTPS: Antwortet http:// mit einem Fehler (4xx, 5xx), oft wegen eines Bot-Schutzes, ist das gelb statt rot; in `--json` als `http: "refused"`.
- Eigene Server auf anderen Domains (etwa `wikimedia.org` bei Wikipedia) sind gelb statt rot, ihre Cookies auch: mit `--own <host>`, laut Zertifikat der Seite oder dem Namen nach. Der Bericht nennt den Grund, `--json` ihn als `own`. Auch im MCP-Werkzeug (`own`) und in der Action (`own`). Bekannte Dienste gehören nie dazu, außer die Seite ist der Dienst selbst (`media.doctolib.com` auf `doctolib.de`).
- Impressum und Datenschutz: Weist die Seite spurlos ab (`401`, `403`, `429`) oder antwortet sie nicht vor dem Timeout, oft wegen eines Bot-Schutzes, ist das gelb statt rot; `404` und andere Fehler bleiben rot.
- Gleiche Formulare stehen im Bericht einmal, mit Anzahl (`2×`); `--json` und `--baseline` zählen weiter jedes.
- Links, Formulare und eingebundene Dateien im Shadow DOM zählen mit; vorher fehlten etwa Impressum und Datenschutz in Footern aus Web Components.
- Weist die Seite selbst den Aufruf mit `403` oder `429` ab, meist ein Bot-Schutz, prüft spurlos nicht die Fehlerseite, sondern endet mit Exit-Code 2 und sagt, woran es lag.
- Impressum oder Datenschutz als PDF zählen als erreichbar; vorher brach das Öffnen als Download ab.
- Bekannte Dienste auf der eigenen Seite, an ihren Pfaden erkannt (Matomo, Sentry, Plausible), nennt die Prüfung „Fremde Server“, ohne dass sich die Ampel ändert; in `--json` unter `selfHosted`. Fremde Hosts ohne bekannten Namen benennt spurlos so ebenfalls.
- HTTPS: Ob http auf https weiterleitet, fragt spurlos mit derselben Kennung ab wie die Seite, nicht mehr als Bot; DuckDuckGo etwa liefert einem Bot die Seite über http aus und meldete so zu Unrecht rot.
- `src/services.json`: Sentry, HolaCDN, Contentful, Bynder, Verint, Centinel, Tealium, Adobe Target und Experience Platform Tags, Mapp Intelligence (Webtrekk), Snowplow, Kameleoon, Dynamic Yield, trbo, Amazon Ads, Ogury, Commanders Act TrustCommander, Dynatrace, Statsig, Cloudinary, Contentstack, Builder.io, AWS WAF, Radware Bot Manager, Amazon Consent Signal, Permutive, Nielsen, Demandbase, Varify, Akamai mPulse, Datadog RUM, ipify, Google Sign-In, i18next, upscore, Braze, iSpot.tv, CleverPush, Queue-it, Wix und Shopify samt den Cookies, die sie selbst als nötig einstufen, Klaviyo, Mailchimp, Visitor Analytics, Ahrefs Web Analytics, Pandectes, Gist, Seal Subscriptions, Avada, RevenueHunt, CDNFonts, FuPa, Instafeed, Reputon, Wir sind Handwerk, straitpublish, COCO, Squarespace samt Statistik, Weglot, Elfsight, GloriaFood, Jimdo, Doctolib, DocMedico, ein Matomo bei vb-tool.de, Nuxt i18n, Triptease, GlobeRes, ReserveCloud, Marker.io, Promptwatch, ein Umami bei The Orange Studio, Plyr, DigitalOcean Spaces, Cloudflare Trace, Webflow, IONOS MyWebsite, OpenTable, Quandoo, Molzait, Matterport, Elementor, Polylang, eRecht24 Consent, instant.page, DSGVO All in One; Cookies von YouTube und ColdFusion; mehr Cookies und Speicher-Einträge von Pinterest, Complianz, WordPress, Adobe, Sourcepoint, Usercentrics, consentmanager, OneTrust, Snowplow, Cloudflare, Akamai und Centinel; alle `bm_`-Cookies des Akamai Bot Managers, das Cookie von reCAPTCHA.
- Impressum und Datenschutz: Ein Link, dessen Text mit dem Stichwort beginnt („Datenschutz“, „Privacy Policy“), geht einem vor, der es erst später nennt („About Swiss privacy“), und beide einem, bei dem nur die Adresse passt (Cookie-Einstellungen unter `/privacy/`). Skripte im Link zählen nicht mehr zu seinem Text.
- Fremde Server: Läuft die Seite auf Wix, Shopify, Squarespace, Webflow oder IONOS MyWebsite (erkannt an einem Header der Seite), sind deren Server und Cookies gelb statt rot, mit dem Grund „gehört zum Hoster der Seite“; sie liefern die Seite ohnehin aus. Apps und Tracker bleiben rot. In `--json` als `own: "platform"` und `platform` bei `third-party`; in `services.json` das Feld `headers`.
- `--baseline`: Die Server eines bekannten Dienstes zählen als ein Befund (Schlüssel `third-party nmrodam.com`), sodass eine neue zufällige Subdomain etwa von Nielsen oder Akamai mPulse nicht mehr als neuer roter Befund gilt. Der Bericht nennt die Hosts weiter einzeln.
- Antwortet die Seite gar nicht, sagt die Meldung „keine Antwort nach 30 Sekunden“ statt der Meldung von Playwright.

- README: Umgebungsvariablen auf einen Blick, Wartezeiten, keine Telemetrie, Basic Auth mit Docker.
- Links zum Unterstützen (Ko-fi, GitHub Sponsors) im README, in der Hilfe, in `package.json` und als Button auf GitHub.

## 0.3.0 – 2026-11-21

- `--html`: der Bericht als eigenständige HTML-Seite mit Logo, ohne JavaScript und ohne Nachladen, zum Weiterschicken.
- `--pdf`: derselbe Bericht als PDF, gedruckt vom vorhandenen Chromium, ohne neue Abhängigkeit. Beim Drucken ist JavaScript aus und jede Anfrage gesperrt.
- `-o`, `--output <datei>`: der Bericht in eine Datei, das Format nach der Endung (`-o bericht.pdf`).
- `--auth <benutzer:passwort>` oder `SPURLOS_AUTH`: Seiten hinter HTTP Basic Auth prüfen, etwa vor dem Livegang. Das Passwort geht nur an die geprüfte Adresse, nie an fremde Server und nicht mit der Prüfung über http. Eine fehlende oder abgelehnte Anmeldung endet mit Exit-Code 2 statt mit einem Bericht über die Fehlerseite.
- Die Hilfe zeigt das Logo, im Terminal mit farbigen Ampelpunkten.
- `spurlos mcp`: ein MCP-Server über stdio mit dem Werkzeug `scan`, damit KI-Assistenten Seiten selbst prüfen können. Ohne neue Abhängigkeit.
- Ohne `--lang` richtet sich die Sprache nach `SPURLOS_LANG`, dann nach der Sprache des Systems (`LC_ALL`, `LC_MESSAGES`, `LANG`), sonst Deutsch.
- Die Hilfe (`--help`) gibt es auch auf Englisch.
- Texte je Sprache in `src/lang/`, damit weitere Sprachen dazukommen können.

## 0.2.0 – 2026-11-20

- Bericht neu gestaltet: Bilanz als Plaketten, Mängel zuerst, Befunde als Baum, grüne Prüfungen einzeilig. `--verbose` (`-v`) zeigt alle Details. Farben nur im Terminal, nicht mit `NO_COLOR`.
- Was von der geprüften Seite stammt (Linktexte, Header, Cookie-Namen, Adressen), kann keine Steuerzeichen mehr ins Terminal schreiben.
- Beispielberichte in `examples/`, Logo in `assets/`.
- CONTRIBUTING, SECURITY, Vorlagen für Issues und Pull Requests.
- Chromium läuft in seiner Sandbox, wo das System eine erlaubt (Playwright schaltet sie sonst ab); ohne Sandbox ein Hinweis auf stderr. Downloads sind abgeschaltet.
- `--json` kommt in einer Pipe vollständig an; eine falsche Option endet mit Exit-Code 2 statt 1.
- Eine Weiterleitung auf eine andere Domain macht die angefragte Domain nicht mehr zum fremden Server.
- HSTS mit `max-age=0` zählt als fehlend, ein doppelt gesendeter `X-Content-Type-Options` als gesetzt.
- Als Datenschutzerklärung zählt zuerst ein Link auf der eigenen Seite, nicht der eines Cookie-Banners.
- Fehlermeldungen der CLI folgen `--lang`.

## 0.1.0 – 2026-11-20

Erste Version mit sieben passiven Prüfungen: fremde Server, Cookies und Speicher, Impressum und Datenschutz, HTTPS, Sicherheits-Header, Formulare, verratene Details. Bericht auf Deutsch und Englisch, `--json`, Exit-Code 0/1/2, Image auf ghcr.
