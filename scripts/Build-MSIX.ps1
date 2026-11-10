param(
    [string]$IdentityName = 'Darrit.UriNamu',
    [string]$Publisher = 'CN=7A7791F0-9BBF-47FD-AA66-31DE180F2FA1',
    [string]$PublisherDisplayName = 'Darrit',
    [string]$MakeAppx
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

if ($IdentityName -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]{1,48}[A-Za-z0-9]$') {
    throw 'IdentityName must be the 3-50 character package identity name from Partner Center.'
}
if (-not $Publisher.Trim().StartsWith('CN=') -or -not $PublisherDisplayName.Trim()) {
    throw 'Provide the exact Publisher and PublisherDisplayName from Partner Center.'
}
if (-not $MakeAppx) {
    $sdkBin = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
    $MakeAppx = Get-ChildItem -LiteralPath $sdkBin -Directory |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } |
        Sort-Object { [version]$_.Name } -Descending |
        ForEach-Object { Join-Path $_.FullName 'x64\makeappx.exe' } |
        Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $MakeAppx -or -not (Test-Path -LiteralPath $MakeAppx)) { throw 'Windows SDK MakeAppx.exe not found.' }

$appVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
if ($appVersion -notmatch '^(\d+)\.(\d+)\.(\d+)$') { throw 'MSIX requires a numeric application version.' }
$major = [int]$Matches[1] + 1
$minor = [int]$Matches[2]
$patch = [int]$Matches[3]
if ($major -gt 65535 -or $minor -gt 65535 -or $patch -gt 65535) { throw 'Application version exceeds the MSIX version range.' }
# Store packages need a non-zero major and a fourth component of zero.
$packageVersion = "$major.$minor.$patch.0"

Write-Host "Building UriNamu $appVersion for Microsoft Store (MSIX $packageVersion)."
& npm.cmd run desktop:build -- --no-bundle -- --locked
if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }

$stage = Join-Path (Resolve-Path 'src-tauri/target/release').Path 'msix-stage'
$outDir = Join-Path (Resolve-Path 'src-tauri/target/release').Path 'bundle/msix'
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage, (Join-Path $stage 'Assets'), (Join-Path $stage 'licenses'), $outDir -Force | Out-Null
Copy-Item -LiteralPath 'src-tauri/target/release/urinamu.exe' -Destination $stage
foreach ($icon in @('StoreLogo.png', 'Square44x44Logo.png', 'Square150x150Logo.png')) {
    Copy-Item -LiteralPath (Join-Path 'src-tauri/icons' $icon) -Destination (Join-Path $stage 'Assets')
}
Copy-Item -LiteralPath 'LICENSE.md', 'NOTICE' -Destination (Join-Path $stage 'licenses')
Copy-Item -Path 'src-tauri/licenses/*' -Destination (Join-Path $stage 'licenses') -Recurse
foreach ($notice in @('LICENSE.md', 'NOTICE', 'THIRD-PARTY-WEB.md', 'THIRD-PARTY-RUST.md')) {
    if (-not (Test-Path -LiteralPath (Join-Path $stage "licenses/$notice"))) { throw "Missing license notice: $notice" }
}

$identityXml = [Security.SecurityElement]::Escape($IdentityName)
$publisherXml = [Security.SecurityElement]::Escape($Publisher)
$displayXml = [Security.SecurityElement]::Escape($PublisherDisplayName)
$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
         xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
         IgnorableNamespaces="uap rescap">
  <Identity Name="$identityXml" Publisher="$publisherXml" Version="$packageVersion" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>UriNamu</DisplayName>
    <PublisherDisplayName>$displayXml</PublisherDisplayName>
    <Description>Build and preserve your family tree.</Description>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources><Resource Language="en-us" /></Resources>
  <Applications>
    <Application Id="UriNamu" Executable="urinamu.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="UriNamu" Description="Build and preserve your family tree." BackgroundColor="transparent" Square150x150Logo="Assets\Square150x150Logo.png" Square44x44Logo="Assets\Square44x44Logo.png" />
    </Application>
  </Applications>
  <Capabilities><rescap:Capability Name="runFullTrust" /></Capabilities>
</Package>
"@
[IO.File]::WriteAllText((Join-Path $stage 'AppxManifest.xml'), $manifest, (New-Object System.Text.UTF8Encoding $false))
$output = Join-Path $outDir "UriNamu_${packageVersion}_x64.msix"
& $MakeAppx pack /o /d $stage /p $output
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output)) { throw 'MSIX packaging failed.' }
Write-Host "Store submission package: $output"
Write-Host 'Unsigned: submit to Partner Center for certification and Microsoft signing. Do not distribute this package directly.'
