@echo off
title Grid Energy Intelligence — Karnataka
echo  ======================================
echo   Grid Energy Intelligence Karnataka
echo   Real data from KPTCL SLDC
echo  ======================================
python --version >nul 2>&1 || (echo ERROR: Python not found && pause && exit /b 1)
node --version   >nul 2>&1 || (echo ERROR: Node.js not found && pause && exit /b 1)
set SCRIPT_DIR=%~dp0
echo [1/4] Setting up Python backend...
cd /d "%SCRIPT_DIR%backend"
if not exist "venv" python -m venv venv
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
echo [2/4] Starting backend...
start "Grid API" cmd /k "venv\Scripts\activate && python main.py"
timeout /t 3 /nobreak >nul
echo [3/4] Setting up frontend...
cd /d "%SCRIPT_DIR%frontend"
if not exist "node_modules" npm install
echo [4/4] Starting frontend...
start "Grid UI" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:5173
echo  Dashboard: http://localhost:5173
echo  KPTCL raw: http://localhost:8000/api/kptcl/raw
pause
