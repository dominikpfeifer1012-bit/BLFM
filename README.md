# Bundesliga Karrieremodus

Ein Fussballmanager, der komplett im Browser laeuft. Kein Server, kein Build,
keine Abhaengigkeiten zur Laufzeit: HTML oeffnen und spielen.

## Starten

**Empfohlen — ueber GitHub Pages:** In den Repository-Einstellungen unter
*Pages* den Branch `main` und den Ordner `/ (root)` waehlen. Danach laeuft das
Spiel unter `https://<name>.github.io/<repository>/` und alle Speicher-
funktionen arbeiten. Auf dem Handy laesst es sich zum Startbildschirm
hinzufuegen und startet dann ohne Browserleiste.

**Direkt oeffnen:** `index.html` doppelklicken. Manche Browser blockieren dabei
den lokalen Speicher. Dann funktionieren die drei Speicherplaetze nicht, der
Export als Datei aber schon.

**Lokaler Server:**

```bash
python3 -m http.server 8000
# dann http://localhost:8000/
```

## Aufbau

```
index.html                      Oberflaeche und Einstiegspunkt
manifest.json                   Angaben fuer den Startbildschirm
modules/                        32 Module, klassische Skripte ohne Bundler
  config.js                     Alle Konstanten und Ligadefinitionen
  players.js  squad.js          Spieler, Attribute, Kader, Aufstellung
  development.js  morale.js     Entwicklung und Zufriedenheit
  pool.js  transfermarkt.js     Weltbestand und Transfers
  match.js  league.js  cup.js   Simulation, Ligen, Pokal
  europe.js  board.js           Europapokal, Vorstand
  youth.js  facilities.js       Jugendkader, Investitionen
  press.js  records.js          Pressekonferenzen, Bestmarken
  ui-*.js                       Oberflaeche, nach Bereichen getrennt
  game-*.js                     Spielablauf, Zustand, Eingaben
  fonts.css                     Schriften lokal eingebettet
tests/                          Zehn Testsuiten fuer Node
```

Die Module werden als klassische Skripte geladen, nicht als ES-Module. Das ist
Absicht: ES-Module werden beim direkten Oeffnen einer Datei vom Browser
blockiert, das Spiel liesse sich dann nicht mehr per Doppelklick starten.

## Tests

```bash
npm install
npm test
```

Die Suiten laufen in Node gegen eine simulierte Seite (jsdom) und pruefen
Spiellogik, Balance und Oberflaeche. Sie spielen dabei komplette Saisons durch,
ein Durchlauf dauert daher einige Minuten.

## Was drin ist

Drei Ligen mit Auf- und Abstieg, DFB-Pokal, Europapokal mit Gruppenphase,
Weltbestand mit ueber 1200 Spielern, vier Spielerattribute, Vertraege,
Gehaelter, Vorstand mit Saisonziel und Entlassung, Jugendkader mit eigener
Mannschaft, Moral, Trainingsschwerpunkte, taktische Konter, Pressekonferenzen,
Investitionen in Stadion und Infrastruktur, Live-Simulation, Statistiken ueber
mehrere Saisons.

## Eigene Kaderdatei (echte Spieler und Trainer)

Das Spiel liefert keine echten Spielernamen mit. Wer mit echten Kadern spielen
möchte, lädt im Startbildschirm unter „Eigene Kaderdatei“ eine JSON-Datei. Sie
bleibt nur im eigenen Browser und gilt für neue Karrieren. Über „Vorlage
herunterladen“ gibt es eine Datei mit allen Vereinen zum Ausfüllen:

```json
{ "version": 1,
  "clubs": {
    "FC Bayern München": {
      "coach": "Name des Trainers",
      "strength": 92,
      "players": [ { "name": "Vorname Nachname", "pos": "ST", "age": 27, "strength": 90, "nat": "DE" } ]
    } } }
```

Positionen: TW, RV, IV, LV, DM, ZM, LM, RM, OM, ST. Fehlende Positionen werden
mit erzeugten Spielern aufgefüllt. Bitte eine solche Datei nicht öffentlich ins
Repository legen.

## Hinweise

Spielstaende liegen im Speicher des jeweiligen Browsers. Ein Stand vom Handy
ist am Rechner also nicht sichtbar. Dafuer gibt es den Export als Datei.

Vereinsnamen und Staerkewerte sind Schaetzungen und veralten mit jeder Saison.
Sie stehen gesammelt in `modules/config.js` und lassen sich dort anpassen.

Die eingebetteten Schriften (Barlow, Barlow Condensed, IBM Plex Mono) stehen
unter der SIL Open Font License.
