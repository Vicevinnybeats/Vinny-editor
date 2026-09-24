#!/usr/bin/env bash
# Exposes the local Vinny Editor server over a free Cloudflare Quick Tunnel.
# No account, no domain, no cost - the URL rotates every time this runs.
#
# Ollama itself is never exposed: this only tunnels the backend server port,
# which is the sole public entry point and requires the auth passphrase.
set -euo pipefail

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed. See https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
  exit 1
fi

PORT="${SERVER_PORT:-4310}"
if [ -f .env ]; then
  ENV_PORT="$(grep -E '^SERVER_PORT=' .env | tail -n1 | cut -d= -f2)"
  PORT="${ENV_PORT:-$PORT}"
fi

echo "Starting a Cloudflare Quick Tunnel to http://localhost:${PORT}"
echo "The public URL will be printed below once the tunnel connects."
echo "Make sure 'npm run server' (and, in production, a built web app) is already running."
echo

exec cloudflared tunnel --url "http://localhost:${PORT}"
