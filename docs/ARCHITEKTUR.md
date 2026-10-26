# Architektur und Dateiformat

## Komponenten

- `src/domain.ts`: Personen, Partnerschaften, Validierung, Migration alter Strukturen, Datenänderungen.
- `src/merge.ts`: deterministischer Paar-/Personenabgleich, ID-Neuvergabe, Eltern- und Beziehungskonflikte; keine namensbasierte automatische Vereinigung.
- `src/MergeDialog.tsx` und `src/LibraryDialog.tsx`: Zusammenführungsassistent und lokale Stammbaum-Verwaltung.
- `src/layout.ts`: Generationen-/Nachbarschaftsanordnung und Szenengeometrie.
- `src/Tree.tsx`: SVG/D3-Verbindungen, Personen und Eingaben für Pan/Zoom/Zentrierung.
- `src/App.tsx`: React-Oberfläche, Dialoge, Rückgängig, personenbezogenes Kontextmenü für Vorfahren.
- `src/storage.ts`: native Tauri-Aufrufe; gesonderte IndexedDB-Vorschau für Browser-QA.
- `src-tauri/src/lib.rs`: erneute Validierung an der Vertrauensgrenze, SQLite, Fotodateien und Kryptografie.
- `src-tauri/tauri.conf.json`: Host, CSP, Paketierung und Fenster.

Die Dialog-Komponenten verwenden weiterhin dieselbe lokale Speicherung; das Zusammenführen erfolgt ohne Server.

Das Frontend verwendet ausschließlich gebündelte lokale Ressourcen. Fotos werden als geprüfte Daten-URLs dargestellt. Die Content Security Policy gestattet keine externen Webseiten oder Skripte. Native Befehle sind nur dem lokalen Hauptfenster zugänglich. Die App hat keine Konten, Telemetrie oder Cloud-Synchronisation.

## Domänenmodell, Version 2

`Family` enthält `version`, `name`, `members` und `unions`.

`Person` enthält ID, Name, Geburtstag, Sterbedatum, Ort, Erinnerungen, Geschlecht (`male`, `female` oder noch nicht zugeordnet), Foto und bis zu zwei Eltern-IDs. Ein älteres Darstellungsfeld wird beim Laden noch gelesen, im Profil aber nicht mehr angeboten. Aktuelle und frühere Partnerschaften liegen getrennt als `Union` vor.

Zusätzlich werden `firstName`, `lastName` und `birthName` als abwärtskompatible Namensfelder gespeichert. Rust verwendet beim Lesen alter Daten leere Standardwerte; das Frontend übernimmt bei Bedarf die Aufteilung des bisherigen `name`. `name` bleibt der vollständige aktuelle Name ohne Geburtsnamen; `displayName` ergänzt einen nichtleeren Geburtsnamen in Klammern zwischen Vor- und Nachname. JSON-basierte SQLite-Snapshots und verschlüsselte Exporte erhalten alle Felder ohne neue Datenbank-Schemaversion.

Die Verstorbenen-Markierung wird ausschließlich aus dem vorhandenen `died` abgeleitet: `Portrait` zeigt das Bild grau und halbdeckend, ohne Kreuz. `setDeathDate` validiert das neue Datum und lässt Beziehungen und Originalfoto unverändert; Entfernen des Datums nimmt die automatische Darstellung zurück. Dafür ist kein zusätzliches Statusfeld oder eine Datenbankmigration nötig. Kinderlos-Markierungen erhalten eine geometrische Ankerposition mittig zwischen `joint` und `branch`; die Beschriftung wird per `translate(-50%, -50%)` unabhängig von ihrer Textbreite zentriert.

`src/PhotoCrop.tsx` bietet den interaktiven Bildausschnitt; `src/photo.ts` berechnet dessen Quellrechteck. Erst nach Bestätigung erzeugt `resizePhoto` einen Ausschnitt mit höchstens 1024 Pixeln Kantenlänge. Die Kameraauswahl wird nicht mehr an `layoutFamily` gekoppelt: Fokusänderungen verschieben nur die Ansicht. SVG-Verbindungen enden an Karten-/Porträträndern; weiter entfernte ehemalige Partner erhalten eine Umleitung außerhalb ihrer Zeile. Die Skalierung erfolgt über CSS-Zoom statt über einen skalierten Transform-Layer.

`Union` enthält eine aus sortierten Personen-IDs gebildete ID (`a|b`), beide Beteiligten, Status `active`/`separated`, den optionalen Ehe-Status `marriage` (`unspecified`, `married`, `divorced`) und `ended` für einen kinderlosen Linienabschluss. Gemeinsame Kinder ergeben sich aus den beiden Eltern-IDs des Kindes. Eine neue Partnerschaft schreibt bestehende Elternzuordnungen nicht um.

Beide Anwendungsschichten prüfen Selbstverweise, fehlende Verweise, doppelte IDs und Eltern, Kreise, Datumsreihenfolge, aktive Mehrfachpartnerschaften und widersprüchliche kinderlose Markierungen. Rust-Deserialisierung und Backend-Prüfung gelten auch für importierte Dateien; die Benutzeroberfläche allein ist keine Sicherheitsgrenze.

## SQLite und Fotos

Datenbank `urinamu.sqlite`, WAL-Modus, `synchronous=FULL` und 10 Sekunden Busy-Timeout. Schema-Version: `PRAGMA user_version=2`. Bestehende Ein-Baum-Datenbanken werden transaktional übernommen; ihre Fotos und Revisionen bleiben erhalten. Datenbanken mit höherer Schema-Version werden abgewiesen. Ein Rückwechsel zu App-Version 0.1 nach dieser Migration wird nicht unterstützt.

- `trees`: getrennte Familien-IDs, Namen und Familienstände als JSON-Snapshots.
- `active_tree`: ID des geöffneten Baums.
- `current`: Snapshot des geöffneten Baums für kompatible interne Ladepfade.
- `revisions`: Zeitstempel in UTC, Änderungsbeschreibung, vollständiger JSON-Stand. Jeder Stand trägt `tree_id`; nach jedem Speichern bleiben maximal 100 Revisionen **je Baum** erhalten. Lesen und Wiederherstellen prüfen die Baum-Zugehörigkeit.

Fotobytes liegen außerhalb der Datenbank. Der Dateiname entsteht aus SHA-256 des Inhalts und dem Dateityp. Identische Fotos werden wiederverwendet; Datenbankstände enthalten relative `photo:<hash>.<ext>`-Referenzen. Die App löst sie beim Lesen auf. Neue Fotodateien werden vor dem Datenbank-Commit geschrieben; Baum, Auswahl, Current und Revision werden in **einer SQLite-Transaktion** aktualisiert. Neue Zusammenführungen erhalten eine neue Baum-ID; die Ausgangssnapshots werden nicht überschrieben. Bei fehlgeschlagenem Speichern bleibt die bisherige aktive Familie bestehen.

Fotos werden in diesem Stand konservativ behalten, auch wenn ältere Revisionen wegfallen. So werden keine noch benötigten Sicherungsbilder versehentlich gelöscht. Das kann langfristig Speicherplatz beanspruchen; eine referenzgeprüfte Bereinigung ist ein möglicher späterer Wartungsschritt.

Rückgängig/Wiederherstellen speichert ebenfalls neue Revisionen. Der Frontend-Zustand wird erst nach erfolgreichem Backend-Speichern übernommen. Die Browser-Vorschau verwendet Schema-Version 2, migriert ebenfalls bestehende Daten und verwendet eine eigene IndexedDB mit atomarem State-/History-Schreibvorgang. Sie ist nicht der Desktop-Speicher.

## Verschlüsselte Exportdatei `.urinamu`

UTF-8-JSON-Hülle, Klartext nur für technische Formatparameter; Familieninhalte vollständig verschlüsselt:

```json
{
  "format": "urinamu",
  "version": 2,
  "cipher": "AES-256-GCM",
  "kdf": "Argon2id",
  "memory": 19456,
  "iterations": 2,
  "parallelism": 1,
  "salt": "<Base64, 16 zufällige Bytes>",
  "iv": "<Base64, 12 zufällige Bytes>",
  "data": "<Base64, Ciphertext inklusive GCM-Tag>"
}
```

Argon2id Version 0x13, 19 MiB Speicher, zwei Durchläufe, ein Lane, 32-Byte-Schlüssel. Salt und Nonce kommen pro Export aus dem Betriebssystem-Zufallsgenerator. AES-GCM authentifiziert zusätzlich die feste Kennung `urinamu:2` als AAD. Die entschlüsselte Nutzlast ist das vollständige `Family`-Modell mit Fotos als Daten-URLs. Formatparameter werden vor Ableitung des Schlüssels auf genau die unterstützten Werte geprüft; eine manipulierte Datei kann keine beliebig teure KDF-Konfiguration vorgeben.

Import prüft Dateigröße (32 MiB), Hülle, Base64-Längen, Authentifizierung und zuletzt das vollständige Domänenmodell. Erst danach bietet die Oberfläche das Ersetzen der Familie an. Export läuft über eine zufällig benannte temporäre Datei im Zielverzeichnis mit `sync_all` und anschließendem Rename. Auf Windows wird in diesem Stand keine vorhandene Zieldatei ersetzt.

Passwörter, abgeleitete Schlüssel und Klartext-Bytepuffer werden im Rust-Kryptografiepfad mit `Zeroizing` behandelt. Das ist keine Garantie, dass alle Kopien in Webview-/Betriebssystemspeicher ausgelöscht sind. Kein Passwort-Logging und keine Wiederherstellungs-Hintertür.

### Import des Prototyps

Format `wurzeln`, Version 1, PBKDF2-HMAC-SHA256 mit exakt 310000 Durchläufen, AES-256-GCM, AAD `wurzeln:1`. Beziehungen aus `relationships` werden in `unions` übertragen, optionale Profilfelder ergänzt. Nicht mehr unterstützte Geschlechtswerte werden nicht automatisch einem Geschlecht zugeordnet. Neue Exporte verwenden ausschließlich das neue Format.

## Plattformgrenzen

Tauri nutzt WebView2 auf Windows, WebKitGTK 4.1 auf Linux und WKWebView auf macOS. Die gemeinsame Oberfläche ist plattformübergreifend; native Installer, Signierung, Dateidialoge, Webview-Unterschiede und Plattformkompatibilität müssen pro Zielsystem geprüft werden. Quellcode und Build-Konfiguration ersetzen diese Abnahme nicht.

## Merge-Regeln

Beide gewählten Verbindungen müssen im jeweiligen Quellbaum ausdrücklich `married` oder `divorced` sein. Die zwei Ankerpersonen werden bijektiv zugeordnet; die UI zeigt beide Zuordnungen und verlangt deren Bestätigung. Zusätzliche Abgleiche müssen ebenfalls eindeutig sein. Alle übrigen IDs der zweiten Quelle werden neu vergeben, selbst wenn gleichlautende IDs bereits im ersten Baum vorkommen. Sämtliche Verweise werden umgeschrieben.

Profilquelle, Elternstrategie und Beziehungsstrategie sind explizite Optionen. Nach Anwendung wird das komplette Ergebnis erneut validiert. Ein gemeinsames Kind hebt eine kinderlose Markierung auf. Das Ergebnis wird erst nach erfolgreicher Prüfung als neuer Stammbaum gespeichert; Originale werden nicht verändert. Die Datei-Version bleibt 2; fehlende Ehe-Information älterer Dateien wird als `unspecified` gelesen und nicht als Ehe interpretiert.
