@echo off
REM Double-click this file to start Ollama, Vinny Editor, and a public
REM Cloudflare tunnel in one go - no manual commands needed. Requires
REM cloudflared.exe to already be in this same folder (see README for how
REM to get it), and Ollama to already be installed.

cd /d "%~dp0"

where ollama >nul 2>&1
if errorlevel 1 (
  echo.
  echo WARNING: the "ollama" command was not found - is Ollama installed?
  echo The AI chat will not work until Ollama is running. Continuing anyway...
) else (
  echo Checking if Ollama is already running...
  ollama list >nul 2>&1
  if errorlevel 1 (
    echo Ollama is not running - starting it in a new window...
    start "Vinny Editor - Ollama" cmd /k "ollama serve"
    echo Waiting for Ollama to come up...
    timeout /t 5 /nobreak >nul
  ) else (
    echo Ollama is already running.
  )
)

echo.
echo Building the latest code...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed - see the errors above. Not starting the server.
  pause
  exit /b 1
)

echo.
echo Starting the server in a new window...
start "Vinny Editor - Server" cmd /k "npm run --workspace @vinny-editor/server start"

echo Waiting a few seconds for it to come up...
timeout /t 5 /nobreak >nul

if not exist "%~dp0cloudflared.exe" (
  echo.
  echo cloudflared.exe not found in this folder - skipping the tunnel.
  echo The app is still running locally at http://localhost:4310
  pause
  exit /b 0
)

echo Starting the Cloudflare tunnel in a new window...
start "Vinny Editor - Tunnel" cmd /k "cloudflared.exe tunnel --url http://localhost:4310"

echo.
echo Done. These windows just opened (keep them all open):
echo   - "Vinny Editor - Ollama"  : only if it wasn't already running - the AI model engine
echo   - "Vinny Editor - Server"  : the app itself
echo   - "Vinny Editor - Tunnel"  : look here for your public https://...trycloudflare.com link
echo.
echo This window can be closed.
pause
