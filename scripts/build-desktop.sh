#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features --lib
npm run desktop:build -- -- --locked
