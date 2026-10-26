param([Parameter(Mandatory=$true)][string]$BuildTools, [Parameter(Mandatory=$true)][string]$WebView,
      [Parameter(Mandatory=$true)][string]$ExpectedBuild, [Parameter(Mandatory=$true)][string]$ExpectedWebView)
$ErrorActionPreference = 'Stop'
$logRoot = Join-Path (Split-Path $PSScriptRoot -Parent) '.setup'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$errorFile = Join-Path $logRoot 'native-error.txt'
$logFile = Join-Path $logRoot 'native-install.log'
if ($ExpectedBuild -notmatch '^\d+(\.\d+){3}$' -or $ExpectedWebView -notmatch '^\d+(\.\d+){3}$') { throw 'Invalid version parameters' }
. (Join-Path $PSScriptRoot 'windows-native-tools.ps1')
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$installed = @(Get-UriNamuBuildTools -VsWhere $vswhere)
$machineWebViews = @('HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\*', 'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\*') | ForEach-Object {
    Get-ItemProperty -Path $_ -ErrorAction SilentlyContinue | Where-Object name -like '*WebView2*' | Select-Object -ExpandProperty pv
}
$needsElevation = Test-UriNamuNeedsElevation -ExpectedBuild $ExpectedBuild -ExpectedWebView $ExpectedWebView -InstalledBuildVersions @($installed | ForEach-Object { $_.installationVersion }) -MachineWebViewVersions @($machineWebViews)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if ($needsElevation -and -not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    if (Test-Path -LiteralPath $errorFile) { Remove-Item -LiteralPath $errorFile -Force }
    # Windows requires UAC for the compiler/SDK; propagate the real child exit status.
    $arguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"'),
      '-BuildTools',('"' + $BuildTools + '"'),'-WebView',('"' + $WebView + '"'),'-ExpectedBuild',$ExpectedBuild,'-ExpectedWebView',$ExpectedWebView)
    Write-Host 'A system installation requires administrator rights. Requesting Windows UAC ...'
    try {
        $child = Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
    } catch {
        throw "Windows could not complete elevation. If no UAC prompt appears, open PowerShell from the Start menu using Run as administrator and run Setup-Windows.cmd again. Original error: $($_.Exception.Message)"
    }
    if ($child.ExitCode -ne 0) {
        $details = if (Test-Path -LiteralPath $errorFile) { Get-Content -LiteralPath $errorFile -Raw } else { 'The elevated process did not write an error report.' }
        throw "Native setup failed (exit code $($child.ExitCode)):`n$details`nLog: $logFile"
    }
    exit 0
}
Start-Transcript -Path $logFile -Append -Force | Out-Null
try {
Write-Host 'Checking Microsoft installer signatures ...'
foreach ($file in @($BuildTools, $WebView)) {
    $signature = Get-AuthenticodeSignature -LiteralPath $file
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { throw "Invalid Microsoft signature: $file" }
}
if (-not ($installed | Where-Object installationVersion -eq $ExpectedBuild)) {
    Write-Host "Installing Build Tools $ExpectedBuild ..."
    # A separate install path prevents modifying an unrelated Visual Studio installation.
    $installPath = Join-Path ${env:ProgramFiles(x86)} "UriNamu-BuildTools-$ExpectedBuild"
    $arguments = @('--passive','--wait','--norestart','--noUpdateInstaller','--installPath',('"' + $installPath + '"'),
      '--add','Microsoft.VisualStudio.Workload.VCTools','--add','Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '--add','Microsoft.VisualStudio.Component.Windows11SDK.26100')
    $result = Start-Process -FilePath $BuildTools -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
    if ($result.ExitCode -eq 3010) { throw 'Build Tools installed. Restart Windows, then run setup again.' }
    if ($result.ExitCode -ne 0) { throw "Build Tools failed: $($result.ExitCode)" }
    $installed = @(Get-UriNamuBuildTools -VsWhere $vswhere)
    if (-not ($installed | Where-Object installationVersion -eq $ExpectedBuild)) { throw 'The installed Build Tools version does not match the dated release.' }
}
# Activate the verified instance explicitly; Cargo must not discover a newer global MSVC.
$selected = $installed | Where-Object installationVersion -eq $ExpectedBuild | Select-Object -First 1
Write-Host "Activating existing Build Tools $ExpectedBuild ..."
$nativeEnv = Get-UriNamuMsvcEnvironment -InstallationPath $selected.installationPath
$nativeEnv | ConvertTo-Json | Set-Content -LiteralPath (Join-Path (Split-Path $BuildTools -Parent) 'native-env.json') -Encoding UTF8
# WebView2 may already be installed per-user or per-machine.
Write-Host "Checking/installing WebView2 $ExpectedWebView ..."
$versions = @('HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\*', 'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\*', 'HKCU:\Software\Microsoft\EdgeUpdate\Clients\*') | ForEach-Object {
    Get-ItemProperty -Path $_ -ErrorAction SilentlyContinue | Where-Object name -like '*WebView2*' | Select-Object -ExpandProperty pv
}
foreach ($version in ($versions | Where-Object { [version]$_ -gt [version]$ExpectedWebView } | Select-Object -Unique)) {
    # Only replace the identified WebView runtime; never remove Microsoft Edge itself.
    foreach ($base in @(${env:ProgramFiles(x86)},$env:ProgramFiles,$env:LOCALAPPDATA)) {
        $uninstaller = Join-Path $base "Microsoft\EdgeWebView\Application\$version\Installer\setup.exe"
        if (-not (Test-Path -LiteralPath $uninstaller)) { continue }
        $signature = Get-AuthenticodeSignature -LiteralPath $uninstaller
        if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { throw 'The WebView2 uninstaller does not have a valid signature' }
        $arguments = @('--uninstall','--msedgewebview','--force-uninstall')
        if ($base -ne $env:LOCALAPPDATA) { $arguments += '--system-level' }
        $removed = Start-Process -FilePath $uninstaller -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
        if ($removed.ExitCode -ne 0) { throw "Could not remove the too-recent WebView2 version ${version}: $($removed.ExitCode)" }
    }
}
if (($versions -contains $ExpectedWebView) -and -not ($versions | Where-Object { [version]$_ -gt [version]$ExpectedWebView })) { exit 0 }
$result = Start-Process -FilePath $WebView -ArgumentList '/silent','/install' -Wait -PassThru -WindowStyle Hidden
if ($result.ExitCode -ne 0) { throw "WebView2 failed: $($result.ExitCode)" }
$versions = @('HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\*', 'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\*', 'HKCU:\Software\Microsoft\EdgeUpdate\Clients\*') | ForEach-Object {
    Get-ItemProperty -Path $_ -ErrorAction SilentlyContinue | Where-Object name -like '*WebView2*' | Select-Object -ExpandProperty pv
}
if ($versions -notcontains $ExpectedWebView) { throw 'The installed WebView2 version does not match the verified manifest.' }
} catch {
    $details = ($_ | Format-List * -Force | Out-String) + [Environment]::NewLine + $_.ScriptStackTrace
    $details | Set-Content -LiteralPath $errorFile -Encoding UTF8
    Write-Error -Message $details -ErrorAction Continue
    exit 1
} finally {
    Stop-Transcript | Out-Null
}
