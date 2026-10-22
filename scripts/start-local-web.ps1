$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath (Join-Path $repo 'apps/web')
$env:NEXT_PUBLIC_API_URL = 'http://localhost:8000'
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run dev -- --webpack --hostname localhost --port 3000
