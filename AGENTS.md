# Application versioning

- Bump the application version once when a behavior, UI, or storage change is finished, so the version shown in the app matches the source. Use patch for fixes, minor for new backward-compatible features, and major for incompatible changes. Documentation-only changes do not need a bump. Starting the app (`npm run dev` or `npm run desktop`) or building an installer applies a pending patch bump automatically when application source changed and this version was not already raised. Rebuilding unchanged source does not bump again; the build timestamp distinguishes those builds.
- Run `npm run version:bump -- patch|minor|major` rather than editing manifests separately. The command updates package.json, both application lock entries, Tauri configuration and the Rust package version without updating dependencies.
- Add one matching CHANGELOG.md entry for that version. Keep historical audit and verification versions as historical evidence.
- The UI reads build-injected version/time metadata. Do not hard-code the displayed version.
- Run `npm run version:check` and relevant tests/builds before finishing a versioned change. Preserve the existing third-party release-age policy.
