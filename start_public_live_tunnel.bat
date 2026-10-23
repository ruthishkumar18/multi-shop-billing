@echo off
title Multi-Shop Billing - Public Live HTTPS Launcher (Free Cloudflare Tunnel)
color 0B

echo ======================================================================
echo   MULTI-SHOP BILLING - PUBLIC LIVE HTTPS TUNNEL (100%% FREE)
echo   Keeps your database & data 100%% on your local PC storage!
echo ======================================================================
echo.

REM Check if cloudflared exists in current directory or PATH
where cloudflared >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Cloudflare Tunnel client detected.
    goto launch_cloudflare
)

if exist "cloudflared.exe" (
    echo [OK] Local cloudflared.exe detected.
    goto launch_local_cloudflare
)

REM Check if ngrok exists
where ngrok >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] ngrok detected. Launching ngrok tunnel on Port 5000...
    ngrok http 5000
    goto end
)

if exist "ngrok.exe" (
    echo [OK] Local ngrok.exe detected. Launching ngrok tunnel on Port 5000...
    ngrok.exe http 5000
    goto end
)

echo [!] Neither 'cloudflared' nor 'ngrok' was detected on your system.
echo.
echo To make your website live on the internet for free:
echo.
echo Option 1 (Recommended - 100%% Free, No account required):
echo   1. Download 'cloudflared-windows-amd64.exe' from:
echo      https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
echo   2. Rename it to 'cloudflared.exe' and place it inside this project folder.
echo   3. Run this batch file again!
echo.
echo Option 2 (Winget install via Windows Terminal):
echo   winget install --id Cloudflare.cloudflared
echo.
echo Option 3 (ngrok):
echo   Download from https://ngrok.com and put ngrok.exe in this folder.
echo.
pause
goto end

:launch_cloudflare
echo [*] Starting Cloudflare Tunnel forwarding to http://localhost:5000...
echo [*] Look for the 'https://*.trycloudflare.com' URL below:
echo.
cloudflared tunnel --url http://localhost:5000
goto end

:launch_local_cloudflare
echo [*] Starting local cloudflared.exe forwarding to http://localhost:5000...
echo [*] Look for the 'https://*.trycloudflare.com' URL below:
echo.
cloudflared.exe tunnel --url http://localhost:5000
goto end

:end
pause
