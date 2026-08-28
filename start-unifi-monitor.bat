@echo off
setlocal
echo ===================================================
echo   UniFi Gateway Monitoring Tool (Version 1)
echo   Starting Installation and Execution...
echo ===================================================

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

:: Check for NPM
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in your PATH.
    echo Please install npm and try again.
    pause
    exit /b 1
)

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules\" (
    echo [INFO] First time setup: Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: Build the Next.js app if it hasn't been built yet
if not exist ".next\" (
    echo [INFO] Building the production application...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to build the application.
        pause
        exit /b 1
    )
)

:: Start the application
echo [INFO] Starting the application in PRODUCTION mode...
echo [INFO] Press Ctrl+C at any time to stop the server.
echo.

call npm run prod:all

pause
