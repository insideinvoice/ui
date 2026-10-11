@echo off
REM Inside Invoice - Local Database Backup Script
REM Double-click to run
REM
REM What it does:
REM 1. Asks for your email and password (same as UI login)
REM 2. Validates against the backend
REM 3. If admin, downloads a raw SQL dump to %USERPROFILE%\Desktop\InsideInvoice-Backups\
REM 4. The .sql file can be restored with: psql -d yourdb -f backup.sql
REM
REM Test credentials: invoiceinside / insideinvoice

REM ─── Configuration ─────────────────────────────────────────────────────
set "API_BASE=https://api.insideinvoice.in/api"
REM set "API_BASE=http://localhost:8080/api"  REM Local development (uncomment for local)
set "BACKUP_DIR=%USERPROFILE%\Desktop\InsideInvoice-Backups"
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "DATETIME=%%I"
set "TIMESTAMP=%DATETIME:~0,4%-%DATETIME:~4,2%-%DATETIME:~6,2%-%DATETIME:~8,2%-%DATETIME:~10,2%"
set "BACKUP_FILE=%BACKUP_DIR%\insideinvoice-%TIMESTAMP%.sql"
REM ────────────────────────────────────────────────────────────────────────

echo ╔══════════════════════════════════════════════════════════════╗
echo ║     Inside Invoice - Local Database Backup                    ║
echo ║     Downloads raw SQL dump to %USERPROFILE%\Desktop\InsideInvoice-Backups\║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Create backup directory
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM ─── Step 1: Get credentials ─────────────────────────────────────────
echo Please enter your Inside Invoice login credentials:
echo (Same as you use to login to the web app)
echo.

set /p EMAIL=Email: 
if "%EMAIL%"=="" (
    echo Error: Email cannot be empty
    pause
    exit /b 1
)

REM Read password silently (PowerShell trick)
for /f "delims=" %%p in ('powershell -Command "$pwd = Read-Host -AsSecureString 'Password: '; [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pwd))"') do set "PASSWORD=%%p"
echo.
if "%PASSWORD%"=="" (
    echo Error: Password cannot be empty
    pause
    exit /b 1
)

echo.
echo Validating credentials...

REM ─── Step 2: Login to get JWT ────────────────────────────────────────
set "LOGIN_JSON={\"email\":\"%EMAIL%\",\"password\":\"%PASSWORD%\"}"
for /f "delims=" %%i in ('curl -s -w "\n%%{http_code}" -X POST -H "Content-Type: application/json" -d "%LOGIN_JSON%" "%API_BASE%/backup/login"') do set "RESPONSE=%%i"

REM Parse response (last line is HTTP code)
set "HTTP_CODE=%RESPONSE:~-3%"
set "BODY=%RESPONSE:~0,-3%"

if "%HTTP_CODE%" neq "200" (
    echo ✗ Login failed: %BODY%
    pause
    exit /b 1
)

REM Extract token (simple extraction for JWT)
for /f "tokens=2 delims=:" %%t in ('echo %BODY% ^| findstr /R "token"') do set "TOKEN=%%t"
REM Clean up token (remove quotes and trailing chars)
set "TOKEN=%TOKEN:"=%"
set "TOKEN=%TOKEN:,=%"
set "TOKEN=%TOKEN:}=%"

if "%TOKEN%"=="" (
    echo ✗ Failed to extract token
    echo Response: %BODY%
    pause
    exit /b 1
)

echo ✓ Login successful
echo Downloading backup...

REM ─── Step 3: Download raw SQL dump ───────────────────────────────────
curl -s -w "\n%%{http_code}" -X GET -H "Authorization: Bearer %TOKEN%" -H "Accept: application/octet-stream" "%API_BASE%/backup/download" -o "%BACKUP_FILE%" > "%TEMP%\download_response.txt"

set /p HTTP_CODE= < "%TEMP%\download_response.txt"

if "%HTTP_CODE%"=="200" (
    echo ✓ Backup downloaded successfully!
    echo   File: %BACKUP_FILE%
    for %%A in ("%BACKUP_FILE%") do echo   Size: %%~zA bytes
    echo.
    echo To restore this backup:
    echo   psql -d your_database_name -f "%BACKUP_FILE%"
    echo.
    echo Or with pg_restore:
    echo   pg_restore -d your_database_name "%BACKUP_FILE%"
) else if "%HTTP_CODE%"=="401" (
    echo ✗ Session expired. Please run the script again.
    del "%BACKUP_FILE%" 2>nul
    pause
    exit /b 1
) else if "%HTTP_CODE%"=="403" (
    echo ✗ Access denied. Only admin users can download raw backups.
    del "%BACKUP_FILE%" 2>nul
    pause
    exit /b 1
) else (
    echo ✗ Download failed (HTTP %HTTP_CODE%)
    del "%BACKUP_FILE%" 2>nul
    pause
    exit /b 1
)

echo.
echo Done! Backup saved to %BACKUP_DIR%
echo.
pause