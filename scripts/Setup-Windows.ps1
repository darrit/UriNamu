param([switch]$Plan, [switch]$FrontendOnly)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$env:URINAMU_ORIGINAL_PATH = $env:Path
$policy = Get-Content -LiteralPath 'dependency-policy.json' -Raw | ConvertFrom-Json
$existingNode = Get-Command node.exe -ErrorAction SilentlyContinue
if ($existingNode) {
    $existingVersion = (& $existingNode.Source --version).TrimStart('v')
    if ($LASTEXITCODE -eq 0 -and $existingVersion -match '^\d+\.\d+\.\d+$' -and [version]$existingVersion -ge [version]$policy.node) {
        $arguments = @('scripts/setup.mjs')
        if ($Plan) { $arguments += '--plan' }
        if ($FrontendOnly) { $arguments += '--frontend-only' }
        & $existingNode.Source @arguments
        if ($LASTEXITCODE -ne 0) { throw "Setup failed (exit code $LASTEXITCODE)." }
        if (-not $Plan) { Write-Host 'Activate in this terminal: . .\.setup\env.ps1' }
        exit 0
    }
}
$cutoff = [DateTimeOffset]::UtcNow.AddDays(-7)
$releases = Invoke-RestMethod "https://nodejs.org/dist/index.json"
$release = $releases | Where-Object { $_.version -eq "v$($policy.node)" } | Select-Object -First 1
if (-not $release -or [DateTimeOffset]::Parse("$($release.date)T23:59:59.999Z") -ge $cutoff) { throw 'The pinned Node release is missing or is not older than seven days.' }
$architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
$nodeArch = switch ($architecture) { 'AMD64' {'x64'} 'ARM64' {'arm64'} default { throw "Unsupported architecture: $architecture" } }
$setupRoot = Join-Path $projectRoot '.setup'
$nodeRoot = Join-Path $setupRoot "node-v$($policy.node)-win-$nodeArch"
if (-not (Test-Path -LiteralPath "$nodeRoot\node.exe")) {
    New-Item -ItemType Directory -Force -Path $setupRoot | Out-Null
    $name = "node-v$($policy.node)-win-$nodeArch.zip"
    $url = "https://nodejs.org/dist/v$($policy.node)"
    $archive = Join-Path $setupRoot $name
    Invoke-WebRequest "$url/$name" -OutFile $archive -UseBasicParsing
    $sums = (Invoke-WebRequest "$url/SHASUMS256.txt" -UseBasicParsing).Content
    $expected = (($sums -split "`n" | Where-Object { $_.Trim().EndsWith("  $name") }) -split '\s+')[0]
    if (-not $expected -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Node-checksum mismatch.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $setupRoot -Force
}
$env:Path = "$nodeRoot;$env:Path"
$arguments = @('scripts/setup.mjs')
if ($Plan) { $arguments += '--plan' }
if ($FrontendOnly) { $arguments += '--frontend-only' }
& "$nodeRoot\node.exe" @arguments
if ($LASTEXITCODE -ne 0) { throw "Setup failed (exit code $LASTEXITCODE)." }
if (-not $Plan) { Write-Host 'Activate in this terminal: . .\.setup\env.ps1' }
