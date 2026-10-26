# Prüfstatus

Dieses Dokument unterscheidet ausgeführte Prüfungen von vorbereiteten Builds.

## Application version 0.4.2, 2026-10-25

- Birth dates display in full as DD.MM.YYYY across cards, member lists and tapestry ribbons. The date line moves closer to the name (3px card margin; ribbon baseline y=62).
- Passed: 41 frontend/model tests, TypeScript/production build, version consistency and the profile/canvas browser regression with a full-birth-date display check. No new native installer was built.

## Application version 0.4.1, 2026-10-25

- Deceased portraits use grayscale and half opacity, without a cross. The original stored photo is unchanged.
- Passed: TypeScript/production build, version consistency check and the existing profile/canvas browser regression, including marking/unmarking death and persistence. No new native installer was built.

## Application version 0.4.0, 2026-10-25

- Divorce and adding partners preserve existing card positions and viewport. New partners use the nearest free side; partner placeholders reserve non-overlapping positions. Collision spacing includes tapestry name ribbons.
- Drag individual people with live partner and child connections, without panning/recentering. Drop positions avoid other cards and persist independently per view. Legacy profiles without positions remain readable.
- Passed: 41 frontend/model tests, four versioning tests, 12 native Rust tests compiled as urinamu 0.4.0, TypeScript/production build and browser regression in all three views. Scenarios include three partnerships with separate children, stable divorce/new-partner placement, live drag paths, unchanged other cards/viewport, positions surviving reload, collision-safe drops and a single-step undo restoring all positions. Native tests verify SQLite/encrypted-exchange round trips and coordinate validation.
- Application versions are synchronized; third-party dependencies and family schema version 2 are unchanged. No new native installer was built.

## Application version 0.3.2, 2026-10-25

- Portrait crops support free drag beyond all image edges, 10–800% zoom, mouse-wheel zoom and reset. Movement works even when a square image initially fills the crop exactly.
- Saved PNG portraits preserve transparent uncovered areas. Original uploads are unchanged.
- Passed: 33 frontend/model tests, four versioning tests, TypeScript/production build and the full profile/canvas browser regression. Browser checks verify a 400px horizontal/370px vertical drag without clamping, wheel zoom below 100%, reset, transparent export margins with opaque center, and the selected image region surviving save/reload.
- No new native installer was built for this correction.

## Application version 0.3.1, 2026-10-25

- Restore native calendar selection alongside example-based date entry for birth dates, profile death dates and the dedicated death dialog.
- Wheel zoom keeps the world point under the mouse fixed. Remove delayed position transitions; card positions and SVG path geometry remain unchanged.
- Passed: 32 frontend/model tests, four versioning tests, TypeScript/production build, and the full browser regression. Additional browser checks open the native calendar, synchronize a calendar-selected ISO date with the text field, and check the off-center mouse anchor after each wheel step and a zoom round trip.
- No new native installer was built for this correction.

## Application version 0.3.0, 2026-10-25

- Application version advanced from 0.2.1 to 0.3.0 for the accumulated compatible feature changes. npm manifests/locks, Tauri configuration and the Rust application crate/lock entry agree. Third-party dependency versions and family-file schema version 2 were not changed by this bump.
- The header badge shows the build-injected version before any tree is opened. Clicking it opens version/build details with the actual build timestamp and execution mode. Sidebar/footer share the same value. The browser check verifies this and badge placement in a 375-pixel-wide viewport.
- `npm run version:bump -- patch|minor|major` updates application versions together. `version:check` runs before tests/builds/desktop commands; `version:sync` recovers an interrupted update using package.json. CHANGELOG.md records release contents, and AGENTS.md requires suitable bumps for future behavior changes.
- Passed: 32 frontend/model tests, four versioning tests, 11 Rust tests compiled as urinamu 0.3.0, frontend production build, and the full profile/canvas/version browser regression with synthetic data. Native installer/graphical acceptance remains a separate target-platform check.

## Profile and canvas update, 2026-10-25

- Given name, surname and optional birth name are preserved in SQLite and encrypted exchange. Legacy profiles and both existing encrypted compatibility fixtures remain readable.
- Interactive portrait cropping supports drag, zoom and horizontal/vertical sliders. A browser check uses a generated red/green image and verifies that the selected green region, rather than the default center, is saved and survives reload.
- Date fields use example placeholders, remain empty until entered, and convert explicit calendar dates to ISO storage.
- Clicking a card only pans the viewport. Browser checks confirm unchanged card positions and SVG path geometry in classic, horizontal and tapestry views, and retain the current zoom.
- Relationship endpoints are attached to card/portrait boundaries. Long former-partner links are routed outside the row. Divorced relationships remain visible without children; right-click actions support recording divorce and adding a new partner.
- Ancestor entry now creates one placeholder, followed by the entered ancestor's single partner slot. The browser regression verifies the second parent's child assignment even after centering the first ancestor. Person removal is available through the context menu; removal and death-date changes require named confirmation. Cancelling leaves data unchanged, and confirmed removal supports undo.
- Validation passed: **32 frontend/model tests**, **11 native Rust tests**, TypeScript/production build, and the browser regression in `scripts/profile-canvas-qa.cjs` against an isolated built preview with synthetic data. No new dependencies were added. The death-date and childless-badge extension adds checks for invalid/pre-birth dates, unchanged relationships, removing a death date, and orientation-independent badge anchors.
- Native desktop-window and installer acceptance for these UI changes still require a fresh platform build; browser checks do not exercise native dialogs.

The older verification entries below describe earlier baselines and are retained as historical evidence.

## Nachgewiesen

- TypeScript-Prüfung und Vite-Produktionsbuild.
- 24 Vitest-Tests: Stammdaten, Kreise, doppelte Eltern, Chronologie, mehrere Partnerschaften, Trennung mit Kindern, Löschen, kinderlose Markierung, drei Layouts und Neuanordnung um die Bezugsperson sowie Reihenfolge der Familienzweige.
- Zehn Rust-Tests: Validierung, echte SQLite-Transaktionen, Fotodateien, Revisionen, Verschlüsselungs-Roundtrip, Ablehnung falscher Passwörter und veränderter Ciphertexte, Import des alten Prototypformats.
- Browser-Merge-QA: Ehepaare ausdrücklich auswählen, doppelte Kinder zuordnen, dritten Baum anlegen, beide Originale unverändert öffnen, getrennte Sicherungen, Baumwechsel/Neustart und Familienstand ändern.
- Browser-QA in Chromium: Klickzentrierung, Vorfahren-Ergänzung per Rechtsklick an/aus, Vorfahren speichern, Trennung, neue Partnerschaft, Undo/Redo, Neuladen, ungespeicherte Änderungen abbrechen, Profil speichern, Layoutwechsel und Verlauf.
- Erfolgreicher Linux-Release-Build und Debian-Paket `UriNamu_0.2.1_amd64.deb` (x64). Paketmetadaten und dynamische Bibliotheksauflösung geprüft; ein grafischer Start auf einem Linux-Zielrechner bleibt erforderlich.
- Erweiterte Browser-QA: Foto-Upload mit Speicherung über Neuladen, kinderlose Linie abschließen/wieder öffnen und gemeinsames Kind hinzufügen.
- Vollständiges natives `cargo check --locked` für den Linux-Tauri-Host mit GTK/WebKitGTK aus isoliertem Debian-Snapshot.
- Veröffentlichungstermine aller gesperrten npm-/Cargo-Pakete gegen den Stichtag 18.10.2026. Nachweise in den beiden JSON-Auditdateien.

Zusätzliche Modelltests prüfen Paar-/Personenzuordnung, geschiedene Paare, Elternkonflikte, ID-Kollisionen und den Erhalt beider Originale. Weitere Rust-Tests prüfen getrennte Bäume/Revisionen, Migration einer bisherigen Datenbank und Ehe-Metadaten.

Zusätzliche Kompatibilitätsprüfung mit dem neuen Paketstand: ein unveränderter realer Browser-Export (`.wurzeln`) und ein unabhängig erzeugter Argon2id/AES-GCM-Testvektor (`.urinamu`) lassen sich entschlüsseln. Der bekannte SHA-256-Fotodateiname bleibt identisch. Alle Prüfungen werden mit Node 24.22.0 / npm 12.2.1 ausgeführt.

## Noch vor Veröffentlichung auf den Zielsystemen prüfen

- Windows: NSIS-Build, Erstinstallation, WebView2 vorhanden/nicht vorhanden, Startmenü, Umlaute im Windows-Benutzerpfad, echte native Datei-/Fotodialoge, Upgrade ohne Datenverlust.
- macOS: Build und Start auf Apple Silicon und Intel, native Dialoge, Datenordner, DMG, Signierung und Notarisierung.
- Linux: Paketinstallation auf der gewählten Mindestdistribution, Desktop-Start, WebKit-Rendering, Dateidialoge, Wayland/X11, AppImage/FUSE-Kompatibilität.
- Native End-to-End-Abnahme des Imports/Exports und Wiederherstellung aus einer Kopie auf einem zweiten Rechner. Kryptografie und Speicherung sind separat automatisiert getestet; der grafische native Dialogpfad ist dadurch nicht automatisch vollständig getestet.

Die GitHub-Actions-Datei ist vorbereitet und wird nur manuell gestartet. Es wurde nichts in ein externes Repository hochgeladen oder öffentlich veröffentlicht. Die früheren Linux-Prüfungen liefen ohne Einbindung des Windows-Projektordners; das automatische Setup wurde inzwischen zusätzlich direkt im Windows-Projekt geprüft, siehe unten.

## Automatisches Windows-Setup, 25.10.2026

- Vollständiger Lauf von `scripts/Setup-Windows.ps1` unter Windows x64 erfolgreich abgeschlossen. Einstieg für Nutzer: `Setup-Windows.cmd`.
- Node 24.22.0 und npm 12.2.1 unverändert weiterverwendet. Neuere vorhandene stabile Versionen werden laut Nutzeranforderung unabhängig vom Release-Alter akzeptiert; neu installierte/aktualisierte Versionen müssen strikt älter als sieben Tage sein.
- Vorhandene Microsoft Build Tools 17.14.37806.7 und WebView2 155.0.4283.62 korrekt erkannt und ohne Administratorfreigabe wiederverwendet. Der anfängliche Anführungszeichenfehler bei der Aktivierung und die verschachtelte vswhere-JSON-Liste unter PowerShell 5.1 sind behoben.
- Rust 1.99.1 in `.setup` installiert, Rustup-Selbstupdates abgeschaltet, Rustfmt installiert und `cargo fetch --locked` erfolgreich ausgeführt. Veröffentlichungsdaten der gesperrten npm-/Cargo-Abhängigkeiten vor Installation erneut gegen den dynamischen Sieben-Tage-Stichtag geprüft.
- `npm ci` erfolgreich: 54 Pakete installiert, keine von npm gemeldeten Schwachstellen.
- Aktivierte Umgebung praktisch geprüft: Node 24.22.0, npm 12.2.1, rustc/cargo 1.99.1; Compiler MSVC 14.44.35207 aus der ausgewählten Build-Tools-Instanz und Windows SDK 10.0.26100.0.
- Elf Setup-Tests erfolgreich, einschließlich vier Windows-/PowerShell-5.1-Regressionstests. Die zuvor ausgeführten 24 Frontend-Tests und der Frontend-Produktionsbuild waren ebenfalls erfolgreich.
- Native Fehler werden im aufrufenden Terminal und unter `.setup/native-install.log` bzw. `.setup/native-error.txt` sichtbar. UAC wird nur für tatsächlich erforderliche Systemänderungen angefordert.
- Weiter offen: vollständige Erstinstallation auf einem frischen Windows-Rechner, neue native Setup-Zweige auf Linux/macOS sowie Windows-App-Build und grafische Abnahme. Die oben dokumentierten früheren Linux-Builds ersetzen keine Prüfung des neuen Linux-Setup-Skripts.

## Auslieferungsstand 0.2.1

- Linux-Datei: `UriNamu_0.2.1_debian13_amd64.deb`. Gebaut auf Debian 13 x64; nicht als auf beliebigen Linux-Distributionen geprüft ausgeben.
- Quellpaket: `UriNamu-0.2.1-Quellcode.zip`. Enthält React/Rust-Quellen, gesperrte Abhängigkeiten, Icons, Dokumentation, Tests und Build-Skripte; keine Node-Module oder lokalen App-Daten.
- Windows- und macOS-Pakete sind **nicht** enthalten. Sie müssen auf den jeweiligen Systemen mit den beschriebenen Werkzeugen erzeugt und abgenommen werden.
- Die letzte Browser-Prüfung verwendet den Produktionsbuild aus `dist`, nicht bloß den Entwicklungsserver.

## Bibliotheksaktualisierung 0.2.1

- Alle direkten npm-/Cargo-Abhängigkeiten auf die zum geprüften Stichtag neuesten stabilen kompatiblen Freigaben aktualisiert; `d3-shape` bleibt auf seiner neuesten Freigabe 3.2.0.
- 108 npm- und 518 Cargo-Versionen vollständig geprüft; kein Release liegt nach dem Stichtag, keine Prereleases im gesperrten Graphen.
- Node 24.22.0, npm 12.2.1, Rust 1.99.1, rustup 1.29.1 tatsächlich verwendet; Freigabebelege unter `toolchain-release-audit.json`.
- 24 Frontend-Tests und zehn Rust-Tests bestanden. Zusätzliche feste Dateien prüfen alte `.wurzeln`-Exporte und unabhängig erzeugte `.urinamu`-Daten; SHA-256-Fotodateinamen bleiben identisch.
- Beide Browser-Prüfungen mit dem neuen Produktionsbuild bestanden; keine Browserfehler.
- Vollständiger nativer Linux-Release und Debian-Installer 0.2.1 erfolgreich gebaut. Windows-/macOS-Builds und native grafische Abnahme bleiben offen.
- Für CI neuere reife Action-Releases per unveränderlichem Commit-SHA ausgewählt; CI-Ausführung auf Windows/macOS wurde hier nicht vorgenommen.
