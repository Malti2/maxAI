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

### 1. Prerequisites

```bash
# Install Docker (if not already present)
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
```

### 2. Configuration

```bash
cp .env.example .env
nano .env  # enter Azure API keys and secrets
```

**Important variables in `.env`:**

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Secure database password |
| `JWT_SECRET` | Random key (`openssl rand -hex 64`) |
| `AZURE_ENDPOINT` | Azure OpenAI endpoint URL |
| `AZURE_API_KEY` | Azure API key |
| `AZURE_DEPLOYMENT_LITE` | Deployment name for Max Lite (e.g. `gpt-4o-mini`) |
| `AZURE_DEPLOYMENT_PRO` | Deployment name for Max Pro (e.g. `gpt-4o`) |
| `AZURE_DEPLOYMENT_BEAST` | Deployment name for Max Beast |

### 3. Start

```bash
bash setup.sh
# or manually:
docker compose up -d
```

## Architecture

```
├── frontend/        React + TypeScript + Tailwind CSS (Vite)
│   └── src/
│       ├── components/  chat/ (bubbles, input, tapbacks), layout/, ui/ (toaster, shortcuts…)
│       ├── hooks/       useChat.ts (shared SSE send/regenerate/edit)
│       ├── lib/         api.ts, models.ts, personalities.ts, reactions.ts, sounds.ts
│       └── store/       auth, chat, theme, toast (Zustand)
├── backend/         Node.js + Express + TypeScript
│   ├── src/
│   │   ├── lib/       prisma.ts (singleton), env.ts (validation), serialize.ts, asyncHandler.ts
│   │   ├── middleware/ auth.ts, error.ts (logger + 404 + error handler)
│   │   ├── routes/    auth.ts, chat.ts, settings.ts
│   │   └── services/  azure.ts (OpenAI streaming), personalities.ts, chatMode.ts,
│   │                  chatStream.ts (shared assistant turn), reactions.ts
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
