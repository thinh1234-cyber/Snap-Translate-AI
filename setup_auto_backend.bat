@echo off
title Setup Snap Decode Zero-Touch Auto Backend
cd /d "%~dp0"

echo =======================================================
echo   Cai Dat Khoi Dong Tu Dong Cho Snap Decode
echo =======================================================

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

set "HOST_BAT=%ROOT_DIR%\backend\snap_host.bat"
set "HOST_JSON=%ROOT_DIR%\backend\native_host.json"

set "ESCAPED_PATH=%HOST_BAT:\=\\%"

echo [*] Tao file cau hinh Native Host: %HOST_JSON%
(
  echo {
  echo   "name": "com.kyle.snap_decode",
  echo   "description": "Snap Decode Native Vision Host",
  echo   "path": "%ESCAPED_PATH%",
  echo   "type": "stdio",
  echo   "allowed_origins": [
  echo     "chrome-extension://diajblcbjfhgiapfgocbpkgnhdhagobi/"
  echo   ]
  echo }
) > "%HOST_JSON%"

echo [*] Dang ky vao Windows Registry cho Chrome va Edge...
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.kyle.snap_decode" /ve /t REG_SZ /d "%HOST_JSON%" /f
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.kyle.snap_decode" /ve /t REG_SZ /d "%HOST_JSON%" /f

echo =======================================================
echo   [OK] HOAN TAT!
echo   Tu bay gio, moi khi ban click Snap hoac nhan Alt+X:
echo   1. Backend se TU DONG KHOI DONG NGAM.
echo   2. Xu ly OCR / QR code xong se TU DONG TAT (Shutdown).
echo   3. Ban KHONG CAN mo bat ky file .bat hay terminal nao!
echo =======================================================
