# Personalities

Max can respond in one of three personalities. A personality sets Max's
identity, tone and formatting; an optional custom system instruction is layered
on top of it. The choice is stored per user (`User.personality`, default
`assistant`) and applied server-side.

| Personality | Style | Description |
|----------------|------|--------------|
| **Casual** | relaxed & direct | Like a text from a clever friend — lowercase, short, no fluff, no emojis |
| **Assistant** | balanced (default) | Friendly and clear with clean Markdown formatting |
| **Professional** | formal & precise | Objective, structured and business-ready |

## How it works

Two layers combine into the final system prompt:

1. **Base layer — the personality prompt.** Identity, tone and formatting rules.
   Every personality shares a common `CORE` block so identity and safety rules
   (no fabrication, prompt-injection resistance, reply in the user's language)
   stay constant regardless of tone.
2. **Top layer — the user's optional custom instruction.** It refines behaviour
   but can never override the core rules.

The combination lives in `backend/src/services/personalities.ts`:

```ts
export function buildSystemPrompt(personality?, userPrompt?): string {
  const base = getPersonalityPrompt(personality); // valid id or the default
  const custom = userPrompt?.trim();
  if (!custom) return base;
  return `${base}

# Additional instructions from the user
...
${custom}`;
}
```

**Example.** A user picks **Casual** and adds "always answer in English". Max
replies in English, but still lowercase, short and without emojis — the
language comes from the custom instruction, the style from the personality.

## Where it is wired

- `routes/chat.ts` calls `buildSystemPrompt(user.personality, user.systemPrompt)`
  for every turn.
- `routes/settings.ts` validates `personality` against `PERSONALITY_IDS`.
- `routes/auth.ts` includes `personality` in the public user shape.
- `schema.prisma` stores it: `personality String @default("assistant")`.
- The frontend defines the picker (name, tagline, description, icon, colour) in
  `frontend/src/lib/personalities.ts`, used in both onboarding and settings.

## Naming

**Max** is the name of the AI; **maxAI** is the platform. The model line
(Max Lite / Pro / Beast) keeps the Max name.
