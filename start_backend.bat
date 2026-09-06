@echo off
title Snap Decode Backend Server
cd /d "%~dp0"

echo =======================================================
echo   Snap Decode Backend Server Launcher
echo   URL: http://127.0.0.1:8765
echo =======================================================

REM 1. Run using system Python (Latest source code & models)
python --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [*] Running with System Python...
    cd /d "%~dp0backend"
    python server.py
    goto finish
)

REM 2. Fallback: Standalone portable executable (Clean Windows - Zero Dependency)
if exist "%~dp0backend\dist\snap_backend\snap_backend.exe" (
    echo [*] Launching Portable Standalone Backend...
    echo [*] (No system Python required)
    "%~dp0backend\dist\snap_backend\snap_backend.exe"
    goto finish
)

echo [!] ERROR: No Python runtime or standalone package found!
echo [!] To run on a clean Windows machine:
echo     1. Make sure "backend\dist\snap_backend" is present, or
echo     2. Install Python 3.10+ and run "pip install -r backend\requirements.txt".
echo.

:finish
pause
