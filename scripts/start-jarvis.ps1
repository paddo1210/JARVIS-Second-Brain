$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

Write-Host ""
Write-Host "J.A.R.V.I.S. // WINDOWS STARTUP" -ForegroundColor Cyan
Write-Host "Projekt: $projectRoot"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js wurde nicht gefunden. Bitte Node.js LTS installieren."
}

if (-not (Test-Path ".\node_modules")) {
  Write-Host "Abhängigkeiten fehlen — npm install wird ausgeführt ..." -ForegroundColor Yellow
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) { throw "npm install ist fehlgeschlagen." }
}

& powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\init-local-db.ps1"
if ($LASTEXITCODE -ne 0) { throw "Datenbankinitialisierung ist fehlgeschlagen." }

$memoryPortOpen = Test-NetConnection -ComputerName 127.0.0.1 -Port 4317 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $memoryPortOpen) {
  Write-Host "Starte lokale Memory Bridge ..." -ForegroundColor Yellow
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$projectRoot\scripts\start-memory-bridge.ps1`""
  ) -WorkingDirectory $projectRoot
  Start-Sleep -Seconds 2
} else {
  Write-Host "Memory Bridge läuft bereits." -ForegroundColor Green
}

Write-Host "Starte J.A.R.V.I.S. unter http://localhost:5173 ..." -ForegroundColor Green
Start-Process "http://localhost:5173"
& npx.cmd vite
