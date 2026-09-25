@echo off
REM Double-click this file to start Vinny Editor and a public Cloudflare tunnel
REM in one go - no manual commands needed. Requires cloudflared.exe to already
REM be in this same folder (see README for how to get it).

cd /d "%~dp0"

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
echo Done. Two new windows just opened:
echo   - "Vinny Editor - Server"  : keep this open, this is the app itself
echo   - "Vinny Editor - Tunnel"  : look here for your public https://...trycloudflare.com link
echo.
echo This window can be closed.
pause
