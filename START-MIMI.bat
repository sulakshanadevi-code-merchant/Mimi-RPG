@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "Mimi PWA Server" py -m http.server 8000
) else (
  start "Mimi PWA Server" python -m http.server 8000
)
timeout /t 1 /nobreak >nul
start "" http://127.0.0.1:8000/
