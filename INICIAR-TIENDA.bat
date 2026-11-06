@echo off
setlocal
chcp 65001 >nul
title Adictos al Flow - Servidor local
cd /d "%~dp0tienda-server"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js no esta instalado.
  echo Descargalo en https://nodejs.org y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo.
  echo Se creo el archivo tienda-server\.env
  echo Escribe tu email y tu contrasena de administrador, guarda y cierra el Bloc de notas.
  echo.
  notepad ".env"
  exit /b 0
)

if not exist "node_modules\express" (
  echo Instalando dependencias del servidor...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto error
)

echo Preparando la cuenta de administrador...
call node seed.mjs
if errorlevel 1 goto error

echo.
echo Tienda:  http://localhost:3000
echo Admin:   boton "Admin" al pie de la pagina
echo.
echo Para detener el servidor cierra esta ventana o pulsa Ctrl+C.
echo.

start "" "http://localhost:3000"
node server.mjs
goto :eof

:error
echo.
echo Ocurrio un error. Revisa los mensajes de arriba.
pause
exit /b 1
