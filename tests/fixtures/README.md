# Interoperabilitäts-Testdateien

Alle enthaltenen Personen sind fiktiv. Passwörter hier sind ausschließlich öffentliche Testwerte.

- `reference-v2.urinamu`: unabhängige Referenz mit Python `cryptography`, Argon2id (19 MiB, t=2, p=1) und AES-256-GCM, AAD `urinamu:2`. Passwort `fixture-passwort`. Feste Salt/Nonce nur für diesen unveränderlichen Testvektor; die Anwendung erzeugt pro Export frische Zufallswerte.
- `prototype-v1.wurzeln`: vom ursprünglichen Browser-Prototyp vor dem Bibliotheksupdate erzeugt (WebCrypto/PBKDF2, AAD `wurzeln:1`). Passwort `ein-sicheres-passwort`.

Die Dateien werden im Test nicht neu erzeugt. Dadurch prüfen Bibliotheksupdates tatsächlich die Lesbarkeit unabhängiger bzw. früherer Exporte.
