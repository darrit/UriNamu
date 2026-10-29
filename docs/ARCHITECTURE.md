# Architecture and file format

## Components

- `src/domain.ts`: people, partnerships, validation, migration of older structures, and data changes.
- `src/merge.ts`: deterministic couple and person matching, new IDs, and parent or relationship conflicts. People are not merged by name alone.
- `src/MergeDialog.tsx` and `src/LibraryDialog.tsx`: the merge assistant and the local family-tree library.
- `src/layout.ts`: generation and neighbourhood placement, and scene geometry.
- `src/Tree.tsx`: SVG/D3 connections, people, and input for pan, zoom and centering.
- `src/App.tsx`: the React interface, dialogs, undo, and the person context menu for ancestors.
- `src/guide.ts`, `GuidePanel.tsx`, `GuideScenes.tsx`: the guide beside the real controls.
- `src/PdfJob.tsx`, `poster.ts`, `savePdf.ts`: an ordinary PDF of the open tree. The PDF libraries load only for that export.
- `src/storage.ts`: native Tauri calls, and a separate IndexedDB preview for browser checks.
- `src-tauri/src/lib.rs`: validation again at the trust boundary, SQLite, photo files and cryptography.
- `src-tauri/tauri.conf.json`: host, content security policy, packaging and window.

The dialogs use the same local storage. Merging does not use a server.

The frontend uses only bundled local resources. Photos are shown as checked data URLs. The content security policy allows no external sites or scripts. Native commands are available only to the local main window. The app has no accounts, telemetry or cloud sync.

## Domain model, version 2

`Family` contains `version`, `name`, `members` and `unions`.

`Person` contains an ID, name, birth date, death date, place, memories, gender (`male`, `female` or not yet set), a photo and up to two parent IDs. An older display field is still read when loading, but it is no longer offered in the profile. Current and earlier partnerships are stored separately as `Union`.

`firstName`, `lastName` and `birthName` are stored as compatible name fields. Rust uses empty defaults when reading older data. The frontend splits the previous `name` when needed. `name` stays the full current name without the birth name. `displayName` places a nonempty birth name in parentheses between the given name and the surname. JSON SQLite snapshots and encrypted exports keep every field without a new database schema version.

The deceased mark comes only from `died`. `Portrait` shows the picture in grayscale and half covered, without a cross. `setDeathDate` validates the new date and leaves relationships and the original photo unchanged. Removing the date removes that automatic appearance. No extra status field or database migration is required. Childless marks get a geometric anchor halfway between `joint` and `branch`. The label is centered with `translate(-50%, -50%)` regardless of its text width.

`src/PhotoCrop.tsx` provides the interactive crop. `src/photo.ts` calculates its source rectangle. After confirmation, `resizePhoto` stores a crop of at most 1024 pixels on the long edge. Choosing a person is no longer tied to `layoutFamily`: a focus change only moves the view. SVG connections end at card and portrait edges. A former partner who sits farther away is routed outside that row. Scaling uses CSS zoom instead of a scaled transform layer.

`Union` contains an ID built from the two person IDs in sorted order (`a|b`), both people, status `active` or `separated`, the optional marital status `marriage` (`unspecified`, `married`, `divorced`), the optional wedding date `marriedOn` (`YYYY-MM-DD`), and `ended` for a closed childless line. The date must fall within both people's lives. Shared children come from the child's two parent IDs. A new partnership does not rewrite existing parent links.

Both application layers check self-references, missing references, duplicate IDs and parents, cycles, date order, more than one active partnership, and contradictory childless marks. Rust deserialization and the backend check also apply to imported files. The interface alone is not the security boundary.

## SQLite and photos

Database `urinamu.sqlite`, WAL mode, `synchronous=FULL` and a 10-second busy timeout. Schema version: `PRAGMA user_version=2`. Existing single-tree databases are migrated in a transaction. Their photos and revisions stay. Databases with a higher schema version are rejected. Switching back to application version 0.1 after this migration is not supported.

- `trees`: separate family IDs, names and family records as JSON snapshots.
- `active_tree`: ID of the open tree.
- `current`: snapshot of the open tree for compatible internal load paths.
- `revisions`: UTC timestamp, change description and the full JSON state. Each state carries `tree_id`. After every save, at most 100 revisions remain **per tree**. Reading and restoring check that the revision belongs to that tree.

Photo bytes live outside the database. The file name is the SHA-256 of the content plus the file type. Identical photos are reused. Database states contain relative `photo:<hash>.<ext>` references. The app resolves them when reading. New photo files are written before the database commit. The tree, selection, current snapshot and revision are updated in **one SQLite transaction**. A new merge gets a new tree ID. The source snapshots are not overwritten. If saving fails, the previously active family remains.

Photos are kept even when older revisions fall away, so a backup image that is still needed is not deleted by mistake. That can use disk space over time. A cleanup that checks remaining references is a possible later maintenance step.

Undo and redo also store new revisions. The frontend state is applied only after the backend save succeeds. The browser preview uses schema version 2, migrates existing data, and uses its own IndexedDB with an atomic state and history write. It is not the desktop store.

## Encrypted export file `.urinamu`

UTF-8 JSON envelope. Only the technical format parameters are plaintext. The family contents are fully encrypted:

```json
{
  "format": "urinamu",
  "version": 2,
  "cipher": "AES-256-GCM",
  "kdf": "Argon2id",
  "memory": 19456,
  "iterations": 2,
  "parallelism": 1,
  "salt": "<Base64, 16 random bytes>",
  "iv": "<Base64, 12 random bytes>",
  "data": "<Base64, ciphertext including the GCM tag>"
}
```

Argon2id version 0x13, 19 MiB of memory, two passes, one lane, and a 32-byte key. Salt and nonce come from the operating-system random generator for each export. AES-GCM also authenticates the fixed label `urinamu:2` as additional data. The decrypted payload is the full `Family` model with photos as data URLs. Format parameters are checked against the exact supported values before the key is derived. A modified file cannot demand an arbitrarily expensive key derivation.

Import checks the file size (32 MiB), the envelope, Base64 lengths, authentication, and finally the full domain model. Only then does the interface offer to replace the family. Export writes a randomly named temporary file in the destination directory, calls `sync_all`, and then renames it. On Windows, this version does not replace an existing destination file.

Passwords, derived keys and plaintext byte buffers are handled with `Zeroizing` in the Rust cryptography path. That does not guarantee that every copy in the web view or operating-system memory is wiped. Passwords are not logged, and there is no recovery back door.

### Import of the prototype

Format `wurzeln`, version 1, PBKDF2-HMAC-SHA256 with exactly 310000 rounds, AES-256-GCM, additional data `wurzeln:1`. Relationships from `relationships` are transferred into `unions`, and optional profile fields are filled in. Gender values that are no longer supported are not assigned to a gender automatically. New exports use only the new format.

## Platform limits

Tauri uses WebView2 on Windows, WebKitGTK 4.1 on Linux and WKWebView on macOS. The shared interface is cross-platform. Native installers, signing, file dialogs, web-view differences and platform compatibility have to be checked on each target system. Source code and build configuration do not replace that acceptance.

## Merge rules

Both chosen partnerships must be explicitly `married` or `divorced` in their source tree. The two anchor people are matched one to one. The interface shows both matches and requires confirmation. Further matches must also be unambiguous. Every other ID from the second source is reassigned, even when the same ID already exists in the first tree. All references are rewritten.

The profile source, parent strategy and relationship strategy are explicit options. After they are applied, the whole result is validated again. A shared child clears a childless mark. The result is saved as a new family tree only after validation succeeds. The originals are not changed. The file version stays 2. Missing marriage information in older files is read as `unspecified` and is not treated as a marriage.
