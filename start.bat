@echo off
title Toll System Launcher
echo ===================================================
echo Starting Toll System (Django Backend + React Frontend)
echo ===================================================

cd /d "%~dp0"

echo [1/2] Launching Django backend (Port 8000)...
start "Django Backend" cmd /k ".\.venv\Scripts\python.exe TollSystem\manage.py runserver 8000"

echo [2/2] Launching React frontend (Port 5173)...
cd tollfrontend
start "React Frontend" cmd /k "npm run dev"

echo.
echo Both servers launching!
echo React UI:       http://localhost:5173/
echo Django API:     http://127.0.0.1:8000/
echo.
