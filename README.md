# UriNamu

UriNamu is a desktop app for building family trees. Record relatives and their relationships, add photos and memories, and keep separate trees for different families. The app works offline and stores your family data on your computer.

[Install the app](#install-the-app) · [User guide](docs/USER-GUIDE.md) · [Run from source](#run-from-source) · [Changelog](CHANGELOG.md)

## Install the app

Choose the package for your operating system under **Assets** on the [GitHub Releases page](https://github.com/darrit/UriNamu/releases).

| System | Package |
| --- | --- |
| Windows (x64) | Run the `-setup.exe` installer. If WebView2 is missing, the installer downloads it. |
| macOS (Intel or Apple Silicon) | Open the `.dmg` and move UriNamu to Applications. The GitHub build is unsigned and unnotarized, so macOS may block it. |
| Linux (x64) | On Debian or Ubuntu, install the `.deb` with `sudo apt install ./<filename>.deb`, replacing `<filename>.deb` with the downloaded filename. For the `.AppImage`, make it executable and open it. |

If your platform has no installer available, see [Build installers](#build-installers). The version badge beside the logo opens the app version and build time.

## Create your first tree

1. Choose **Deutsch**, **English**, **日本語**, or **한국어** when UriNamu first asks for a language. You can change it later in **Settings**.
2. Select **Start your own family** to begin with an empty tree, or **Explore the example** to try the app with fictional people.
3. Select **Add member** to create your first profile. Right-click a person to add ancestors, children, or a partner. Double-click a person to open their profile, then select the pencil to edit it.
4. Open **Guide** in the sidebar for a walkthrough or **My family trees** to create and switch between trees.

### What you can do

- Add names, cropped portraits and memories to profiles. Record birth, death and wedding dates as a full date or a year. Leave the date unknown when needed.
- Record married and unmarried partnerships, separations and divorces. Children stay linked to their parents when a partnership ends.
- Add ancestors and descendants across as many generations as your tree needs, up to 5,000 people per tree.
- Switch between **Classic**, **Horizontal**, **Tapestry** and **Chart**. Drag people to arrange the tree, or select **Tidy** to arrange the current view by generation.
- Use a dynasty to mark a line of descendants with a name and an optional image or coat of arms.
- Merge two trees that share a couple recorded as married or divorced in both. Review matching people and resolve conflicts before saving the result as a new tree. Both original trees stay in your library.

See the [user guide](docs/USER-GUIDE.md) for step-by-step instructions.

## Save and share your data

Each tree has its own **Backup history**, with up to 100 saved states on the same device. Undo and redo cover up to 30 changes during a session. The desktop app keeps its working data in SQLite and stores photos in separate files. The local data and backups have no extra app-level encryption.

| Export option | When to use it |
| --- | --- |
| **As PDF** | Print or share a picture of the open tree. The option to embed unencrypted family data, including names, dates and notes, is on by default. Clear it to share only the rendered tree. PDF export also works in the browser preview. |
| **As a UriNamu file** | Keep or share an encrypted copy with profiles, photos and relationships. Use a password of at least ten characters. In the desktop app, importing a `.urinamu` file or an older `.wurzeln` file adds a separate tree. |

## Run from source

UriNamu uses React and TypeScript for the interface, Tauri and Rust for the desktop host, and SQLite for desktop storage. Start in the folder containing `package.json` after cloning the repository or extracting a source archive.

### Windows (PowerShell)

```powershell
.\Setup-Windows.cmd
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\.setup\env.ps1
npm.cmd run desktop
```

The execution policy change applies only to this terminal. Setup requests administrator access for system changes that require it.

### Linux and macOS

```sh
sh setup.sh
. ./.setup/env.sh
npm run desktop
```

Full setup prepares the native tools and installs locked project dependencies on Windows x64, Debian/Ubuntu x64 and ARM64, and Intel and Apple Silicon Macs. In each new terminal, load the matching `.setup` activation script before running development or build commands. See the [setup reference](docs/SETUP.md) for prerequisites, frontend-only setup and platform limits.

For frontend work, `npm run dev` starts a browser preview at `http://127.0.0.1:1420`. The preview uses its own IndexedDB store. Native file dialogs and encrypted exchange require the desktop app. In PowerShell, use `npm.cmd` in place of `npm` if needed.

### Check and test changes

```sh
npm run version:check
npm run check
npm test
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features --lib
```

Start with [`src/App.tsx`](src/App.tsx) for the interface, [`src/useAppController.ts`](src/useAppController.ts) for state and save actions, and [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) for desktop storage and encryption. The [architecture guide](docs/ARCHITECTURE.md) maps the rest of the code. The [developer guide](docs/DEVELOPMENT.md) covers the full validation workflow and troubleshooting.

### Build installers

Run full setup, activate the environment, and build on the target operating system. In the commands below, the second `--` passes `--locked` to Cargo.

| System | Command | Output under `src-tauri/target/release/bundle/` |
| --- | --- | --- |
| Windows | `npm.cmd run desktop:build -- --bundles nsis -- --locked` | `nsis/` (`-setup.exe`) |
| Linux | `npm run desktop:build -- --bundles deb,appimage -- --locked` | `deb/` and `appimage/` |
| macOS | `npm run desktop:build -- --bundles app,dmg -- --locked` | `macos/` and `dmg/`, for the current Mac's architecture |

The [build guide](docs/DEVELOPMENT.md#7-build-installers) covers universal macOS builds, signing and the Windows build script. The [desktop workflow](.github/workflows/desktop.yml) publishes packages after all platform builds succeed for a `v` tag matching `package.json`. A manual workflow run uploads build artifacts only.

### Versioning and dependencies

For an application change, run `npm run version:bump -- patch` for a fix, `npm run version:bump -- minor` for a compatible feature, or `npm run version:bump -- major` for an incompatible change. Add the matching changelog entry and run `npm run version:check`. Starting or building the app applies a pending patch bump when application source changed and the version was not already raised. Documentation edits need no bump. See [application versioning](docs/DEVELOPMENT.md#application-versioning).

Setup checks that releases selected for installation are stable and strictly older than seven days. Existing stable Node/npm versions that meet the minimum are retained even if they were released within the last seven days. The lockfiles fix the project dependency versions. Follow the [dependency update procedure](docs/DEVELOPMENT.md#11-update-project-dependencies-deliberately) before updating them.

## License and contributions

UriNamu is licensed under [PolyForm Noncommercial 1.0.0](LICENSE.md). Private family use and other noncommercial use are allowed. Include the license and [NOTICE](NOTICE) when redistributing copies. Commercial use requires a separate written license from Darrit. See the [commercial licensing terms](COMMERCIAL.md).

Use fictional data in issues and pull requests. Contributions require a written assignment of the contributed rights to Darrit.
