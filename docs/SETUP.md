# Automatic developer setup

Run one entry point from the project folder after checkout. Preinstalled Python, rustup, npm, Homebrew or Winget is not required. Linux/macOS need `curl`, `tar` and a SHA-256 tool as their bootstrap base. Windows uses PowerShell 5.1 and the `tar` supplied with Windows 10/11.

After setup: [Build installers for Windows, Linux and macOS](DEVELOPMENT.md#7-build-installers). Developer setup prepares the tools; the application installer is created by the build command.

## Windows 10/11 x64

Double-click `Setup-Windows.cmd`, or run it in PowerShell:

```powershell
.\Setup-Windows.cmd
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\.setup\env.ps1
npm.cmd run desktop
```

The policy change applies only to the current terminal. No permanent system-policy change is required. If setup was started by double-clicking, open a terminal in the project folder and run the activation commands there.

Existing matching Build Tools and WebView2 are reused without administrator rights or UAC. A missing runtime can be installed per user. Installing the compiler/SDK or replacing a machine-wide runtime requires UAC. If no prompt appears, explicitly open PowerShell with **Run as administrator** and run setup again. If the installer requests a restart, restart Windows and repeat the same setup command.

Errors from an elevated process are shown in the calling terminal. The full log is `.setup/native-install.log`; the latest native error is also saved in `.setup/native-error.txt`. Windows PowerShell scripts are stored as UTF-8 with a BOM so PowerShell 5.1 reads non-ASCII paths and messages correctly.

## Linux and macOS: Intel/Apple Silicon

```sh
sh setup.sh
. ./.setup/env.sh
npm run desktop
```

System packages require `sudo`. Automatic native Linux setup supports Debian and Ubuntu with the matching official snapshot archive. Other Linux distributions and Windows ARM64 support frontend-only setup here; native prerequisites must be provided separately.

On macOS, setup uses compatible Apple Command Line Tools from the dated software-update catalog. It does not remove a full Xcode installation. If Apple no longer offers the required older packages, setup stops with an explanation. Set `URINAMU_APPLE_CATALOG` to a suitable official catalog when necessary.

## What is installed

- **Node:** the newest eligible LTS release within the project's configured major version.
- **npm:** the newest eligible release within the configured npm major version that supports the selected Node version.
- **Existing Node/npm:** equal or newer stable versions are retained independently, without enforcing their release age. This includes newer major versions. Tests and builds determine actual compatibility. New installations and updates must always be older than seven days.
- **Rust and rustup:** the configured project versions, checked against official release metadata and installed under `.setup`. A newer global Rust is not used or removed. Rustup self-updates are disabled for this environment.
- **Windows:** fixed Microsoft C++ Build Tools with MSVC and Windows SDK, plus a dated standalone WebView2 installer. Downloads are checked against hashes and Microsoft signatures. The selected MSVC instance is explicitly activated for Cargo. If a downgrade is necessary, a newer WebView2 runtime is removed using its signed Microsoft uninstaller before the verified release is installed. This can affect other apps sharing that runtime; close WebView apps first. Windows may prevent removal of a system-owned runtime, in which case setup stops.
- **Linux:** compiler, GTK/WebKitGTK 4.1, SSL and other Tauri libraries from a signed distribution snapshot older than seven days. The resolved dependency tree is pinned to those snapshot versions. Packages already installed at a newer version are kept, so setup does not downgrade shared libraries or remove unrelated packages such as the desktop. Development packages that require exactly that newer library are installed from the official Debian or Ubuntu archive at the matching version. Unresolvable conflicts stop setup. Normal package sources remain unchanged. Package lists are stored outside the home directory so apt's unprivileged download user can read them.
- **macOS:** signed Apple Command Line Tools and SDKs checked for catalog date and OS compatibility. The catalog digest is the xar table-of-contents checksum; each archived part is checked against the checksum recorded there. Installed receipt versions are verified.
- **Project dependencies:** React, TypeScript, Vite, the Tauri CLI and other npm packages through `npm ci`; Rust packages through `cargo fetch --locked`. Release dates of all entries in both lockfiles, including transitive dependencies, are checked first. Framework versions are not updated automatically.

Setup does not change tracked manifests, lockfiles or global Node/npm installations. Managed tools, activation scripts, downloads and reports live in ignored `.setup/`. `.nvmrc`, `.node-version` and `packageManager` name the reproducible baseline; engine checks accept Node/npm at or above the minimum versions.

## Release-age policy

Each invocation computes a fresh cutoff: **current UTC time minus seven days**. Releases must be strictly older than the cutoff. Exactly seven days is insufficient. If metadata provides only a date, the end of that UTC day is used conservatively.

Missing release evidence, invalid hashes/signatures and unsupported sources stop setup. For WebView2, a historical Winget manifest pinned by commit demonstrates the age of the exact installer bytes. The exception for existing newer Node/npm does not apply to Rust, system tools or project dependencies.

## Inspect the plan first

```powershell
.\Setup-Windows.cmd -Plan
```

```sh
sh setup.sh --plan
```

Plan mode checks release metadata and writes `.setup/plan.json` and `.setup/release-audit.json`. It does not install system tools or project packages. If Node is missing or too old, the entry point must first provide the verified local Node bootstrap. Linux package resolution and installed system versions can only be checked on the relevant machine.

## Frontend-only setup

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

An optional `GITHUB_TOKEN` increases the GitHub API limit for public release metadata. It is sent only to `api.github.com` and is not logged.

## Validation and limits

```sh
npm run setup:test
npm test
npm run build
```

The setup tests cover age boundaries, release selection, retaining newer Node/npm, engine compatibility, fixed Microsoft sources, hashes, Apple catalog data and Linux snapshot pins that keep newer installed libraries. Four Windows tests also cover paths with spaces/parentheses, batch exit codes, PowerShell 5.1 enumeration of vswhere JSON, and conditional elevation. Those four tests are skipped on other platforms.

On **2026-10-25**, complete setup succeeded on Windows x64: Node 24.22.0/npm 12.2.1 retained, existing Build Tools 17.14.37806.7 and WebView2 155.0.4283.62 reused without UAC, Rust 1.99.1 installed locally, Rust dependencies fetched with `--locked`, and `npm ci` completed. The activated environment finds MSVC 14.44.35207 and Windows SDK 10.0.26100.0. All eleven setup tests passed. Further evidence and open target-system checks: [Verification report](VERIFICATION.md).

A successful plan only validates metadata. First-time setup on a completely fresh Windows machine, and the new native setup paths on macOS/Linux, still require separate checks. The successful setup does not prove a Windows/macOS app installer build or graphical app launch. OS or WebView updates outside this script remain outside its control; subsequent setup runs recheck or restore the required tool versions.

The [developer guide](DEVELOPMENT.md) covers the standard setup, environment activation, testing and desktop builds. This reference provides additional selection rules and platform limits.
