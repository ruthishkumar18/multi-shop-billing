@echo off
title Multi-Shop Billing Management System - Single Port Launcher
color 0A

echo ======================================================================
echo    MULTI-SHOP BILLING MANAGEMENT SYSTEM (SINGLE-PORT UNIFIED MODE)
echo ======================================================================
echo.
echo  [Step 1/3] Verifying Python & MySQL Dependencies...
python -m pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [!] Pip install encountered a notice. Continuing...
)

echo.
echo  [Step 2/3] Checking Single-Port Frontend Build (dist\index.html)...
if not exist "dist\index.html" (
    echo    Building frontend bundle for single-port serving...
    call npm install --legacy-peer-deps
    call npm run build
) else (
    echo    Frontend bundle is ready in dist\
)

echo.
echo  [Step 3/3] Launching Unified Backend and Frontend on Port 5000...
echo.
echo  ----------------------------------------------------------------------
echo   System URL: http://localhost:5000
echo   Single Port: Both Frontend UI and Flask Backend are connected on 5000!
echo  ----------------------------------------------------------------------
echo.
start http://localhost:5000

python app.py
pause
