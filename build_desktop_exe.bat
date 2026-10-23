@echo off
title Build Standalone Desktop Executable (.exe) - Multi-Shop Billing
echo =========================================================================
echo Multi-Shop Billing Management System - Desktop .EXE Compiler
echo =========================================================================
echo.
echo Step 1: Checking Python environment...
python --version
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in your system PATH.
    echo Please install Python 3.10+ from python.org and check "Add Python to PATH".
    pause
    exit /b 1
)

echo.
echo Step 2: Installing PyInstaller and desktop requirements...
pip install pyinstaller pywebview pymysql werkzeug flask python-dotenv cryptography

echo.
echo Step 2.5: Verifying frontend bundle...
if not exist "dist\index.html" (
    echo [*] Frontend bundle not found locally. Downloading pre-compiled assets...
    python -c "import urllib.request, zipfile; urllib.request.urlretrieve('https://ais-pre-6v77nd5nj4dp35imkwhmr7-304539555218.asia-east1.run.app/dist.zip', 'dist.zip'); zipfile.ZipFile('dist.zip').extractall('.'); print('[+] Frontend dist ready!')"
)

echo.
echo Step 3: Compiling into standalone Windows Executable (.exe)...
pyinstaller --noconfirm --onedir --windowed --name "MultiShopBilling" ^
  --hidden-import=ctypes ^
  --hidden-import=_ctypes ^
  --add-data "dist;dist" ^
  --add-data "static;static" ^
  --add-data "schema.sql;." ^
  --add-data ".env.example;." ^
  desktop_launcher.py

echo.
if exist "dist\MultiShopBilling\MultiShopBilling.exe" (
    echo =========================================================================
    echo [SUCCESS] Desktop Application Compiled Successfully!
    echo Your standalone executable is located at:
    echo dist\MultiShopBilling\MultiShopBilling.exe
    echo =========================================================================
) else (
    echo [INFO] Single-file compilation fallback:
    pyinstaller --noconfirm --onefile --windowed --name "MultiShopBilling" desktop_launcher.py
    echo Check dist\MultiShopBilling.exe
)

echo.
pause
