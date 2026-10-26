function Get-UriNamuBuildTools {
    param([Parameter(Mandatory=$true)][string]$VsWhere)
    if (-not (Test-Path -LiteralPath $VsWhere)) { return }
    $json = & $VsWhere -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 Microsoft.VisualStudio.Component.Windows11SDK.26100 -format json
    if ($LASTEXITCODE -ne 0) { throw "vswhere failed: $LASTEXITCODE" }
    # PS 5.1 emits a JSON array as one pipeline object. Return it through a
    # function so the caller receives individual instances rather than an array
    # nested inside another array (which breaks Where-Object property matching).
    return (ConvertFrom-Json -InputObject ($json -join [Environment]::NewLine))
}

function Test-UriNamuNeedsElevation {
    param([string]$ExpectedBuild, [string]$ExpectedWebView,
          [string[]]$InstalledBuildVersions = @(), [string[]]$MachineWebViewVersions = @())
    if ($InstalledBuildVersions -notcontains $ExpectedBuild) { return $true }
    # Reusing an existing compiler/SDK and runtime is read-only. A missing runtime
    # can be installed per-user; replacing a machine-wide runtime needs elevation.
    return [bool]@($MachineWebViewVersions | Where-Object { $_ -ne $ExpectedWebView }).Count
}

function Get-UriNamuMsvcEnvironment {
    param([Parameter(Mandatory=$true)][string]$InstallationPath)
    $vsdevcmd = [IO.Path]::GetFullPath((Join-Path $InstallationPath 'Common7\Tools\VsDevCmd.bat'))
    if (-not (Test-Path -LiteralPath $vsdevcmd)) { throw "VsDevCmd.bat missing: $vsdevcmd" }
    if ($vsdevcmd -match '["\r\n%]') { throw 'Unsupported characters in the MSVC installation path' }
    # Start with CALL rather than nested outer quotes. PowerShell 5.1 and cmd /s
    # otherwise strip different quotes and truncate paths containing spaces.
    $lines = & $env:ComSpec /d /s /c ('call "{0}" -arch=x64 -host_arch=x64 >nul && set' -f $vsdevcmd) 2>&1
    if ($LASTEXITCODE -ne 0) { throw "MSVC activation failed (exit code $LASTEXITCODE): $($lines -join [Environment]::NewLine)" }
    $nativeEnv = @{}
    foreach ($line in $lines) {
        $parts = ([string]$line) -split '=',2
        if ($parts.Count -eq 2 -and $parts[0] -match '^(PATH|INCLUDE|LIB|LIBPATH|VSINSTALLDIR|VCINSTALLDIR|VCToolsInstallDir|VCToolsVersion|WindowsSdkDir|WindowsSDKVersion|WindowsSdkBinPath|UniversalCRTSdkDir|UCRTVersion)$') { $nativeEnv[$parts[0]] = $parts[1] }
    }
    foreach ($name in @('PATH','INCLUDE','LIB','VCToolsInstallDir','WindowsSdkDir')) {
        if (-not $nativeEnv[$name]) { throw "MSVC activation did not provide variable $name" }
    }
    return $nativeEnv
}
