@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM  Shuacha backend - one-click start (FastAPI + uvicorn)
REM  - single instance: skip if port 8000 is already listening
REM  - auto-open http://localhost:8000/docs once ready
REM ============================================================
set PORT=8000
set URL=http://localhost:%PORT%

REM ---- 1. check for an already-running instance ----
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if !errorlevel!==0 (
    echo [already running] backend is up at %URL%, opening docs.
    start "" "%URL%/docs"
    exit /b 0
)

REM ---- 2. start backend in a background window ----
echo starting backend at %URL% ...
cd /d "%~dp0apps\api"
start "Shuacha Backend" /min python -m uvicorn main:app --host 0.0.0.0 --port %PORT% --reload

REM ---- 3. wait until ready (up to 20s) ----
set /a n=0
:waitloop
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if !errorlevel!==0 goto ready
set /a n+=1
if !n! lss 20 goto waitloop

:ready
echo backend ready, opening %URL%/docs
start "" "%URL%/docs"
echo.
echo stop backend: close the "Shuacha Backend" window.
