$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$env:APP_ENV = 'test'
$env:DATABASE_URL = 'sqlite+aiosqlite:///./local_validation.db'
$env:JWT_SECRET = 'local-test-secret-only-not-for-production'
$env:GEMINI_API_KEY = ''
$env:CLERK_SECRET_KEY = ''
$env:OCR_CACHE_PATH = 'local_ocr_validation.sqlite3'
python -B -m pytest apps/api/tests -q -p no:cacheprovider
exit $LASTEXITCODE
