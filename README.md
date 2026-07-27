# maxAI 🚀

**maxAI** is the platform. **Max** is the AI — your own self-hosted assistant
with a polished chat interface, multiple model tiers and switchable
personalities. It runs anywhere Docker runs and connects to any AI endpoint
that speaks the standard Chat Completions API.

## Features

- **4 model tiers**: Max Lite ◈, Max Pro ◆, Max Beast ⬡ and Auto ✦ (which picks
  the right tier automatically based on the request).
- **Web search without an extra API key**: Max can look things up before
  answering — DuckDuckGo and Wikipedia, with the pages read as plain text — and
  cites its sources as chips under the answer. Toggle it per chat with the globe
  in the composer. See [Web search](docs/web-search.md).
- **6 personalities**: Casual, Assistant, Professional, Precise, Tutor and
  Creative, each layered on top of an optional custom instruction.
- **Minimalist interface**: a calm, typographic design with its own iris accent
  and a Fraunces serif for display — quiet surfaces, generous space, light &
  dark. The home screen opens with a time-of-day greeting instead of a static
  welcome line.
- **Rich answers**: live Markdown with syntax-highlighted code (and a copy
  button), tables, task lists, footnotes and LaTeX maths rendered with KaTeX.
- **Clean chat**: your messages sit in quiet cards; Max replies as readable
  prose. Tapback reactions, replies and date separators are all supported, with
  optional synthesised send/receive sounds.
- **Chat Mode**: message-by-message chatting with queued messages, tapback
  reactions and replies.
- **Regenerate & edit**: re-roll Max's last answer, or edit one of your messages
  and continue from there.
- **Dictation**: speak instead of typing, where the browser supports it.
- **Export**: download any conversation as Markdown (including its sources).
- **Answer controls**: temperature, max tokens, history limit and reasoning
  effort per user — anything you leave alone stays at the tier default.
- **Chat history**: search, pin and delete, with a clean conversation list, plus
  a per-session token counter.
- **Streaming**: responses render in real time, with a live status while Max is
  searching the web.
- **Keyboard shortcuts**: ⌘K new chat, ⌘B sidebar, ⌘, settings, ⌘E export,
  ⌘/ shortcut help, Esc stop.
- **Auth**: JWT-based login & registration with rotating refresh tokens.
- **Onboarding**: guided first-run setup, including personality and web search.
- **Admin area**: a single admin account can configure the AI provider (base
  URL, model and API key per tier) at runtime, with connection tests. Keys are
  stored **encrypted**.

## Quick start

On a fresh Ubuntu/Debian machine, one command is enough — it installs Docker if
needed, clones the repo into `~/maxAI`, generates all secrets, asks a handful of
questions and then builds, starts and health-checks the stack:

```bash
curl -fsSL https://raw.githubusercontent.com/Malti2/maxAI/master/install.sh | bash
```

Prefer to see what you run? Clone first, then install:

```bash
git clone https://github.com/Malti2/maxAI.git
cd maxAI
bash setup.sh
```

Open the printed URL and sign in with the admin account you chose. Tested on a
fresh Ubuntu server; works on any Docker host.

> [!TIP]
> You can leave the API key blank during setup and add it later in the browser
> under **Settings → Admin** — no redeploy needed.

### Unattended install

Every question can be answered up front, which makes cloud-init, Ansible and
re-installs straightforward:

```bash
bash setup.sh --yes \
  --port 8080 \
  --url https://chat.example.com \
  --admin-email me@example.com \
  --ai-base-url https://api.openai.com/v1 \
  --ai-api-key sk-… \
  --model-pro gpt-4o
```

Environment variables of the same name (`PORT`, `ADMIN_EMAIL`, `AI_API_KEY`, …)
work too, existing values in `.env` are kept as defaults, and `bash setup.sh
--help` lists everything. Re-running the installer never regenerates your
secrets. With `--no-start` it only writes `.env`.

### Managing maxAI

```bash
./maxai start      # start (build if needed) and wait until it answers
./maxai status     # container status + health check
./maxai logs       # follow logs (./maxai logs backend for one service)
./maxai update     # git pull, rebuild, restart
./maxai backup     # gzipped database dump
./maxai restore f  # restore such a dump
./maxai doctor     # check Docker, .env and the health endpoint
./maxai stop       # stop everything
```

### The AI provider

maxAI talks to any endpoint that implements the standard **Chat Completions
API**. For each tier you provide:

- an **API base URL** (e.g. `https://api.openai.com/v1`, a self-hosted gateway,
  or a local model server),
- a **model name** to request, and
- an **API key**.

Set a global default (used by every tier) or override any tier individually.
The admin area (**Settings → Admin**, restricted to `ADMIN_EMAIL`) lets you set
and test all of this at runtime; API keys are stored encrypted and never shown
again.

<details>
<summary>Manual configuration (optional)</summary>

```bash
cp .env.example .env
nano .env        # secrets, ADMIN_EMAIL/ADMIN_PASSWORD, (optional) API keys
docker compose up -d --build
```

**Important variables in `.env`:**

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Secure database password |
| `JWT_SECRET` | Random key (`openssl rand -hex 64`) |
| `ENCRYPTION_KEY` | Optional; encrypts admin-set keys (derived from `JWT_SECRET` if unset) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The single admin account, seeded on first boot |
| `PORT` | Public port maxAI is served on (default `80`) |
| `FRONTEND_URL` | Public URL / domain (used for CORS) |
| `AI_BASE_URL` / `AI_API_KEY` | Global provider base URL + key |
| `AI_MODEL_LITE/PRO/BEAST` | Model name requested per tier |
| `WEB_SEARCH_ENABLED` | `false` removes web search from the app |
| `WEB_SEARCH_READER_URL` | Reader used to turn a page into text (default `https://r.jina.ai/`) |
| `WEB_SEARCH_WIKI_LANGS` | Wikipedia languages used as a fallback (default `de,en`) |

</details>

### HTTPS

maxAI serves plain HTTP on a single port so it works out of the box. For a
public deployment, terminate TLS in front of it — for example with a reverse
proxy such as Caddy (automatic certificates) or nginx with a Let's Encrypt
certificate — and point it at maxAI's port. Keep `FRONTEND_URL` in `.env` in
sync with your public `https://` address.

## Architecture

```
├── frontend/        React + TypeScript + Tailwind CSS (Vite)
│   ├── src/
│   │   ├── components/  chat/ (Home, MessageBubble, ChatInput, Tapback),
│   │   │                layout/, ui/ (Spark, ErrorBoundary, …), admin/
│   │   ├── hooks/       useChat.ts (shared SSE send/regenerate/edit)
│   │   ├── lib/         api.ts, models.ts, personalities.ts, reactions.ts,
│   │   │                sounds.ts, greeting.ts (time-of-day greeting),
│   │   │                speech.ts (dictation), exportChat.ts (Markdown export)
│   │   └── store/       auth, chat, theme, toast (Zustand)
│   └── nginx.conf   serves the SPA and reverse-proxies /api to the backend
├── backend/         Node.js + Express + TypeScript
│   ├── src/
│   │   ├── lib/       prisma.ts, env.ts, crypto.ts, serialize.ts, bootstrap.ts, asyncHandler.ts
│   │   ├── middleware/ auth.ts, admin.ts, error.ts
│   │   ├── routes/    auth.ts, chat.ts, settings.ts, admin.ts
│   │   └── services/  ai.ts (provider client), config.ts (runtime provider config),
│   │                  personalities.ts, chatMode.ts, chatStream.ts, reactions.ts,
│   │                  websearch.ts (keyless search), generation.ts (answer settings)
│   └── prisma/        schema.prisma + migrations/
├── setup.sh             interactive / unattended installer
├── install.sh           one-line remote bootstrap (installs Docker, clones, installs)
├── maxai                control script (start, logs, update, backup, doctor, …)
└── docker-compose.yml   postgres + backend + web (single public port)
```

## Database migrations

The schema lives in `backend/prisma/schema.prisma` and the migration history in
`backend/prisma/migrations/`. On container start, `entrypoint.sh` runs
`prisma migrate deploy`, which applies any pending migrations non-destructively.

To create a new migration during development:

```bash
cd backend
npx prisma migrate dev --name your_change
```

## Models

| Model | Colour | Use |
|--------|-------|-----------|
| Max Lite ◈ | Light blue | Short, simple requests |
| Max Pro ◆ | Indigo | Complex tasks |
| Max Beast ⬡ | Orange | Maximum performance |
| Max Auto ✦ | Green | Automatic selection |

Each tier maps to a model name on your configured provider; Auto routes each
request to a tier based on its complexity.

## Development

```bash
# Backend
cd backend && npm install
npm run dev

# Frontend (new terminal)
cd frontend && npm install
npm run dev
```

The frontend dev server proxies `/api` to `http://localhost:3001`.

## Useful commands

`./maxai` wraps the commands below; use them directly if you prefer:

```bash
docker compose logs -f backend    # Backend logs
docker compose logs -f web        # Web / proxy logs
docker compose restart backend    # Restart backend
docker compose down               # Stop everything
docker compose up -d --build      # Start with rebuild
```

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| `./maxai` or `docker` says it can't reach the daemon | `sudo systemctl start docker`; to drop `sudo` permanently: `sudo usermod -aG docker $USER`, then log in again |
| Port already in use | Re-run `bash setup.sh --port 8080` (or edit `PORT` in `.env`) and `./maxai start` |
| "Max could not respond" | The provider is not configured or the key is wrong — check **Settings → Admin**, then use *Test* |
| Login works, chats don't load | `./maxai logs backend` — usually a database or migration error |
| Web search never finds anything | The server may not be allowed to reach the internet, or the search endpoints are rate-limiting it. Answers still work; see [Web search](docs/web-search.md) |
| Everything looks broken after an update | `./maxai update` again, then `./maxai doctor` |

Start with `./maxai doctor` — it checks Docker, `.env` and the health endpoint.

## Documentation

- [Personalities](docs/personalities.md) — how Max's tone is configured.
- [Chat Mode](docs/chat-mode.md) — tapbacks, replies and message queueing.
- [Web search](docs/web-search.md) — how keyless grounding and citations work.
