@echo off
setlocal
chcp 65001 >nul
title Subir Adictos al Flow a GitHub
cd /d "%~dp0"

set "GIT=git"
where git >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\Git\cmd\git.exe" (
    set "GIT=%ProgramFiles%\Git\cmd\git.exe"
  ) else (
    echo.
    echo Git no esta instalado. Descargalo en https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
  )
)

echo.
echo ==========================================================
echo   SUBIR LA TIENDA A TU GITHUB
echo ==========================================================
echo.
set /p GHUSER=Tu usuario de GitHub: 
if "%GHUSER%"=="" (
  echo Falta el usuario.
  pause
  exit /b 1
)

set "REPO=adictos-al-flow"
set /p REPOINPUT=Nombre del repositorio [%REPO%]: 
if not "%REPOINPUT%"=="" set "REPO=%REPOINPUT%"

echo.
echo Se abrira GitHub para crear el repositorio.
echo Elige "Public" y NO marques "Add a README file".
echo.
start "" "https://github.com/new?name=%REPO%"
echo Pulsa una tecla cuando el repositorio ya este creado...
pause >nul

"%GIT%" remote remove origin >nul 2>&1
"%GIT%" remote add origin "https://github.com/%GHUSER%/%REPO%.git"
"%GIT%" branch -M main

echo.
echo Subiendo archivos...
"%GIT%" push -u origin main
if errorlevel 1 (
  echo.
  echo No se pudo subir. Revisa el usuario y el nombre del repositorio.
  echo Si GitHub pide iniciar sesion, autoriza en la ventana del navegador.
  echo.
  pause
  exit /b 1
)

echo.
echo Listo. Repositorio publicado.
echo.
echo Para activar el sitio:
echo   Settings - Pages - Source: GitHub Actions
echo.
start "" "https://github.com/%GHUSER%/%REPO%/settings/pages"
echo Pulsa una tecla para abrir la guia de dominio y hosting...
pause >nul
notepad "README-TIENDA.md"
