@echo off
if exist "%~dp0dist\snap_backend\snap_backend.exe" (
    "%~dp0dist\snap_backend\snap_backend.exe" --native
) else (
    python "%~dp0server.py" --native
)
