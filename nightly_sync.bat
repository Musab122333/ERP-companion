@echo off
REM ============================================================
REM Nightly ERP Sync Pipeline
REM Runs Phase 2 (DBF sync) then Phase 3 (warehouse rebuild)
REM Scheduled via Windows Task Scheduler to run after 10 PM daily
REM ============================================================

setlocal enabledelayedexpansion

REM ── CONFIG — adjust these paths to match your setup ──────────
set DEMO_DIR=E:\demo
set PSQL_PATH="C:\Program Files\PostgreSQL\16\bin\psql.exe"
set DB_NAME=erp_warehouse
set DB_USER=erp_sync
set DB_HOST=localhost
set DB_PORT=5432

REM ── Load DB_PASSWORD from the same .env file Phase 2 uses ─────
REM This avoids psql prompting interactively, which would hang
REM forever when run unattended by Task Scheduler at night.
for /f "tokens=1,2 delims==" %%a in ('findstr /b "DB_PASSWORD=" "%DEMO_DIR%\.env"') do set PGPASSWORD=%%b

REM Timestamp for this run's log file
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set LOGDATE=%%c-%%a-%%b
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set LOGTIME=%%a%%b
set LOGFILE=%DEMO_DIR%\logs\nightly_%LOGDATE%_%LOGTIME%.log

if not exist "%DEMO_DIR%\logs" mkdir "%DEMO_DIR%\logs"

echo ============================================================ > "%LOGFILE%"
echo Nightly Sync Pipeline — Started %DATE% %TIME% >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"

REM ── Pre-flight checks — fail fast with a clear message ────────
if not exist %PSQL_PATH% (
    echo [FATAL] psql.exe not found at %PSQL_PATH% >> "%LOGFILE%"
    echo         Check your PostgreSQL installation path and version >> "%LOGFILE%"
    echo         number, then update PSQL_PATH at the top of this script. >> "%LOGFILE%"
    goto :end
)
if not exist "%DEMO_DIR%\.env" (
    echo [FATAL] .env file not found at %DEMO_DIR%\.env >> "%LOGFILE%"
    goto :end
)
if not exist "%DEMO_DIR%\phase2_sync_engine.py" (
    echo [FATAL] phase2_sync_engine.py not found in %DEMO_DIR% >> "%LOGFILE%"
    goto :end
)

REM ── STEP 1: Phase 2 — Sync DBF files into raw.* tables ────────
echo. >> "%LOGFILE%"
echo [STEP 1] Running Phase 2 incremental sync... >> "%LOGFILE%"
cd /d "%DEMO_DIR%"
python phase2_sync_engine.py --mode incremental >> "%LOGFILE%" 2>&1

if errorlevel 1 (
    echo [ERROR] Phase 2 sync failed — see log above. Stopping pipeline. >> "%LOGFILE%"
    echo Phase 2 FAILED at %TIME% >> "%LOGFILE%"
    goto :end
)
echo [OK] Phase 2 sync completed successfully >> "%LOGFILE%"

REM ── STEP 2: Phase 3 — Rebuild warehouse (dimensions, facts, views) ──
echo. >> "%LOGFILE%"
echo [STEP 2] Rebuilding warehouse — dimension tables... >> "%LOGFILE%"
%PSQL_PATH% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%DEMO_DIR%\01_dimension_tables.sql" >> "%LOGFILE%" 2>&1

if errorlevel 1 (
    echo [ERROR] Dimension table rebuild failed. Stopping pipeline. >> "%LOGFILE%"
    goto :end
)
echo [OK] Dimension tables rebuilt >> "%LOGFILE%"

echo. >> "%LOGFILE%"
echo [STEP 3] Rebuilding warehouse — fact tables... >> "%LOGFILE%"
%PSQL_PATH% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%DEMO_DIR%\02_fact_tables.sql" >> "%LOGFILE%" 2>&1

if errorlevel 1 (
    echo [ERROR] Fact table rebuild failed. Stopping pipeline. >> "%LOGFILE%"
    goto :end
)
echo [OK] Fact tables rebuilt >> "%LOGFILE%"

echo. >> "%LOGFILE%"
echo [STEP 4] Rebuilding dashboard views... >> "%LOGFILE%"
%PSQL_PATH% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%DEMO_DIR%\03_dashboard_views.sql" >> "%LOGFILE%" 2>&1

if errorlevel 1 (
    echo [ERROR] Dashboard view rebuild failed. >> "%LOGFILE%"
    goto :end
)
echo [OK] Dashboard views rebuilt >> "%LOGFILE%"

echo. >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"
echo Nightly Sync Pipeline — COMPLETED SUCCESSFULLY at %TIME% >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"

:end
endlocal
