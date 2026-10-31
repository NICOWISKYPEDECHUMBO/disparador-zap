@echo off
cd /d "%~dp0"
title Disparador Zap - nao feche esta janela

if not exist "runtime\node\node.exe" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1"
if not exist "runtime\node\node.exe" (
  echo Falha ao baixar o Node. Verifique a internet.
  pause
  exit /b 1
)

set "PATH=%~dp0runtime\node;%PATH%"

if not exist "node_modules\puppeteer-core" (
  echo Instalando dependencias, so na primeira vez...
  call npm install --no-audit --no-fund
)

echo.
echo Abrindo o Disparador Zap...
node server.js
pause
