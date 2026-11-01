$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework compiler is unavailable' }
$source = Join-Path $projectRoot 'desktop\native\PanelFocusObserver.cs'
$output = Join-Path $projectRoot 'desktop\native\PanelFocusObserver.exe'
& $compiler /nologo /target:exe /platform:anycpu /optimize+ "/out:$output" $source
if ($LASTEXITCODE -ne 0) { throw 'Panel observer compilation failed' }
