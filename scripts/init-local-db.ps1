param(
  [string]$ConfigPath = ".\wrangler.local.jsonc"
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

Write-Host ""
Write-Host "J.A.R.V.I.S. // LOCAL DATABASE INIT" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $ConfigPath)) {
  throw "Lokale Wrangler-Konfiguration fehlt: $ConfigPath"
}

$files = Get-ChildItem ".\drizzle\*.sql" | Sort-Object Name
if (-not $files) {
  throw "Keine SQL-Migrationen im Ordner drizzle gefunden."
}

$tempSql = Join-Path $env:TEMP "jarvis-local-migrations.sql"
$combined = New-Object System.Collections.Generic.List[string]
$combined.Add("PRAGMA foreign_keys = ON;")

foreach ($file in $files) {
  Write-Host "Bereite $($file.Name) vor ..."
  $sql = Get-Content $file.FullName -Raw
  $sql = $sql -replace 'CREATE TABLE\s+`', 'CREATE TABLE IF NOT EXISTS `'
  $sql = $sql -replace 'CREATE INDEX\s+`', 'CREATE INDEX IF NOT EXISTS `'
  $combined.Add("-- $($file.Name)")
  $combined.Add($sql.Trim())
}

[System.IO.File]::WriteAllText($tempSql, ($combined -join "`r`n`r`n"), [System.Text.UTF8Encoding]::new($false))

Write-Host "Initialisiere lokale D1-Datenbank ..." -ForegroundColor Yellow
& npx wrangler d1 execute site-creator-d1 --local --config $ConfigPath --file $tempSql
if ($LASTEXITCODE -ne 0) {
  throw "Die lokale D1-Datenbank konnte nicht initialisiert werden."
}

Write-Host "Lokale Datenbank ist bereit." -ForegroundColor Green
