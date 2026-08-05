param(
  [string]$InputPath = "C:\Users\paddo\Documents\JARVIS\data\imports\jarvis-chatgpt-export-2026-08-05.zip",
  [string]$OutputPath = "C:\Users\paddo\Documents\JARVIS\data\processed"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "J.A.R.V.I.S. // CHATGPT MEMORY IMPORT" -ForegroundColor Cyan
Write-Host "Quelle: $InputPath"
Write-Host "Ziel:   $OutputPath"
Write-Host ""

if (-not (Test-Path -LiteralPath $InputPath)) {
  Write-Host "FEHLER: Die Exportdatei wurde nicht gefunden." -ForegroundColor Red
  Write-Host "Erwartet: $InputPath"
  exit 1
}

Push-Location $ProjectRoot
try {
  node ".\scripts\import-chatgpt-export.mjs" --input $InputPath --output $OutputPath
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host ""
  Write-Host "Import erfolgreich abgeschlossen." -ForegroundColor Green
  Write-Host "Die aufbereiteten Daten liegen unter: $OutputPath"
} finally {
  Pop-Location
}
