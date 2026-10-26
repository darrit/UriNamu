# UriNamu

A local family tree application built with Tauri 2, React, TypeScript and SQLite. Its visual identity uses the approved UriNamu symbol, forest green, parchment and antique gold.

**License:** [PolyForm Noncommercial 1.0.0](LICENSE.md). Personal and other noncommercial use is allowed. Commercial use needs a written license from Darrit first. See [Commercial license](COMMERCIAL.md).

**Set up development:** [Developer guide](docs/ENTWICKLUNG.md) · [Setup reference](docs/SETUP.md)

**Create an installer:** [Build commands and output folders](#build-installers)

**App version and build details:** the badge beside the logo shows the actual version and opens build details, including the timestamp. Release notes: [CHANGELOG.md](CHANGELOG.md).

## Automatic setup

Run these commands from the project folder. The full setup installs the required tools and locked project dependencies.

Windows, in PowerShell:

```powershell
.\Setup-Windows.cmd
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\.setup\env.ps1
npm.cmd run desktop
```

The execution-policy setting applies only to this terminal. Existing matching Build Tools and WebView2 are reused without UAC. Windows requests administrator permission only when a system installation or replacement is required.

Linux and macOS:

```sh
sh setup.sh
. ./.setup/env.sh
npm run desktop
```

Native setup supports Windows x64, Debian/Ubuntu on x64/ARM64, and macOS on Intel/Apple Silicon. Other Linux distributions and Windows ARM64 support frontend-only setup. See the [setup reference](docs/SETUP.md) for prerequisites, platform limits and plan mode.

The setup only installs or updates Node/npm when they are missing or older than the selected eligible release. Existing equal or newer stable versions are retained, even if they are less than seven days old. This exception applies only to existing Node/npm. All new downloads, Rust, system tools and project dependencies must satisfy the release-age policy: strictly older than seven days at the time setup runs.

The verified baseline is **Node 24.22.0 · npm 12.2.1 · Rust 1.99.1**. Historical release evidence: [Version report](docs/VERSIONEN.md).

## Develop after setup

Activate the local environment in each new terminal: `. .\.setup\env.ps1` on Windows, or `. ./.setup/env.sh` on Linux/macOS. Then run `npm.cmd run desktop` or `npm run desktop`.

For a browser preview, run `npm run dev`. It uses a separate IndexedDB database and does not access the desktop application's SQLite data. Native file dialogs and encrypted exchange are disabled in the preview.

## Build installers

Complete the full setup first. Build each package on its target operating system. Frontend-only setup is insufficient for a desktop build.

### Windows: EXE installer

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\.setup\env.ps1
npm.cmd run desktop:build -- --bundles nsis -- --locked
```

Output: `*-setup.exe` in `src-tauri/target/release/bundle/nsis/`.

Alternatively, run `.\Build-Windows.cmd` from the activated terminal to include npm installation and frontend/Rust tests before building. The end user's computer needs WebView2; the generated app installer does not install it automatically.

### Linux: DEB and AppImage

```sh
. ./.setup/env.sh
npm run desktop:build -- --bundles deb,appimage -- --locked
```

Output: `.deb` in `src-tauri/target/release/bundle/deb/` and `.AppImage` in `src-tauri/target/release/bundle/appimage/`.

### macOS: app and DMG

```sh
. ./.setup/env.sh
npm run desktop:build -- --bundles app,dmg -- --locked
```

Output: `UriNamu.app` in `src-tauri/target/release/bundle/macos/` and `.dmg` in `src-tauri/target/release/bundle/dmg/`. This builds for the current Mac's architecture. See [Build installers](docs/ENTWICKLUNG.md#7-build-installers) for universal builds, signing and notarization.

A successful setup verifies the developer environment. Native app builds, installer installation and graphical acceptance still require separate checks. See the [verification report](docs/PRUEFSTATUS.md).

Pushing a tag named `v` plus the committed application version, for example `v0.4.46`, runs the same build and publishes the installers on that GitHub release. The tag has to match `package.json`. Starting `.github/workflows/desktop.yml` manually still uploads build artifacts only. The macOS image from this workflow is not signed or notarized.

## Features

- Multiple independent family trees with separate backup histories.
- Merge trees by selecting a married/divorced couple in both trees. The result is a new tree; both originals remain available. Match additional duplicate people and resolve conflicts explicitly.
- People, photos, gender and memories.
- Classic, horizontal and tapestry tree layouts.
- Click to center the selected person; double-click to open the profile; use the pen to edit.
- Open partner slots, shared child origins, and closing/reopening childless branches.
- Birth names appear between given name and surname, for example `Anna (Müller) Berg`. Photos have an interactive crop dialog before saving.
- Right-click to record or correct a death date. Deceased portraits receive a subtle transparent cross and light desaturation; the full death date is shown. The stored photo and relationships remain unchanged.
- Childless branch badges are centered on their line in all three layouts.
- Divorced partnerships remain visible with a double-slashed connection, including couples without children. Right-click a former partner to add a new partner.
- Clicking a person pans the viewport without rearranging cards, paths or zoom. Connections attach to card/portrait boundaries.
- Ancestor entry starts with one slot; add the second parent through the first ancestor's partner slot. No duplicate second-parent placeholder is shown.
- Right-click to remove a person. Removal and death-date changes require a confirmation naming the action and person; cancellation leaves stored data unchanged.
- Local SQLite storage, separate photo files, 100 backups and 30 undo/redo steps per session.
- Encrypted `.urinamu` exchange using AES-256-GCM and Argon2id; import of older `.wurzeln` prototype exports.

[User guide](docs/BEDIENUNG.md) · [Data format and architecture](docs/ARCHITEKTUR.md). The user guide is English and quotes the German UI labels. The application UI and existing architecture/audit reports retain their current language.

## License

The source is published under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). You may use, study, and modify UriNamu for a noncommercial purpose, including private family use. Copy these license terms and the notice in [NOTICE](NOTICE) along with any copy you pass on.

Commercial use is not covered. Selling the application, charging for a modified version, or bundling it into a paid product requires a separate written license from Darrit before that use begins. The terms, including approval and a share of the revenue, are agreed in that contract. See [Commercial license](COMMERCIAL.md).

Do not include real family trees, photos, or other personal data in issues or pull requests. A contribution can be accepted only together with a written assignment of the contributed rights to Darrit, so a later commercial license can still cover the whole project.

## Dependency policy and CI

The application version advances automatically when you start the app or build an installer after application source changed and the version was not already raised. Use `npm run version:bump -- patch` for an explicit fix bump, `-- minor` for new compatible features, or `-- major` for incompatible changes. The command synchronizes npm, Tauri and Rust versions without updating dependencies. Tests/builds reject mismatched versions. A rebuild of unchanged source does not bump again; builds of the same version are distinguished by their timestamp. See [Application versioning](docs/ENTWICKLUNG.md#application-versioning).

The locked dependency baseline was audited against **2026-10-18 04:52:05 UTC**. Direct npm/Rust versions are pinned, and transitive versions are frozen in `package-lock.json` and `src-tauri/Cargo.lock`. `.npmrc` limits additional npm resolution to the recorded cutoff. Setup separately computes its current UTC cutoff on every run. Audit evidence is stored in `docs/*release-audit.json`.

Do not use `npm update`, `cargo update`, `rustup update` or automatic fix commands without repeating release-age checks and validation. Pushing a version tag publishes installers through `.github/workflows/desktop.yml`. A manual run does not.

Encrypted exports protect the exchanged file. The local working database and backups are not additionally encrypted.
