$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
foreach ($tool in @('node','npm.cmd','cargo','rustup')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Missing prerequisite: $tool. Read README.md first."
    }
}
Write-Host 'UriNamu: install locked packages, run tests and build the Windows installer.'
& npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
& npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
& cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features --lib
if ($LASTEXITCODE -ne 0) { throw 'Rust tests failed' }
& npm.cmd run desktop:build -- --bundles nsis -- --locked
if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed' }
Write-Host 'Done: src-tauri\target\release\bundle\nsis'
Invoke-Item 'src-tauri\target\release\bundle\nsis'
