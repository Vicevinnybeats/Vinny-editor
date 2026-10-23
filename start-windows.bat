@echo off
setlocal enabledelayedexpansion
REM Double-click this file to start Ollama, Vinny Editor, and a public
REM tunnel in one go - no manual commands needed. Requires Ollama to already
REM be installed, and either ngrok.exe (for a permanent address - see the
REM README's "Permanent address" section) or cloudflared.exe (rotating
REM address, zero setup) in this same folder.

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

if exist "%~dp0ngrok.exe" if exist "%~dp0ngrok-domain.txt" (
  set /p NGROK_DOMAIN=<"%~dp0ngrok-domain.txt"
  echo Starting the ngrok tunnel at https://!NGROK_DOMAIN!...
  start "Vinny Editor - Tunnel" cmd /k "ngrok.exe http 4310 --domain=!NGROK_DOMAIN!"
  echo.
  echo Done. These windows just opened (keep them all open):
  echo   - "Vinny Editor - Ollama"  : only if it wasn't already running - the AI model engine
  echo   - "Vinny Editor - Server"  : the app itself
  echo   - "Vinny Editor - Tunnel"  : your permanent address is https://!NGROK_DOMAIN!
  echo.
  echo This window can be closed.
  pause
  exit /b 0
)

if not exist "%~dp0cloudflared.exe" (
  echo.
  echo No tunnel tool found in this folder - skipping the tunnel.
  echo The app is still running locally at http://localhost:4310
  echo See the README's "Permanent address" section for a one-time ngrok setup.
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
echo     (this link changes every time you start it - see the README's
echo     "Permanent address" section to stop that from happening)
echo.
echo This window can be closed.
pause
