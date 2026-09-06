@echo off
title Package Snap Decode Portable Backend
cd /d "%~dp0"

echo =======================================================
echo   Packaging Snap Decode Standalone Backend...
echo   This creates a self-contained runtime in:
echo   backend\dist\snap_backend\
echo =======================================================

python -m PyInstaller --noconfirm --onedir --console --name snap_backend --distpath dist --workpath build --specpath . --collect-binaries pyzbar --collect-all uvicorn --collect-all fastapi --hidden-import cv2 server.py

if %ERRORLEVEL% equ 0 (
    echo.
    echo =======================================================
    echo   BUILD SUCCESSFUL!
    echo   Executable: backend\dist\snap_backend\snap_backend.exe
    echo   You can now run "start_backend.bat" on any clean Windows PC!
    echo =======================================================
) else (
    echo.
    echo [!] Build failed. Please check error logs above.
)

pause
