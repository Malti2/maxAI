# maxAI 🚀

**maxAI** is the platform. **Max** is the AI — your own self-hosted assistant
with a polished chat interface, multiple model tiers and switchable
personalities. It runs anywhere Docker runs and connects to any AI endpoint
that speaks the standard Chat Completions API.

## Features

- **4 model tiers**: Max Lite ◈, Max Pro ◆, Max Beast ⬡ and Auto ✦ (which picks
  the right tier automatically based on the request).
- **3 personalities**: Casual (relaxed & direct), Assistant (balanced) and
  Professional (formal), each layered on top of an optional custom instruction.
- **Polished chat UI**: message bubbles with tails on both sides, tapback
  reactions, replies, a typing indicator, delivered receipts, date separators
  and optional synthesised send/receive sounds — in light & dark.
- **Chat Mode**: message-by-message chatting with queued messages, tapback
  reactions and replies.
- **Regenerate & edit**: re-roll Max's last answer, or edit one of your messages
  and continue from there.
- **Chat history**: search, pin and delete, with a clean conversation list.
- **Streaming**: responses render in real time with live Markdown + syntax
  highlighting.
- **Keyboard shortcuts**: ⌘K new chat, ⌘B toggle sidebar, ⌘/ shortcut help.
- **Auth**: JWT-based login & registration with rotating refresh tokens.
- **Onboarding**: guided first-run setup, including the personality choice.
- **Settings**: profile, theme (light/dark/system), sound, personality, default
  model and a custom system instruction.
- **Admin area**: a single admin account can configure the AI provider (base
  URL, model and API key per tier) at runtime, with connection tests. Keys are
  stored **encrypted**.

## Quick start

The installer does everything: it installs Docker if needed, generates all
secrets, asks for an admin account and (optionally) your AI provider details,
then builds and starts the stack.

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
│   │   ├── components/  chat/, layout/, ui/, admin/ (AdminPanel)
│   │   ├── hooks/       useChat.ts (shared SSE send/regenerate/edit)
│   │   ├── lib/         api.ts, models.ts, personalities.ts, reactions.ts, sounds.ts
│   │   └── store/       auth, chat, theme, toast (Zustand)
│   └── nginx.conf   serves the SPA and reverse-proxies /api to the backend
├── backend/         Node.js + Express + TypeScript
│   ├── src/
│   │   ├── lib/       prisma.ts, env.ts, crypto.ts, serialize.ts, bootstrap.ts, asyncHandler.ts
│   │   ├── middleware/ auth.ts, admin.ts, error.ts
│   │   ├── routes/    auth.ts, chat.ts, settings.ts, admin.ts
│   │   └── services/  ai.ts (provider client), config.ts (runtime provider config),
│   │                  personalities.ts, chatMode.ts, chatStream.ts, reactions.ts
│   └── prisma/        schema.prisma + migrations/
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

```bash
docker compose logs -f backend    # Backend logs
docker compose logs -f web        # Web / proxy logs
docker compose restart backend    # Restart backend
docker compose down               # Stop everything
docker compose up -d --build      # Start with rebuild
```

## Documentation

- [Personalities](docs/personalities.md) — how Max's tone is configured.
- [Chat Mode](docs/chat-mode.md) — tapbacks, replies and message queueing.
