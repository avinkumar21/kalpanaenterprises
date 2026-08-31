@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   ARKA BUILD & SYNC AUTOMATION
echo ========================================================

echo [1/4] Validating Frontend Production Build (Vite)...
cd /d "d:\Arka\kalpana-enterprises\frontend"
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build failed! Aborting sync.
    exit /b %ERRORLEVEL%
)
echo [OK] Frontend built successfully!

echo [2/4] Validating Backend Node.js Integrity...
cd /d "d:\Arka\kalpana-enterprises"
node -e "require('./backend/src/routes/print.routes.js'); require('./services/print/drivers/printer_manager.js'); console.log('[OK] Backend syntax verified');"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend validation failed! Aborting sync.
    exit /b %ERRORLEVEL%
)

echo [3/4] Staging and Committing Changes...
cd /d "d:\Arka\kalpana-enterprises"
set COMMIT_MSG=%*
if "%COMMIT_MSG%"=="" set COMMIT_MSG=chore(update): build verification and codebase sync

git add .
git commit -m "%COMMIT_MSG%"

echo [4/4] Pushing to Remote Repository (origin main)...
git push origin main
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git push failed! Please check network and remote configuration.
    exit /b %ERRORLEVEL%
)

echo ========================================================
echo   SUCCESS: Build passed and changes pushed to repo!
echo ========================================================
