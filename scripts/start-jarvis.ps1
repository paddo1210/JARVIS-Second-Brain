$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location $projectRoot

Write-Host ''
Write-Host 'J.A.R.V.I.S. // WINDOWS STARTUP' -ForegroundColor Cyan
Write-Host ('Projekt: ' + $projectRoot)
Write-Host ''

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    throw 'Node.js wurde nicht gefunden. Bitte Node.js LTS installieren.'
}

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
    Write-Host 'Abhaengigkeiten fehlen. npm install wird ausgefuehrt ...' -ForegroundColor Yellow
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) {
        throw 'npm install ist fehlgeschlagen.'
    }
}

$initScript = Join-Path $projectRoot 'scripts\init-local-db.ps1'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $initScript
if ($LASTEXITCODE -ne 0) {
    throw 'Datenbankinitialisierung ist fehlgeschlagen.'
}

$memoryRunning = $false
try {
    $connection = New-Object System.Net.Sockets.TcpClient
    $async = $connection.BeginConnect('127.0.0.1', 4317, $null, $null)
    $memoryRunning = $async.AsyncWaitHandle.WaitOne(500, $false) -and $connection.Connected
    $connection.Close()
} catch {
    $memoryRunning = $false
}

if (-not $memoryRunning) {
    Write-Host 'Starte lokale Memory Bridge ...' -ForegroundColor Yellow
    $memoryScript = Join-Path $projectRoot 'scripts\start-memory-bridge.ps1'
    $memoryArgs = '-NoExit -NoProfile -ExecutionPolicy Bypass -File "' + $memoryScript + '"'
    Start-Process -FilePath 'powershell.exe' -ArgumentList $memoryArgs -WorkingDirectory $projectRoot
    Start-Sleep -Seconds 3
} else {
    Write-Host 'Memory Bridge laeuft bereits.' -ForegroundColor Green
}

Write-Host 'Starte J.A.R.V.I.S. unter http://localhost:5173 ...' -ForegroundColor Green
Start-Process -FilePath 'http://localhost:5173'
& npx.cmd vite
