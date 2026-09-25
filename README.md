# Vinny Editor

A personal AI coding environment: a responsive PWA (phone + desktop, same live
workspace) backed by a Node/TypeScript server, with Qwen 3 running locally
through [Ollama](https://ollama.com) as the AI backend.

## Why this exists

Open it from your phone or your desktop, at the same time or at different
times, and it feels like one continuous workspace - not two separate local
copies. Open files, unsaved edits, chat history, terminal output and settings
all live on the server, not in the browser, so any device that connects just
resumes the live state.

## Architecture

```
apps/
  server/   Fastify + WebSocket backend. SQLite for state, node-pty for a
            shared terminal, simple-git for Git, ripgrep for search, and a
            proxy to Ollama's /api/chat for the AI panel.
  web/      Vite + React PWA. Monaco editor, xterm.js terminal, and a chat
            panel that renders AI-proposed file edits as a diff you must
            explicitly approve before anything is written to disk.
packages/
  shared/   Zod schemas + types shared between server and web: the WS
            protocol, settings, tabs, chat messages, git status, search.
scripts/
  tunnel.sh Wraps `cloudflared tunnel --url ...` for remote access.
```

The browser is a thin client. Every meaningful piece of state (open tabs,
unsaved buffer contents, chat history, the terminal's scrollback, settings)
lives in SQLite on the server and is pushed to every connected client over a
WebSocket. Reconnecting - from the same device or a different one - just
means asking for a fresh snapshot.

## Requirements

- Node.js 20+ (developed on Node 22)
- [Ollama](https://ollama.com) running locally with a Qwen 3 model pulled:
  ```bash
  ollama pull qwen3
  ```
- (Optional, for remote access) [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

## Getting started

```bash
npm install       # also builds packages/shared via postinstall - required before the server can run
cp .env.example .env
# edit .env: set AUTH_PASSPHRASE and SESSION_SECRET to something real

npm run server   # starts the backend on http://localhost:4310
npm run web      # in a second terminal: starts the Vite dev server
```

Open the URL Vite prints (defaults to `http://localhost:4173`). You'll be
asked for the passphrase you set in `.env` - the editor gives a real
terminal and file access, so it's never left open.

> `.env` is git-ignored on purpose (it holds your passphrase and session
> secret) - which also means `git pull` never restores it. If the login
> screen keeps rejecting a passphrase you're sure is right, check the file
> actually still exists (`dir .env` / `ls .env`) before anything else; if
> it doesn't, `cp .env.example .env` and set your values again.

### Production (single process)

```bash
npm run build
npm run --workspace @vinny-editor/server start
```

The server serves the built web app itself when `apps/web/dist` exists, so
you only need one process and one port.

## Remote access via Cloudflare Quick Tunnel

No domain, no account, no cost - just a rotating public HTTPS URL that
forwards to your local server. Ollama itself is never exposed; the tunnel
only reaches the backend server, which requires the passphrase for
everything.

```bash
npm run tunnel
```

This runs `cloudflared tunnel --url http://localhost:4310` (or whatever
`SERVER_PORT` you've set) and prints the public URL. Because Quick Tunnel
URLs rotate every time you start one, grab the URL from whichever device you
started it on - the Settings panel doesn't (yet) surface it automatically.

### Windows one-click start

`npm run tunnel` is a bash script and won't run in plain Windows `cmd`. On
Windows, use `start-windows.bat` at the repo root instead:

1. Download `cloudflared.exe` for Windows from the
   [cloudflared releases page](https://github.com/cloudflare/cloudflared/releases/latest)
   and place it directly in the repo root, next to `start-windows.bat`.
2. Double-click `start-windows.bat`. It builds the app, starts the server in
   its own window, waits a few seconds, then starts the tunnel in another
   window and prints the public URL there.

Both windows need to stay open while you're using it remotely.

## Security notes

- The server is sandboxed to `WORKSPACE_ROOT`; every filesystem path is
  resolved and checked before use, so it can't read or write outside it.
- All `/api/*` routes and the `/ws` upgrade require a signed session cookie,
  obtained by posting the passphrase to `/api/auth/login`.
- The AI never writes to disk directly. It proposes edits as a diff; you
  approve or reject each one from the chat panel.

## Scripts

| Command             | Description                                   |
| ------------------- | --------------------------------------------- |
| `npm run server`    | Start the backend in watch mode               |
| `npm run web`       | Start the Vite dev server                     |
| `npm run build`     | Production build of shared, server and web    |
| `npm run typecheck` | TypeScript checks across every workspace      |
| `npm run lint`      | ESLint across the monorepo                    |
| `npm run format`    | Format with Prettier                          |
| `npm run test`      | Unit tests (server: auth + path sandboxing)   |
| `npm run check`     | format:check + lint + typecheck + test        |
| `npm run tunnel`    | Start a Cloudflare Quick Tunnel to the server |
