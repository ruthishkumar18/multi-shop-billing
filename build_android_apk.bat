@echo off
title Build Android Application (.apk) - Multi-Shop Billing
echo =========================================================================
echo Multi-Shop Billing Management System - Android .APK Builder
echo =========================================================================
echo.
echo Step 1: Building production web assets...
call npm run build

echo.
echo Step 2: Installing Capacitor Android tooling...
call npm install @capacitor/core @capacitor/cli @capacitor/android

echo.
echo Step 3: Initializing and syncing Android platform...
if not exist "android" (
    call npx cap add android
)
call npx cap sync android

echo.
echo Step 4: Compiling Android Debug APK...
cd android
call gradlew.bat assembleDebug

echo.
echo =========================================================================
echo [SUCCESS] Android APK built successfully!
echo APK location: android\app\build\outputs\apk\debug\app-debug.apk
echo Install on any Android mobile phone or tablet using:
echo adb install android\app\build\outputs\apk\debug\app-debug.apk
echo =========================================================================
echo.
pause
