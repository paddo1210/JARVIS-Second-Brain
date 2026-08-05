$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ""
Write-Host "J.A.R.V.I.S. // LOCAL MEMORY BRIDGE" -ForegroundColor Cyan
Write-Host "Daten: C:\Users\paddo\Documents\JARVIS\data\processed"
Write-Host "Adresse: http://127.0.0.1:4317"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js wurde nicht gefunden. Bitte Node.js LTS installieren."
}

node ".\scripts\memory-bridge.mjs"
