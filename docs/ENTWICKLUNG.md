# UriNamu: development environment and builds

Updated: 2026-10-25. After checkout, use the setup script to prepare the tools and locked project dependencies. Run all commands from the project folder, which must directly contain `package.json`, `src` and `src-tauri`.

## 1. Windows: automatic setup and launch

In PowerShell:

```powershell
.\Setup-Windows.cmd
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\.setup\env.ps1
npm.cmd run desktop
```

Setup checks and installs Node, npm, Rust, Microsoft C++ Build Tools, Windows SDK, WebView2 and project dependencies. You do not need to download or install each tool separately.

You can also double-click `Setup-Windows.cmd`. Afterwards, open a terminal in the project folder, apply the process-scoped execution policy and load `.setup/env.ps1` as shown above. Activation applies only to that terminal. Use `npm.cmd` if PowerShell blocks an existing `npm.ps1`. No permanent execution-policy change is needed.

Existing matching Build Tools and WebView2 are reused without UAC. Administrator rights are requested only for a required compiler/SDK installation or replacement of a machine-wide runtime. If no UAC prompt appears when one is required, open PowerShell from the Start menu with **Run as administrator** and run setup again. If Windows requests a restart, restart and repeat the same setup command.

Native Windows setup currently supports x64. Windows ARM64 supports the frontend-only mode in section 5.

## 2. Linux: automatic setup and launch

```sh
cd /path/to/UriNamu
sh setup.sh
. ./.setup/env.sh
npm run desktop
```

On Debian and Ubuntu, setup installs the compiler and Tauri system libraries from a sufficiently old, signed distribution snapshot. This includes GTK 3 and WebKitGTK **4.1**; WebKitGTK 4.0 is insufficient. Newer libraries already installed on the machine are left in place, and the matching development headers are installed for them. System packages require `sudo`. Normal package sources are not rewritten.

The bootstrap requires `curl`, `tar` and a SHA-256 tool. Other Linux distributions support frontend-only setup here and need separately provided native prerequisites. The desktop window requires a graphical X11/Wayland session; backend tests can run headlessly.

Build distributable Linux packages on the oldest supported distribution and test them there. Binaries built on a newer distribution may require a newer glibc.

## 3. macOS: automatic setup and launch

For Apple Silicon and Intel:

```sh
cd /path/to/UriNamu
sh setup.sh
. ./.setup/env.sh
npm run desktop
```

Setup detects the architecture and installs Node/npm, Rust and compatible Apple Command Line Tools, including the compiler and SDK, from the dated Apple catalog. System installations require `sudo`. A full Xcode installation is not removed and is not required for desktop development. WebKit is supplied by macOS.

The bootstrap requires `curl`, `tar` and a SHA-256 tool. Setup stops if Apple no longer provides packages that are demonstrably old enough and compatible with this macOS version. See [SETUP.md](SETUP.md) for overriding the official Apple catalog when necessary.

## 4. Tools and version policy

| Component | Setup behavior |
| --- | --- |
| Node.js | Minimum 24.22.0; when needed, select the newest eligible LTS release within the configured major version |
| npm | Minimum 12.2.1; when needed, select the newest eligible release within the configured major version compatible with the selected Node |
| Existing newer Node/npm | Retain each independently, even if the existing release is less than seven days old |
| Rust / rustup | Install configured versions 1.99.1 / 1.29.1 locally under `.setup` after checking release age |
| Compiler, SDK and webview | Check/provision platform-specific tools from dated sources; reuse matching existing Windows tools |
| React, TypeScript, Vite, D3 and Tauri CLI | Install together with `npm ci` from `package-lock.json` |
| Rust libraries | Fetch with `cargo fetch --locked` from `src-tauri/Cargo.lock` |

SQLite is compiled into the application; no separate database server is required. Automatic setup does not require Python, Homebrew, Winget or a global Tauri CLI. Git is only needed for checkout; a complete source ZIP works too.

### A fresh cutoff for every setup run

Every invocation calculates **current UTC time minus seven days**. New installations and updates must use stable releases published strictly before that cutoff. Exactly seven days is insufficient. For date-only metadata, the end of the release day in UTC is used conservatively.

The existing-equal-or-newer exception applies only to Node/npm. Rust, system tools and project dependencies remain subject to the age policy. Transitive npm/Cargo dependencies are also checked. Missing evidence, unsupported sources or invalid hashes/signatures stop setup.

Framework and Rust project dependencies remain frozen by the lockfiles. `dependency-policy.json` and `.npmrc` retain the historical audited project cutoff; setup does not rewrite them. This recorded evidence is separate from the current cutoff computed during setup. `.nvmrc`, `.node-version` and `packageManager` describe the reproducible baseline. `engines` and `scripts/check-toolchain.mjs` accept Node/npm at or above the minimum versions.

### Local environment and subsequent checkouts

Managed tools, downloads, activation scripts and reports live in ignored `.setup/`. Setup does not change tracked manifests/locks or replace global Node/npm. Global Rust tools remain installed; the local environment selects the project's Rust with rustup self-updates disabled.

Run setup again after a new checkout. You can repeat it in an existing checkout. Before developing or building in each new terminal, load `. .\.setup\env.ps1` on Windows or `. ./.setup/env.sh` on Linux/macOS. This also activates the selected compiler and Rust. Individual installation and manual PATH steps are no longer the standard workflow.

Selection details, downgrade behavior and platform limits: [Setup reference](SETUP.md). Verified results: [Verification report](PRUEFSTATUS.md).

## 5. Plan mode and browser preview

Check release metadata without installing system/project packages:

```powershell
.\Setup-Windows.cmd -Plan
```

```sh
sh setup.sh --plan
```

The plan is written to `.setup/plan.json`, and release evidence to `.setup/release-audit.json`. If Node is missing or too old, the entry point must first provide a verified local Node bootstrap. A successful plan verifies metadata only.

Frontend only, without Rust or native system tools:

```powershell
.\Setup-Windows.cmd -FrontendOnly
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\.setup\env.ps1
npm.cmd run dev
```

```sh
sh setup.sh --frontend-only
. ./.setup/env.sh
npm run dev
```

The browser preview runs at `http://127.0.0.1:1420`. It uses separate IndexedDB storage and does not access desktop SQLite data. Native file dialogs and encrypted exchange are disabled. To change the fixed port, update both `vite.config.ts` and `build.devUrl` in `src-tauri/tauri.conf.json`.

## 6. Develop and test

After activating the full setup environment:

```sh
npm run versions:check
npm run setup:test
npm run check
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features --lib
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

Use `npm.cmd` instead of `npm` in PowerShell when needed. The eleven setup tests include four Windows/PowerShell 5.1 tests that are skipped on other platforms. Rust tests with `--no-default-features --lib` check SQLite and encryption without graphical libraries; `cargo check` verifies the full native host.

`npm run desktop` launches the desktop app with hot reload. Close the window and press Ctrl+C in the terminal if needed. `npm run dev` starts only the browser preview, while `npm run build` writes its production build to `dist/`.

### Browser interaction checks

`scripts/browser-qa.cjs` and `scripts/merge-qa.cjs` use an existing Playwright browser; they do not silently download a current browser. Start `npm run dev`, then use a second activated terminal:

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-qa.cjs
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_PATH=/usr/bin/chromium node scripts/merge-qa.cjs
```

In PowerShell, set `$env:PLAYWRIGHT_MODULE` and `$env:CHROMIUM_PATH` instead. These checks exercise the browser preview. Native dialogs and Tauri IPC require separate acceptance checks.

For the profile/canvas regression, first run `npm run build`, then `node scripts/profile-canvas-qa.cjs` with the same existing Playwright/browser configuration. This script serves the built assets through browser request interception, without a separate dev server. It uses synthetic data to check birth names, selected photo crops, example dates, pan-only centering in all three layouts, divorce and new partners. QA screenshots are written under ignored `.setup/qa/`.

## 7. Build installers

Activate the local setup environment in the build terminal first. The following commands preserve the locked Rust dependency graph. Build each package on its target operating system.

### Application versioning

The version badge beside the logo is visible before a tree is opened and in narrow layouts. Click it to view the app version, build timestamp (or dev-session start time), and desktop/browser mode. The sidebar/footer use the same version. Metadata is injected from `package.json` when the frontend starts/builds; it is not hard-coded in UI text. This version display was introduced in **0.3.0**; see [CHANGELOG.md](../CHANGELOG.md).

Increase the application version once when a behavior, UI, or storage change is finished, so the badge matches the source. Leave it unchanged for documentation-only edits. `npm run dev`, `npm run desktop`, `npm run build` and `npm run desktop:build` apply a pending patch bump automatically when application source changed and the version still matches the last commit. A second start does not bump again until those changes are committed and new source changes appear. Rebuilding unchanged source does not bump; the build timestamp distinguishes those builds.

```sh
npm run version:bump -- patch
npm run version:check
```

Use `patch` for fixes, `minor` for backward-compatible features, and `major` for incompatible changes. Do not run all three; choose the appropriate change type. On Windows, use `npm.cmd` if needed. Add one `CHANGELOG.md` entry for that version.

The bump command updates `package.json`, the application entries in `package-lock.json`, `src-tauri/tauri.conf.json`, `[package].version` in `src-tauri/Cargo.toml`, and the application's `src-tauri/Cargo.lock` entry together. Dependency versions are untouched. Pre-test, pre-build and desktop hooks reject inconsistent application versions. Versioning regression tests are included in `npm test` and can also be run with `npm run version:test`.

If an update was interrupted, `npm run version:sync` restores all application manifests to the version recorded in `package.json`, without incrementing it again. Then run `npm run version:check`. Historical audit/version reports remain historical evidence. Builds embed their actual timestamp so two builds of the same version can still be distinguished. Rebuild the native installer to deliver the new version to an installed app.

### Windows: EXE installer

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\.setup\env.ps1
npm.cmd run desktop:build -- --bundles nsis -- --locked
```

Output: `*-setup.exe` in `src-tauri/target/release/bundle/nsis/`.

Alternatively, run `.\Build-Windows.cmd` from the activated terminal. It additionally runs `npm ci` and frontend/Rust tests. It does not install system tools or activate `.setup` automatically, so double-clicking it from an unconfigured environment may fail.

The app installer uses `webviewInstallMode: embedBootstrapper` with a silent install. It embeds Microsoft's bootstrapper and installs the WebView2 runtime when the end user's computer does not already have one. That download needs an internet connection. An existing runtime is left in place. Developer setup still installs a dated runtime for building; that is separate from the generated app installer.

### Linux: DEB and AppImage

```sh
. ./.setup/env.sh
npm run desktop:build -- --bundles deb,appimage -- --locked
```

Output: `.deb` in `src-tauri/target/release/bundle/deb/` and `.AppImage` in `src-tauri/target/release/bundle/appimage/`. In an activated environment, `sh scripts/build-desktop.sh` additionally installs npm dependencies and runs tests. Check package installation, WebKit rendering and AppImage/FUSE compatibility on target systems.

### macOS: app and DMG

```sh
. ./.setup/env.sh
npm run desktop:build -- --bundles app,dmg -- --locked
```

For the current Mac's architecture, output is `UriNamu.app` in `src-tauri/target/release/bundle/macos/` and `.dmg` in `src-tauri/target/release/bundle/dmg/`.

For a universal app containing Apple Silicon and Intel code:

```sh
rustup target add --toolchain 1.99.1 aarch64-apple-darwin x86_64-apple-darwin
npm run desktop:build -- --target universal-apple-darwin --bundles app,dmg -- --locked
```

Universal output: `src-tauri/target/universal-apple-darwin/release/bundle/macos/UriNamu.app`, with the image in the adjacent `dmg` directory. Test both architectures. Normal distribution requires Apple code signing and notarization using your own credentials.

End users receive the built package and do not need Node/npm, Rust or developer tools. The Windows installer adds WebView2 when it is missing. On Debian and Ubuntu, installing the `.deb` with apt also installs the declared system libraries, including WebKitGTK 4.1. macOS supplies WebKit. The AppImage may still need FUSE, or it can be started with `--appimage-extract-and-run`.

## 8. Troubleshooting

| Problem | Action |
| --- | --- |
| Missing `node`, `npm`, `cargo`, `cl.exe` or `link.exe` | Run setup and activate the local environment in the current terminal. |
| PowerShell blocks `env.ps1` | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then `. .\.setup\env.ps1`. |
| PowerShell blocks `npm.ps1` | Use `npm.cmd`. |
| Garbled non-ASCII output | Keep Windows PowerShell scripts encoded as UTF-8 with a BOM. Setup/build messages are now English. Markdown remains UTF-8. |
| Native Windows setup fails | Read the original terminal error and `.setup/native-install.log` / `.setup/native-error.txt`. Matching existing tools do not require UAC. |
| A required UAC prompt does not appear | Explicitly open PowerShell as administrator and run `Setup-Windows.cmd` again. |
| Release too young or date missing | Setup stops intentionally. Retry later or check reliable metadata; retain the age check. |
| Missing `webkit2gtk-4.1` / `gtk+-3.0` | Run full setup on supported Debian/Ubuntu. Frontend-only mode does not install native packages. |
| `cannot open display` | Desktop requires a graphical session; backend tests can run headlessly. |
| `xcrun: invalid active developer path` | Run full macOS setup again and inspect its Apple tool-selection messages. |
| Missing Rust 1.99.1 | Run full setup and activate the local environment. |
| `--locked` requires changes | Restore consistent manifests/lockfiles or intentionally update and audit them; retain `--locked`. |
| Windows export cannot overwrite a file | Choose a new filename; this version does not replace an existing export file. |
| SQLite reports locked | Close another instance. Before repairs, back up the entire data directory with the app closed. |
| A file cannot be decrypted | Check password and file type. Modified or incomplete files are rejected. |

## 9. Verified environment and open checks

On 2026-10-25, full setup succeeded in the Windows project: Node 24.22.0/npm 12.2.1 retained, existing Build Tools 17.14.37806.7 and WebView2 155.0.4283.62 reused without UAC, Rust 1.99.1 installed locally, and `cargo fetch --locked` plus `npm ci` completed. The activated environment finds MSVC 14.44.35207 and Windows SDK 10.0.26100.0. All eleven setup tests passed. The previously run 24 frontend tests and frontend production build also passed.

Setup on a completely fresh Windows machine, the new native setup paths on Linux/macOS, Windows/macOS app builds and graphical acceptance remain open. Earlier successful Linux builds do not verify the new Linux setup script. See [PRUEFSTATUS.md](PRUEFSTATUS.md) for detailed historical evidence.

Historical release dates for the locked dependency baseline are in [VERSIONEN.md](VERSIONEN.md) and the JSON audits. Use setup plan mode to repeat current metadata checks. The Python tools below are optional maintenance tools, not normal setup prerequisites.

## 10. Family tree and merge compatibility tests

`npm test` includes merge rules in `tests/merge.test.ts`. Rust tests cover migration from schema 1 to 2, independent trees/revisions and encrypted exchange of marriage status. Before first using version 0.2 with existing data, make a full copy of the app data directory while the app is closed. Migration preserves the previous family as the first tree; application 0.1 cannot read the new multiple-tree schema.

`scripts/merge-qa.cjs` uses two fictional test families and the browser configuration described above. It checks matching and preservation of the original trees through the UI. Encrypted file opening uses native desktop dialogs and remains part of platform acceptance.

## 11. Update project dependencies deliberately

For every update, compute current UTC time minus seven days and select only stable releases strictly older than that cutoff. Freeze the resulting project dependency graph. App startup and normal builds do not silently update dependencies. Python 3.11+ is required only for these optional maintenance tools.

1. Run `python scripts/propose-updates.py`. It reads registry metadata and writes `docs/dependency-proposal.json` without installing packages.
2. Check engine/peer compatibility, APIs and minimum Rust versions. Update direct versions in `package.json` and `src-tauri/Cargo.toml`. Verify Rust/rustup separately using official releases/tags.
3. Update the audited cutoff in `dependency-policy.json` and `.npmrc`. Keep engine minimums, `packageManager`, `.nvmrc`, `.node-version`, Rust configuration and CI consistent. Preserve the exception for existing newer Node/npm.
4. Resolve with `npm install --ignore-scripts`, then run `python scripts/audit-npm.py`. Only after the age audit passes should `npm ci` enable package installation scripts.
5. Run `python scripts/constrain-cargo-age.py` to resolve Cargo without compilation and constrain young transitive releases where necessary. Generated `cfg(any())` constraints add no runtime dependencies. `python scripts/audit-cargo.py` checks the local sparse-registry cache in the activated Cargo environment.
6. Run setup tests, frontend/Rust tests, frontend builds and native builds. Resolve incompatible API changes where necessary.
7. Save both lockfiles, policy, CI configuration, audit evidence and documentation together. Validate native target systems separately.

Keep `tests/fixtures` unchanged: they verify older exports and independently produced encrypted files. Photo SHA-256 filenames must also stay stable. `npm update`, `npm audit fix`, `cargo update`, `rustup update` and blanket system upgrades are not normal build steps. Release age is not a substitute for checking known security issues.

### Pinned CI tools

`.github/workflows/desktop.yml` builds the Windows installer, Linux DEB and AppImage, and the universal macOS disk image. Pushing a tag named `v` plus the committed application version, such as `v0.4.47`, starts that build and publishes the installers on the GitHub release for the tag. The tag must match `package.json`, and the changelog section for that version becomes the release text. A manual run still uploads build artifacts only and does not publish a release. One failed platform build skips the release. The macOS image is not signed or notarized. The Windows installer installs WebView2 when it is missing. Actions are pinned by commit SHA. `scripts/install-ci-rust.py` checks the archived rustup bootstrapper and installs the configured Rust toolchain into an isolated CI directory. Node/npm are explicitly selected too. This CI environment is separate from local `.setup`; Windows/macOS CI execution has not been verified here.

### Persistent tree positions

Person profiles may include optional `positions` keyed by `classic`, `horizontal` and `tapestry`, each containing finite `x`/`y` coordinates. Schema version 2 remains compatible with older profiles that omit the field. Both TypeScript and Rust validate the optional positions. The normal save path captures the existing automatic layout before a mutation, then places only new people in free space. Drag updates use transient coordinates for live edges and persist once at drop; undo/redo and encrypted exchange retain the saved positions.
