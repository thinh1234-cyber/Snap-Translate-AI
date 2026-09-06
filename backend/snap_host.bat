@echo off
python --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    python "%~dp0server.py" --native
    exit /b %ERRORLEVEL%
)

if exist "%~dp0dist\snap_backend\snap_backend.exe" (
    "%~dp0dist\snap_backend\snap_backend.exe" --native
    exit /b %ERRORLEVEL%
)
