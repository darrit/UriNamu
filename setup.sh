#!/bin/sh
set -eu
export URINAMU_ORIGINAL_PATH="$PATH"
cd "$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
command -v curl >/dev/null 2>&1 || { echo 'curl is required for the verified bootstrap.' >&2; exit 1; }
version=$(sed -n 's/^[[:space:]]*"node": "\([0-9.]*\)".*/\1/p' dependency-policy.json)
if command -v node >/dev/null 2>&1; then
  if node -e 'const a=process.versions.node.split(".").map(Number),b=process.argv[1].split(".").map(Number);for(let i=0;i<3;i++){if(a[i]>b[i])process.exit(0);if(a[i]<b[i])process.exit(1)}' "$version"; then
    node scripts/setup.mjs "$@"
    echo 'Activate in this terminal: . ./.setup/env.sh'
    exit 0
  fi
fi
case "$(uname -s)" in Linux) os=linux;; Darwin) os=darwin;; *) echo 'Unsupported operating system' >&2; exit 1;; esac
case "$(uname -m)" in x86_64|amd64) arch=x64;; arm64|aarch64) arch=arm64;; *) echo 'Unsupported architecture' >&2; exit 1;; esac
name="node-v$version-$os-$arch"
mkdir -p .setup
if [ ! -x ".setup/$name/bin/node" ]; then
  curl --proto '=https' --tlsv1.2 -fsSL "https://nodejs.org/dist/v$version/$name.tar.gz" -o ".setup/$name.tar.gz"
  curl --proto '=https' --tlsv1.2 -fsSL "https://nodejs.org/dist/v$version/SHASUMS256.txt" -o .setup/node-shasums.txt
  expected=$(awk -v file="$name.tar.gz" '$2 == file { print $1 }' .setup/node-shasums.txt)
  if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum ".setup/$name.tar.gz" | awk '{print $1}'); else actual=$(shasum -a 256 ".setup/$name.tar.gz" | awk '{print $1}'); fi
  [ -n "$expected" ] && [ "$expected" = "$actual" ] || { echo 'Node-checksum mismatch' >&2; exit 1; }
  # Verify age BEFORE executing Node. HTTP Last-Modified is not release evidence.
  curl --proto '=https' --tlsv1.2 -fsSL https://nodejs.org/dist/index.json -o .setup/node-index.json
  release_date=$(tr '{' '\n' < .setup/node-index.json | sed -n "s/.*\"version\":\"v$version\",\"date\":\"\([0-9-]*\)\".*/\1/p")
  [ -n "$release_date" ] || { echo 'Missing Node publication date' >&2; exit 1; }
  if [ "$os" = darwin ]; then released=$(date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "${release_date}T23:59:59Z" +%s); else released=$(date -u -d "${release_date}T23:59:59Z" +%s); fi
  [ "$released" -lt "$(($(date -u +%s) - 604800))" ] || { echo 'The Node release is not older than seven days' >&2; exit 1; }
  tar -xzf ".setup/$name.tar.gz" -C .setup
fi
export PATH="$PWD/.setup/$name/bin:$PATH"
".setup/$name/bin/node" scripts/setup.mjs "$@"
echo 'Activate in this terminal: . ./.setup/env.sh'
