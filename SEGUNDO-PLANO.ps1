param([ValidateSet(1,2,3)][int]$Conta = 1)
$ErrorActionPreference = 'Stop'
$zapPorta = 3209 + $Conta
try { $zapEstado = Invoke-RestMethod "http://127.0.0.1:$zapPorta/estado" -TimeoutSec 2 } catch { $zapEstado = $null }
if ($zapEstado) {
  Write-Host "A conta $Conta ja esta aberta. Encerre pelo painel antes de iniciar em segundo plano."
  exit 1
}
$zapNode = Join-Path $PSScriptRoot 'runtime\node\node.exe'
if (-not (Test-Path -LiteralPath $zapNode)) { throw 'Execute INICIAR.bat primeiro para instalar o Node e conectar o QR Code.' }
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'logs') | Out-Null
$env:ZAP_CONTA = [string]$Conta
$env:ZAP_HEADLESS = '1'
Start-Process -FilePath $zapNode -ArgumentList 'server.js' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot "logs\conta-$Conta.log") -RedirectStandardError (Join-Path $PSScriptRoot "logs\conta-$Conta-error.log")
Write-Host "Conta $Conta iniciada em segundo plano. Abra http://localhost:$zapPorta para conferir e liberar o Grok."
Write-Host 'Se pedir QR Code, encerre pelo painel e abra CONTA-N.bat para conectar com janela visivel.'
