# maxAI 🚀

**maxAI** is the platform. **Max** is the name of the AI — your personal assistant with its own iMessage-inspired interface, powered by Azure OpenAI.

## Features

- **4 models**: Max Lite ◈, Max Pro ◆, Max Beast ⬡, Auto ✦
- **3 personalities**: Casual (relaxed & direct), Assistant (balanced), Professional (formal)
- **iMessage-style design**: real message bubbles with tails for both sides, tapback reactions, replies, typing indicator, delivered receipts, date separators, and optional send/receive sounds — in light & dark
- **Apple-like polish**: SF-first typography, translucent bars, iOS system colours, subtle spring animations
- **Chat Mode**: message-by-message chatting with queued messages, tapback reactions and replies
- **Regenerate & edit**: re-roll Max's last answer, or edit one of your messages and continue from there
- **Chat history**: search, pin, delete, with a Messages-style conversation list (avatar, preview, time)
- **Streaming**: responses render in real time with live Markdown + syntax highlighting
- **Keyboard shortcuts**: ⌘K new chat, ⌘B toggle sidebar, ⌘/ shortcut help
- **Login + registration**: JWT-based with rotating refresh tokens
- **Onboarding**: step-by-step setup on first login (incl. personality choice)
- **Settings**: profile, theme (light/dark/system), sound, personality, default model, system instruction
- **Auto mode**: automatically picks the right model based on complexity

## What's new in 2.0

- **Redesigned UI** modelled on iMessage: bubbles with tails, tapbacks pinned to corners, a typing bubble, "Delivered", grouped messages and time separators.
- **One-command install** — `bash setup.sh` installs Docker, generates all secrets, seeds an admin account and starts everything.
- **Admin area** (Settings → Admin, restricted to `ADMIN_EMAIL`) to set/change the Azure keys per model at runtime, with connection tests. Keys are stored encrypted.
- **Regenerate** (`POST /api/chat/conversations/:id/regenerate`) and **edit & resend** (`PUT /api/chat/conversations/:id/messages/:messageId`).
- **Message sounds** — synthesised on the fly (no audio assets), toggleable per user.
- **Production hardening** — a single shared Prisma client, validated environment, a global error handler, request logging, graceful shutdown, SSE abort-on-disconnect, stricter input validation, and DB indexes.
- **Bug fixes** — streaming now targets the correct message in Chat Mode, conversation titles are only set once, and freshly-registered users get their full profile.

## Personalities

Max can respond in three personalities. The choice sets identity, tone and formatting; an optional custom system instruction is layered on top.

| Personality | Style | Description |
|----------------|------|--------------|
| **Casual** | relaxed & direct | Like a text from a clever friend — lowercase, short, no fluff, no emojis |
| **Assistant** | balanced (default) | Friendly and clear with clean Markdown formatting |
| **Professional** | formal & precise | Objective, structured and business-ready |

The personality is stored per user (`User.personality`, default: `assistant`) and applied server-side as a system prompt (`backend/src/services/personalities.ts`).

## Chat Mode

When enabled in Settings, Chat Mode turns maxAI into a live, message-by-message chat:

- **Queued messages**: send more messages while Max is still responding — they are delivered together and Max replies to all of them at once.
- **Tapbacks**: react to any message with a tapback (❤️ 👍 👎 😂 ‼️ ❓). You can react to Max's messages, and Max can react to yours. When a tapback is added, the model is told which message was reacted to and with what.
- **Replies**: reply to a specific earlier message, like in a real chat app. The quoted message is shown above yours and the model is given the reply context.

Tapbacks and replies are only available while Chat Mode is enabled.

## Quick start (VPS)

The installer does everything for you — it installs Docker if needed, generates
all secrets, asks for an admin account and (optionally) your Azure keys, then
builds and starts the stack.

```bash
git clone https://github.com/Malti2/maxAI.git
cd maxAI
bash setup.sh
```

That's it. Open the printed URL and sign in with the admin account you chose.

> [!TIP]
> You can leave the Azure keys blank during setup and add them later in the
> browser under **Settings → Admin** — no redeploy needed.

### Admin area

Only the account whose email matches `ADMIN_EMAIL` can open the admin area
(**Settings → Admin**). There you can set and change the Azure endpoint, API key
and deployment name per model, and test connectivity. API keys are stored
**encrypted** in the database and are never shown again. The admin account is
created automatically on first boot from `ADMIN_EMAIL` + `ADMIN_PASSWORD`, so
nobody else can claim that email.

<details>
<summary>Manual configuration (optional)</summary>

```bash
cp .env.example .env
nano .env        # secrets, ADMIN_EMAIL/ADMIN_PASSWORD, (optional) Azure keys
docker compose up -d --build
```

**Important variables in `.env`:**

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Secure database password |
| `JWT_SECRET` | Random key (`openssl rand -hex 64`) |
| `ENCRYPTION_KEY` | Optional; encrypts admin-set keys (derived from `JWT_SECRET` if unset) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The single admin account, seeded on first boot |
| `AZURE_ENDPOINT` / `AZURE_API_KEY` | Azure OpenAI endpoint + key (or set them in the admin area) |
| `AZURE_DEPLOYMENT_LITE/PRO/BEAST` | Deployment names per model |

</details>

## Architecture

```
├── frontend/        React + TypeScript + Tailwind CSS (Vite)
│   └── src/
│       ├── components/  chat/, layout/, ui/, admin/ (AdminPanel)
│       ├── hooks/       useChat.ts (shared SSE send/regenerate/edit)
│       ├── lib/         api.ts, models.ts, personalities.ts, reactions.ts, sounds.ts
│       └── store/       auth, chat, theme, toast (Zustand)
├── backend/         Node.js + Express + TypeScript
│   ├── src/
│   │   ├── lib/       prisma.ts, env.ts, crypto.ts, serialize.ts, bootstrap.ts, asyncHandler.ts
│   │   ├── middleware/ auth.ts, admin.ts, error.ts
│   │   ├── routes/    auth.ts, chat.ts, settings.ts, admin.ts
│   │   └── services/  azure.ts, config.ts (runtime Azure config), personalities.ts,
│   │                  chatMode.ts, chatStream.ts, reactions.ts
│   └── prisma/        schema.prisma + migrations/
├── nginx/           reverse proxy configuration
└── docker-compose.yml
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

| Model | Color | Use |
|--------|-------|-----------|
| Max Lite ◈ | Cyan | Short, simple requests |
| Max Pro ◆ | Indigo | Complex tasks |
| Max Beast ⬡ | Orange | Maximum performance |
| Max Auto ✦ | Green | Automatic selection |

## Development

```bash
# Backend
cd backend && npm install
npm run dev

# Frontend (new terminal)
cd frontend && npm install
npm run dev
```

## Useful commands

```bash
docker compose logs -f backend    # Backend logs
docker compose logs -f frontend   # Frontend logs
docker compose restart backend    # Restart backend
docker compose down               # Stop everything
docker compose up -d --build      # Start with rebuild
```
