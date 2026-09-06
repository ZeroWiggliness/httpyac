$dockerArguments = @(
    'run'
    '--rm'
    '-it'
    '--volume'
    "$((Get-Location).Path):/workspace"
    '--workdir'
    '/workspace'
    'node:24'
    'npm'
)

& docker @dockerArguments @args
exit $LASTEXITCODE