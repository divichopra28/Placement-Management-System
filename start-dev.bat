@echo off
REM Starts the backend API (port 5000) and the React dev server (port 5173) in two windows.
cd /d "%~dp0"
start "Placement API" cmd /k "cd backend && npm start"
start "Placement Frontend" cmd /k "cd frontend && npm run dev"
echo Backend:  http://localhost:5000/api/health
echo Frontend: http://localhost:5173
