# Regenerates package-lock.json on Linux (node:24, same as CI) so it stays valid for `npm ci` when developing on Windows.

$root = $PSScriptRoot
$tmp = Join-Path $env:TEMP 'lockgen'

Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $tmp | Out-Null
Copy-Item (Join-Path $root 'package.json'), (Join-Path $root 'package-lock.json') $tmp

docker run --rm -v "${tmp}:/work" -w /work node:24 npm install --package-lock-only --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }

Copy-Item (Join-Path $tmp 'package-lock.json') (Join-Path $root 'package-lock.json') -Force
Remove-Item $tmp -Recurse -Force

docker run --rm -v "${root}\package.json:/work/package.json:ro" -v "${root}\package-lock.json:/work/package-lock.json:ro" -w /work node:24 npm ci --dry-run --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw "npm ci dry-run failed with exit code $LASTEXITCODE" }
