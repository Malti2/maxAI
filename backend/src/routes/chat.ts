import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { type ModelId } from '../services/ai';
import { buildSystemPrompt } from '../services/personalities';
import {
  chatModeInstructions,
  buildModelHistory,
  foldReplyContext,
  type StoredMessage,
  type ApiMessage,
} from '../services/chatMode';
import { streamAssistantTurn } from '../services/chatStream';
import { REACTION_TYPES } from '../services/reactions';

const router = Router();

const MODEL_ENUM = z.enum(['lite', 'pro', 'beast', 'auto']);
const MAX_MESSAGE_LEN = 32000;
const HISTORY_LIMIT = 50;

// ── Conversations ────────────────────────────────────────────────

// List conversations, each with a short preview of its most recent message.
router.get(
  '/conversations',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.userId },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, role: true },
        },
      },
    });

    type ConvRow = Record<string, unknown> & {
      messages: Array<{ content: string; role: string }>;
    };
    const shaped = (conversations as ConvRow[]).map((c) => {
      const last = c.messages[0];
      const preview = last ? last.content.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
      const { messages: _messages, ...rest } = c;
      return { ...rest, preview };
    });

    res.json(shaped);
  })
);

// Get single conversation with messages.
router.get(
  '/conversations/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(conv);
  })
);

// Create conversation.
router.post(
  '/conversations',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const model = MODEL_ENUM.catch('auto').parse(req.body?.model);
    const conv = await prisma.conversation.create({
      data: { userId: req.userId!, model },
    });
    res.status(201).json(conv);
  })
);

// Update conversation (title, pin, model).
const UpdateConvSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    pinned: z.boolean().optional(),
    model: MODEL_ENUM.optional(),
  })
  .strict();

router.patch(
  '/conversations/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = UpdateConvSchema.parse(req.body);
    const conv = await prisma.conversation.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data,
    });
    if (conv.count === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const updated = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  })
);

// Delete all conversations. (Declared before the :id route so "conversations"
// is never captured as an id.)
router.delete(
  '/conversations',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.conversation.deleteMany({ where: { userId: req.userId } });
    res.json({ ok: true });
  })
);

// Delete a single conversation.
router.delete(
  '/conversations/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await prisma.conversation.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  })
);

// Toggle pin.
router.post(
  '/conversations/:id/pin',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!conv) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { pinned: !conv.pinned },
    });
    res.json(updated);
  })
);

// ── Reactions (tapbacks) ─────────────────────────────────────────

const ReactionSchema = z.object({
  reaction: z.enum(REACTION_TYPES as [string, ...string[]]).nullable(),
});

router.put(
  '/conversations/:id/messages/:messageId/reaction',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { reaction } = ReactionSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.chatMode) {
      res.status(403).json({ error: 'Chat Mode is disabled' });
      return;
    }

    const message = await prisma.message.findFirst({
      where: {
        id: req.params.messageId,
        conversation: { id: req.params.id, userId: req.userId },
      },
    });
    if (!message) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { reaction },
    });
    res.json(updated);
  })
);

// ── SSE helpers ──────────────────────────────────────────────────

function openSSE(req: Request, res: Response): AbortController {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Abort the upstream model stream if the client disconnects.
  const controller = new AbortController();
  const onClose = () => controller.abort();
  req.on('close', onClose);
  res.on('finish', () => req.off('close', onClose));
  return controller;
}

function sse(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function touchConversation(id: string): Promise<void> {
  await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
}

// Run one assistant turn over the already-open SSE stream and always finish the
// response cleanly — emitting a `done` event on success or an `error` event if
// the model call fails after streaming has begun.
interface FinishTurnOptions {
  conversationId: string;
  history: ApiMessage[];
  systemPrompt: string;
  requestedModel: ModelId;
  chatMode: boolean;
  reactionTargetId: string | null;
  signal: AbortSignal;
  titleSeed?: string; // when set (first message), name the conversation from it
}

async function finishTurn(res: Response, opts: FinishTurnOptions): Promise<void> {
  try {
    const { assistantMessage, aborted } = await streamAssistantTurn({
      res,
      conversationId: opts.conversationId,
      history: opts.history,
      systemPrompt: opts.systemPrompt,
      requestedModel: opts.requestedModel,
      chatMode: opts.chatMode,
      reactionTargetId: opts.reactionTargetId,
      signal: opts.signal,
    });

    if (opts.titleSeed !== undefined) {
      const title = opts.titleSeed.slice(0, 60) + (opts.titleSeed.length > 60 ? '…' : '');
      await prisma.conversation.update({
        where: { id: opts.conversationId },
        data: { title, updatedAt: new Date() },
      });
    } else {
      await touchConversation(opts.conversationId);
    }

    sse(res, { type: 'done', message: assistantMessage, aborted });
  } catch (err) {
    console.error('Assistant turn failed:', err);
    if (!res.writableEnded) sse(res, { type: 'error', error: 'Max could not respond. Please try again.' });
  } finally {
    if (!res.writableEnded) res.end();
  }
}

// ── Send message + stream response ───────────────────────────────

const SendMessageSchema = z.object({
  content: z.string().min(1).max(MAX_MESSAGE_LEN),
  model: MODEL_ENUM.optional(),
  pendingMessages: z.array(z.string().min(1).max(MAX_MESSAGE_LEN)).max(20).optional(),
  replyToId: z.string().optional().nullable(),
});

router.post(
  '/conversations/:id/messages',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { content, model, pendingMessages, replyToId } = SendMessageSchema.parse(req.body);

    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
      // Take the *most recent* HISTORY_LIMIT messages (desc), then restore
      // chronological order below. Ordering asc with `take` would keep the
      // oldest messages instead and drop recent context on long conversations.
      include: { messages: { orderBy: { createdAt: 'desc' }, take: HISTORY_LIMIT } },
    });
    if (!conv) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const chatMode = user?.chatMode ?? false;
    const requestedModel = (model || conv.model || 'auto') as ModelId;
    const storedMsgs = [...(conv.messages as StoredMessage[])].reverse();
    const isFirstMessage = storedMsgs.length === 0;

    // Reply targeting is a Chat Mode feature; the target must be an existing
    // message in this conversation.
    const existingIds = new Set(storedMsgs.map((m) => m.id));
    const validReplyToId = chatMode && replyToId && existingIds.has(replyToId) ? replyToId : null;

    // Persist the primary user message.
    const userMsg = await prisma.message.create({
      data: { conversationId: conv.id, role: 'user', content, replyToId: validReplyToId },
    });

    // Persist any Chat Mode queued messages.
    const savedPendingMsgs = [];
    if (chatMode && pendingMessages && pendingMessages.length > 0) {
      for (const pm of pendingMessages) {
        savedPendingMsgs.push(
          await prisma.message.create({
            data: { conversationId: conv.id, role: 'user', content: pm },
          })
        );
      }
    }

    // Build the model history with tapback/reply context.
    const history = buildModelHistory(storedMsgs);
    if (validReplyToId) {
      const target = storedMsgs.find((m) => m.id === validReplyToId)!;
      history.push({ role: 'user', content: foldReplyContext(target, content) });
    } else {
      history.push({ role: 'user', content });
    }

    if (savedPendingMsgs.length > 0) {
      history.push({
        role: 'system',
        content: `[Chat Mode] The user sent ${savedPendingMsgs.length} additional message${
          savedPendingMsgs.length > 1 ? 's' : ''
        } while you were responding. They arrived in order and should be treated as a natural continuation of the conversation — reply to all of them together as you would in a real chat.`,
      });
      for (const pm of savedPendingMsgs) {
        history.push({ role: 'user', content: pm.content });
      }
    }

    const lastUserMsg = savedPendingMsgs.length > 0 ? savedPendingMsgs[savedPendingMsgs.length - 1] : userMsg;

    let systemPrompt = buildSystemPrompt(user?.personality, user?.systemPrompt);
    if (chatMode) systemPrompt = `${systemPrompt}\n\n${chatModeInstructions()}`;

    const controller = openSSE(req, res);

    sse(res, { type: 'user_message', message: userMsg });
    if (savedPendingMsgs.length > 0) {
      sse(res, { type: 'pending_messages', messages: savedPendingMsgs });
    }

    await finishTurn(res, {
      conversationId: conv.id,
      history,
      systemPrompt,
      requestedModel,
      chatMode,
      reactionTargetId: lastUserMsg.id,
      signal: controller.signal,
      titleSeed: isFirstMessage ? content : undefined,
    });
  })
);

// ── Regenerate the assistant's reply to the latest user turn ──────

const RegenerateSchema = z
  .object({ model: MODEL_ENUM.optional() })
  .strict()
  .optional();

router.post(
  '/conversations/:id/regenerate',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = RegenerateSchema.parse(req.body) ?? {};

    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const msgs = conv.messages as StoredMessage[];
    const lastUserIdx = [...msgs].map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx === -1) {
      res.status(400).json({ error: 'Nothing to regenerate' });
      return;
    }

    // Drop every message after the last user message (the stale assistant reply)
    // so we can produce a fresh one from the same context.
    const toDelete = msgs.slice(lastUserIdx + 1).map((m) => m.id);
    if (toDelete.length > 0) {
      await prisma.message.deleteMany({ where: { id: { in: toDelete } } });
    }

    const kept = msgs.slice(0, lastUserIdx + 1);
    const history = buildModelHistory(kept.slice(-HISTORY_LIMIT));
    const lastUserMsg = kept[lastUserIdx];

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const chatMode = user?.chatMode ?? false;
    const requestedModel = (body.model || conv.model || 'auto') as ModelId;

    let systemPrompt = buildSystemPrompt(user?.personality, user?.systemPrompt);
    if (chatMode) systemPrompt = `${systemPrompt}\n\n${chatModeInstructions()}`;

    const controller = openSSE(req, res);

    await finishTurn(res, {
      conversationId: conv.id,
      history,
      systemPrompt,
      requestedModel,
      chatMode,
      reactionTargetId: lastUserMsg.id,
      signal: controller.signal,
    });
  })
);

// ── Edit a user message and re-stream from that point ────────────

const EditMessageSchema = z.object({
  content: z.string().min(1).max(MAX_MESSAGE_LEN),
  model: MODEL_ENUM.optional(),
});

router.put(
  '/conversations/:id/messages/:messageId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { content, model } = EditMessageSchema.parse(req.body);

    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const msgs = conv.messages as StoredMessage[];
    const idx = msgs.findIndex((m) => m.id === req.params.messageId);
    if (idx === -1 || msgs[idx].role !== 'user') {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Editing a message invalidates everything after it, so drop those messages
    // and re-generate — exactly like editing a prompt in a chat app.
    const toDelete = msgs.slice(idx + 1).map((m) => m.id);
    if (toDelete.length > 0) {
      await prisma.message.deleteMany({ where: { id: { in: toDelete } } });
    }

    const editedMsg = await prisma.message.update({
      where: { id: req.params.messageId },
      data: { content, edited: true },
    });

    const kept = [...msgs.slice(0, idx), editedMsg as unknown as StoredMessage];
    const history = buildModelHistory(kept.slice(-HISTORY_LIMIT));

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const chatMode = user?.chatMode ?? false;
    const requestedModel = (model || conv.model || 'auto') as ModelId;

    let systemPrompt = buildSystemPrompt(user?.personality, user?.systemPrompt);
    if (chatMode) systemPrompt = `${systemPrompt}\n\n${chatModeInstructions()}`;

    const controller = openSSE(req, res);
    sse(res, { type: 'user_message', message: editedMsg });

    await finishTurn(res, {
      conversationId: conv.id,
      history,
      systemPrompt,
      requestedModel,
      chatMode,
      reactionTargetId: editedMsg.id,
      signal: controller.signal,
    });
  })
);

export default router;
