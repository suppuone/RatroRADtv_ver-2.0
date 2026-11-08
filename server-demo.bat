
@echo off
setlocal
title RetroRADtv V3 - Demo Server

cd /d "%~dp0"

if not exist "index.html" (
    echo ERROR: index.html not found.
    echo Place this BAT file in the RetroRADtv project folder.
    pause
    exit /b 1
)

set "PORT=8000"

where py >nul 2>&1
if not errorlevel 1 (
    set "PYTHON=py -3"
    goto start
)

where python >nul 2>&1
if not errorlevel 1 (
    set "PYTHON=python"
    goto start
)

echo ERROR: Python is not installed or not on PATH.
echo Install Python from https://www.python.org/downloads/
pause
exit /b 1

:start
echo.
echo ======================================
echo       RetroRADtv V3 Demo Server
echo ======================================
echo.
echo Local URL: http://localhost:%PORT%
echo.
echo Press CTRL+C to stop the server.
echo.

start "" "http://localhost:%PORT%"
%PYTHON% -m http.server %PORT% --bind 0.0.0.0

echo.
echo Server stopped.
pause
