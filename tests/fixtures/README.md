# Interoperability test files

Every person in these files is fictional. The passwords here are public test values only.

- `reference-v2.urinamu`: an independent reference made with Python `cryptography`, Argon2id (19 MiB, t=2, p=1) and AES-256-GCM, additional data `urinamu:2`. Password `fixture-passwort`. The salt and nonce are fixed only for this unchanging test vector; the application creates fresh random values for each export.
- `prototype-v1.wurzeln`: anonymized compatibility vector in the old browser format (WebCrypto/PBKDF2, additional data `wurzeln:1`). Its payload was anonymized and re-encrypted with Node.js; it is no longer an untouched original browser export. Password `ein-sicheres-passwort`.

The tests do not recreate these files. A library update therefore checks that independent and earlier exports can still be read.
