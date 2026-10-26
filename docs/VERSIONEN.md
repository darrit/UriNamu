# Aktuelle Versionen und Sieben-Tage-Regel

Stand **0.2.1**. Ausgewählt am **25.10.2026, 04:52:05 UTC**; ausschließlich stabile Freigaben vor **18.10.2026, 04:52:05 UTC**.

## Werkzeuge

| Werkzeug | Version | Veröffentlichung / offizieller Tag |
| -------- | ------- | ---------------------------------- |
| Node.js  | 24.22.0 | 2026-10-14                         |
| npm      | 12.2.1  | 2026-10-15T17:40:08.077Z           |
| Rust     | 1.99.1  | 2026-10-15                         |
| rustup   | 1.29.1  | 2026-09-01T12:27:37Z               |

Die Tabelle dokumentiert den geprüften Ausgangsstand. Die reguläre Einrichtung erfolgt mit `Setup-Windows.cmd` beziehungsweise `sh setup.sh`, siehe [Entwickleranleitung](ENTWICKLUNG.md). Das Setup wählt bei Bedarf ausreichend alte LTS-/npm-Releases innerhalb der vorgegebenen Hauptversionen. Bereits vorhandenes gleiches oder neueres stabiles Node/npm wird akzeptiert und nicht ersetzt; die mit Node ausgelieferte npm-Version ist nicht automatisch ausreichend. Der Setup-Stichtag wird bei jeder Ausführung neu berechnet; der oben genannte Stichtag bleibt der historische Nachweis dieses gesperrten Projektstands.

## Direkte Projekt-Abhängigkeiten

| Bereich | Paket                     | Version | Veröffentlicht              |
| ------- | ------------------------- | ------- | --------------------------- |
| npm     | @tauri-apps/api           | 2.12.4  | 2026-10-14T18:47:44.921Z    |
| npm     | @tauri-apps/plugin-dialog | 2.8.3   | 2026-10-14T19:17:55.842Z    |
| npm     | d3-shape                  | 3.2.0   | 2022-12-20T23:39:17.478Z    |
| npm     | lucide-react              | 1.59.0  | 2026-10-17T06:15:48.758Z    |
| npm     | react                     | 19.3.1  | 2026-10-14T16:47:15.290Z    |
| npm     | react-dom                 | 19.3.1  | 2026-10-14T16:49:10.081Z    |
| npm     | @tauri-apps/cli           | 2.12.3  | 2026-10-14T19:50:25.524Z    |
| npm     | @types/d3-shape           | 3.2.0   | 2026-08-21T21:39:11.144Z    |
| npm     | @types/react              | 19.3.0  | 2026-09-09T18:08:49.750Z    |
| npm     | @types/react-dom          | 19.3.0  | 2026-09-09T18:07:51.886Z    |
| npm     | @vitejs/plugin-react      | 6.1.2   | 2026-10-05T10:08:27.143Z    |
| npm     | prettier                  | 3.9.10  | 2026-10-10T08:35:28.472Z    |
| npm     | typescript                | 7.0.2   | 2026-07-08T15:55:18.431Z    |
| npm     | vite                      | 8.3.4   | 2026-10-08T12:07:04.441Z    |
| npm     | vitest                    | 5.0.5   | 2026-10-15T14:29:01.396Z    |
| cargo   | tauri                     | 2.12.4  | 2026-10-14T18:52:10.735395Z |
| cargo   | tauri-plugin-dialog       | 2.8.3   | 2026-10-14T19:16:07.400157Z |
| cargo   | serde                     | 1.0.229 | 2026-07-18T23:05:13.266456Z |
| cargo   | serde_json                | 1.0.154 | 2026-10-11T15:31:46.076577Z |
| cargo   | rusqlite                  | 0.40.2  | 2026-08-08T14:21:52.570893Z |
| cargo   | aes-gcm                   | 0.11.1  | 2026-08-21T20:55:46.824964Z |
| cargo   | argon2                    | 0.6.0   | 2026-08-27T16:54:18.571817Z |
| cargo   | pbkdf2                    | 0.13.0  | 2026-04-21T13:26:45.248211Z |
| cargo   | sha2                      | 0.11.1  | 2026-10-12T18:58:22.836567Z |
| cargo   | base64                    | 0.23.1  | 2026-08-04T12:34:31.976297Z |
| cargo   | zeroize                   | 1.9.1   | 2026-10-06T17:49:21.148259Z |
| cargo   | tauri-build               | 2.7.3   | 2026-10-14T18:51:08.630528Z |
| cargo   | getrandom                 | 0.4.3   | 2026-06-17T18:01:59.979552Z |

Ein unverändert altes Paket kann korrekt sein: `d3-shape` 3.2.0 ist weiterhin dessen neueste stabile veröffentlichte Version. `rand` wurde durch den direkten Betriebssystem-Zufallszugriff mit `getrandom` ersetzt. Das Exportformat und die KDF-/Verschlüsselungsparameter bleiben unverändert.

## Indirekte Abhängigkeiten und CI

Alle indirekten Versionen werden vollständig geprüft, nicht nur die sichtbaren Hauptpakete. Zu junge Cargo-Freigaben und deren ausgewählte Ersatzversionen stehen in `cargo-age-exclusions.json`. Die Grenzen halten jeweils die neueste ausreichend alte Version der benötigten kompatiblen Reihe fest.

Vollständige Nachweise:

- `npm-release-audit.json`: alle gesperrten npm-Pakete.
- `cargo-release-audit.json`: alle gesperrten Rust-Pakete.
- `toolchain-release-audit.json`: Werkzeuge und direkte Freigaben.
- `ci-release-audit.json`: Action-Releases mit Veröffentlichungsdatum und festem Commit-SHA.

## Bei künftigen Updates

`python scripts/propose-updates.py` ermittelt einen neuen Vorschlag mit einem neu berechneten Sieben-Tage-Abstand. Das installiert und aktualisiert keine Pakete selbständig. Anschließend Manifest, Policy, Werkzeuge, CI und Lockdateien gemeinsam aktualisieren, alle Freigaben auditieren und Tests/Builds durchführen. Der genaue Ablauf steht in `ENTWICKLUNG.md`, Abschnitt 11.

Die aktuelle Policy ist absichtlich als geprüfter Snapshot festgehalten. Ein normaler Build verwendet exakt diesen Stand; automatische ungeprüfte Hintergrundupdates gibt es nicht.
