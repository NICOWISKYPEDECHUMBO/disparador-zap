# Baixa um Node portátil para a pasta runtime (não instala nada no Windows)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-Location $PSScriptRoot

$versao = 'v22.11.0'
if (-not (Test-Path 'runtime\node\node.exe')) {
    Write-Host 'Baixando Node portatil, so na primeira vez...'
    New-Item -ItemType Directory -Force runtime | Out-Null
    $zip = 'runtime\node.zip'
    Invoke-WebRequest "https://nodejs.org/dist/$versao/node-$versao-win-x64.zip" -OutFile $zip
    Expand-Archive $zip runtime -Force
    Rename-Item "runtime\node-$versao-win-x64" node
    Remove-Item $zip
}
