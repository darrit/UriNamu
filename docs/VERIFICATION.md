# Verification status

This document separates checks that were run from builds that are only prepared. The entries below go through version 0.4.2 and stay as evidence. Changes through 0.6.2 are in the [changelog](../CHANGELOG.md). No new verification run is recorded here for them.

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

## Verified

- TypeScript check and Vite production build.
- 24 Vitest tests: core data, cycles, two parents, chronology, several partnerships, separation with children, deletion, the childless mark, three layouts, rearranging around the focused person, and the order of family branches.
- Ten Rust tests: validation, real SQLite transactions, photo files, revisions, an encryption round trip, rejection of wrong passwords and changed ciphertext, and import of the old prototype format.
- Browser merge check: select married couples explicitly, match duplicate children, create a third tree, open both originals unchanged, separate backups, switch trees and restart, and change marital status.
- Browser check in Chromium: click to center, turn ancestor entry on and off from the context menu, save ancestors, separation, a new partnership, undo and redo, reload, cancel unsaved changes, save a profile, switch layouts, and history.
- Successful Linux release build and Debian package `UriNamu_0.2.1_amd64.deb` (x64). Package metadata and dynamic library resolution were checked. A graphical start on a Linux target machine is still required.
- Further browser check: photo upload that survives reload, close and reopen a childless line, and add a shared child.
- Full native `cargo check --locked` for the Linux Tauri host with GTK and WebKitGTK from an isolated Debian snapshot.
- Release dates of every locked npm and Cargo package against the cutoff 2026-10-18. The records are in the two JSON audit files.

Further model tests check couple and person matching, divorced couples, parent conflicts, ID collisions, and that both originals are kept. Further Rust tests check separate trees and revisions, migration of an existing database, and marriage metadata.

Further compatibility check with the new package set: an unchanged real browser export (`.wurzeln`) and an independently produced Argon2id/AES-GCM test vector (`.urinamu`) decrypt. The known SHA-256 photo file name stays the same. All checks run with Node 24.22.0 / npm 12.2.1.

## Still to check on the target systems before release

- Windows: NSIS build, first install, WebView2 present and missing, Start menu, non-ASCII characters in the Windows user path, real native file and photo dialogs, and upgrade without losing data.
- macOS: build and start on Apple Silicon and Intel, native dialogs, data folder, DMG, signing and notarization.
- Linux: package installation on the chosen minimum distribution, desktop start, WebKit rendering, file dialogs, Wayland and X11, and AppImage/FUSE compatibility.
- Native end-to-end acceptance of import and export, and recovery from a copy on a second computer. Cryptography and storage are tested separately. That does not fully test the graphical native dialog path.

The GitHub Actions file is prepared and is started only manually. Nothing was uploaded to an external repository or published. The earlier Linux checks ran without the Windows project folder. Automatic setup was later also checked directly in the Windows project. See below.

## Automatic Windows setup, 2026-10-25

- A full run of `scripts/Setup-Windows.ps1` on Windows x64 completed successfully. The entry point for users is `Setup-Windows.cmd`.
- Node 24.22.0 and npm 12.2.1 were kept. Newer stable versions that are already installed are accepted regardless of release age, as requested. Newly installed or updated versions must be strictly older than seven days.
- Existing Microsoft Build Tools 17.14.37806.7 and WebView2 155.0.4283.62 were recognized and reused without an administrator prompt. The initial quoting error during activation, and the nested vswhere JSON list under PowerShell 5.1, are fixed.
- Rust 1.99.1 was installed in `.setup`, rustup self-updates were turned off, rustfmt was installed, and `cargo fetch --locked` succeeded. Release dates of the locked npm and Cargo dependencies were checked again against the moving seven-day cutoff before installation.
- `npm ci` succeeded: 54 packages installed, and npm reported no vulnerabilities.
- The activated environment was checked in practice: Node 24.22.0, npm 12.2.1, rustc/cargo 1.99.1, the MSVC 14.44.35207 compiler from the selected Build Tools instance, and Windows SDK 10.0.26100.0.
- Eleven setup tests passed, including four Windows and PowerShell 5.1 regression tests. The 24 frontend tests and the frontend production build that had already been run also passed.
- Native errors are visible in the calling terminal and in `.setup/native-install.log` and `.setup/native-error.txt`. A UAC prompt is requested only for a system change that is actually required.
- Still open: a full first install on a fresh Windows machine, the new native setup paths on Linux and macOS, and a Windows app build with graphical acceptance. The earlier Linux builds above do not replace a check of the new Linux setup script.

## Delivery state 0.2.1

- Linux file: `UriNamu_0.2.1_debian13_amd64.deb`. Built on Debian 13 x64. Do not describe it as tested on every Linux distribution.
- Source package: `UriNamu-0.2.1-Quellcode.zip`. It contains the React and Rust sources, locked dependencies, icons, documentation, tests and build scripts. It does not contain Node modules or local app data.
- Windows and macOS packages are **not** included. They have to be built and accepted on those systems with the tools described here.
- The last browser check uses the production build from `dist`, not only the development server.

## Library update 0.2.1

- Every direct npm and Cargo dependency was updated to the newest stable compatible release at the checked cutoff. `d3-shape` stays on its newest release, 3.2.0.
- 108 npm versions and 518 Cargo versions were fully checked. No release is after the cutoff, and the locked graph has no prereleases.
- Node 24.22.0, npm 12.2.1, Rust 1.99.1 and rustup 1.29.1 were actually used. Release evidence is in `toolchain-release-audit.json`.
- 24 frontend tests and ten Rust tests passed. Extra fixed files check old `.wurzeln` exports and independently produced `.urinamu` data. SHA-256 photo file names stay the same.
- Both browser checks passed with the new production build. There were no browser errors.
- A full native Linux release and the Debian installer 0.2.1 were built successfully. Windows and macOS builds, and native graphical acceptance, remain open.
- Newer mature Action releases were selected for CI by an immutable commit SHA. CI was not run here on Windows or macOS.

