# Chat Mode: tapbacks & replies

Chat Mode turns maxAI into a live, message-by-message chat. When it is enabled
(Settings → AI & Models):

- **Queued messages** — keep sending while Max is still answering; the messages
  are delivered together and Max replies to all of them at once.
- **Tapbacks** — react to any message with ❤️ 👍 👎 😂 ‼️ ❓. You can react to
  Max's messages, and Max can react to yours.
- **Replies** — reply to a specific earlier message; the quoted message is shown
  above yours and given to the model as context.

Tapbacks and replies are only available while Chat Mode is on.

## How Max expresses a tapback or reply

Max signals a reaction or reply with a small **control block** at the very start
of its response — each directive on its own line, then a blank line, then the
visible message:

```
<<react:love>>
<<reply>>

here's the launch email draft...
```

The backend reads those leading lines, records `reaction` and `isReply`, strips
them from the stream, and only the visible text ever reaches the screen. A
response can even be *just* a tapback with no text (a bare `<<react:love>>`).

Because tokens stream in **arbitrary chunks** (`<<re`, then `act:lo`, then
`ve>>\n`), the parser can't judge a line from a single chunk. `AssistantStreamFilter`
in `services/chatMode.ts` buffers until a line either *is* a complete directive
or *cannot* be one, then decides whether to hide or show it:

```ts
const visible = chatMode ? filter.push(chunk) : chunk;
if (visible) {
  visibleContent += visible;
  res.write(`data: ${JSON.stringify({ type: 'delta', content: visible })}\n\n`);
}
// after the stream ends:
const control = filter.getControl(); // { reaction, isReply }
```

## How the model learns about reactions/replies

For the other direction — you reacting or replying — there is nothing to parse.
The `reaction` string and `replyToId` are stored on the message, and when the
history is replayed to the model, `buildModelHistory()` translates them into
plain-language notes:

```
(assistant) "the deploy finished at 3pm"
(system)    "[Tapback] The user reacted with ❤️ (love) to your message above."
```

Replies are folded into the message text the model sees:
`[Reply to Max: "the deploy finished…"] thanks!`. No special model features are
required.

## Data model

`Message` carries a tapback and a self-referential reply link:

```prisma
model Message {
  // ...
  reaction   String?   // tapback reaction (e.g. "love") — Chat Mode only
  replyToId  String?
  replyTo    Message?  @relation("MessageReplies", fields: [replyToId], references: [id], onDelete: SetNull)
  replies    Message[] @relation("MessageReplies")
}
```

## Frontend pieces

- `lib/reactions.ts` mirrors the backend's six reactions.
- `components/chat/Tapback.tsx` — the picker popover, the corner **badge** on
  user bubbles and an inline chip on assistant messages.
- `MessageBubble.tsx` — shows a message's reaction, a quoted **reply preview**
  and hover actions (reply / react) that appear only in Chat Mode.
- `ChatInput.tsx` — a **reply banner** with Esc-to-cancel.
- `useChat.ts` — sends `replyToId`, applies AI-authored reactions from the
  `reaction` SSE event, and handles a bare-tapback response (a `done` event
  whose `message` is `null`).
- `ChatPage.tsx` — owns the reply target and does an **optimistic** reaction
  update that reverts if the request fails.

The user-authored tapback endpoint is ownership-checked and refuses to act when
Chat Mode is off:

```ts
router.put('/conversations/:id/messages/:messageId/reaction', /* ... */);
// 403 if !user.chatMode; 404 if the message isn't in a conversation you own
```
