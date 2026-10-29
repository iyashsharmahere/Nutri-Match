@echo off
title NutriMatch Launcher
set "ROOT=%~dp0"

echo Starting backend on http://127.0.0.1:8000 ...
start "NutriMatch API" cmd /k "cd /d "%ROOT%backend" && pip install -r requirements.txt && python -m uvicorn main:app --reload --port 8000"

echo Starting frontend on http://localhost:5173 ...
start "NutriMatch Web" cmd /k "cd /d "%ROOT%frontend" && npm install && npm run dev"

echo.
echo   App:      http://localhost:5173
echo   API docs: http://127.0.0.1:8000/docs
echo.
pause
