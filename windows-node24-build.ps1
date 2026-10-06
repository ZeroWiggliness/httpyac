# Builds the project in a Node 24 Linux container, keeping container dependencies separate from Windows node_modules.

$root = $PSScriptRoot

docker run --rm `
  -v "${root}:/workspace" `
  -v httpyac-node-modules:/workspace/node_modules `
  -w /workspace `
  node:24 `
  sh -lc 'npm ci --include=optional && npm run build'

if ($LASTEXITCODE -ne 0) { throw "Node 24 Docker build failed with exit code $LASTEXITCODE" }