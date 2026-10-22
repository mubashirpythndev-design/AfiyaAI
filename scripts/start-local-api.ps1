$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo
$localDir = Join-Path $repo '.local'
New-Item -ItemType Directory -Path $localDir -Force | Out-Null
$dbPath = (Join-Path $localDir 'afiya.db').Replace('\', '/')
$env:DATABASE_URL = "sqlite+aiosqlite:///$dbPath"
$env:APP_ENV = 'development'
$env:FRONTEND_URL = 'http://localhost:3000'
$env:OCR_CACHE_PATH = Join-Path $localDir 'ocr-cache.sqlite3'
$secretPath = Join-Path $localDir 'jwt-secret.txt'
if (-not (Test-Path -LiteralPath $secretPath)) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    [Convert]::ToBase64String($bytes) | Set-Content -LiteralPath $secretPath
}
$env:JWT_SECRET = (Get-Content -LiteralPath $secretPath -Raw).Trim()
python -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000
