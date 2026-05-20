# Полная Electron-сборка ZERNIX с дополнительной обфускацией Vite-бандла и манифестом SHA-256.
#
# В отличие от Python (PyArmor + Nuitka в NovaBoost), приложение на Electron — это Chromium + V8.
# Исходный TypeScript/React уже компилируется в JS и минифицируется; здесь добавляется обфускация
# артефактов dist/assets и контрольные суммы exe/asar. Это повышает стоимость реверса, не «невзламываемый замок».

param(
    [switch]$SkipObfuscate
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Assert-LastExit {
    param([string]$Step)
    if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE)" }
}

Write-Host "== ZERNIX Dungeon Assistant — protected dist (Electron) ==" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"

Write-Host "`n[1/4] npm run build (tsc + vite)…" -ForegroundColor Yellow
npm run build
Assert-LastExit "npm run build"

if (-not $SkipObfuscate) {
    Write-Host "`n[2/4] Obfuscate dist/assets (*.js)…" -ForegroundColor Yellow
    node scripts/obfuscate-for-pack.mjs
    Assert-LastExit "obfuscate-for-pack"
} else {
    Write-Host "`n[2/4] Skipped (-SkipObfuscate)" -ForegroundColor DarkYellow
}

Write-Host "`n[3/4] electron-builder (full app)…" -ForegroundColor Yellow
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder
Assert-LastExit "electron-builder"

Write-Host "`n[4/4] Integrity manifest…" -ForegroundColor Yellow
node scripts/write-dist-integrity.mjs
Assert-LastExit "write-dist-integrity"

Write-Host "`nГотово. Артефакты: dist_electron\" -ForegroundColor Green
Write-Host "Манифест: dist_electron\zernix-dungeon-assistant.integrity.json"
