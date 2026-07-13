import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { streamChat, selectAutoModel, ModelId } from '../services/azure';
import { buildSystemPrompt } from '../services/personalities';
import {
  AssistantStreamFilter, chatModeInstructions,
  buildModelHistory, foldReplyContext, type StoredMessage,
} from '../services/chatMode';
import { REACTION_TYPES } from '../services/reactions';

const router = Router();
const prisma = new PrismaClient();

// List conversations
router.get('/conversations', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const conversations = await prisma.conversation.findMany({
    where: { userId: req.userId },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  res.json(conversations);
});

// Get single conversation with messages
router.get('/conversations/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!conv) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(conv);
});

// Create conversation
router.post('/conversations', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { model } = req.body;
  const conv = await prisma.conversation.create({
    data: {
      userId: req.userId!,
      model: model || 'auto',
    },
  });
  res.status(201).json(conv);
});

// Update conversation (title, pin, model)
router.patch('/conversations/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, pinned, model } = req.body;
  const conv = await prisma.conversation.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: { title, pinned, model },
  });
  if (conv.count === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const updated = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  res.json(updated);
});

// Delete conversation
router.delete('/conversations/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.conversation.deleteMany({
    where: { id: req.params.id, userId: req.userId },
  });
  res.json({ ok: true });
});

// Delete all conversations
router.delete('/conversations', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.conversation.deleteMany({ where: { userId: req.userId } });
  res.json({ ok: true });
});

// Toggle pin
router.post('/conversations/:id/pin', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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
});

// Add / change / remove a tapback reaction on a message (Chat Mode only).
const ReactionSchema = z.object({
  reaction: z.enum(REACTION_TYPES as [string, ...string[]]).nullable(),
});

router.put(
  '/conversations/:id/messages/:messageId/reaction',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { reaction } = ReactionSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user?.chatMode) {
        res.status(403).json({ error: 'Chat Mode is disabled' });
        return;
      }

      // Ensure the message belongs to a conversation owned by this user.
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
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.errors[0].message });
        return;
      }
      res.status(500).json({ error: 'Internal error' });
    }
  }
);

// Send message + stream response
const SendMessageSchema = z.object({
  content: z.string().min(1),
  model: z.enum(['lite', 'pro', 'beast', 'auto']).optional(),
  // Chat Mode: additional messages that arrived while Max was responding.
  pendingMessages: z.array(z.string()).optional(),
  // Chat Mode: id of the message this one is replying to.
  replyToId: z.string().optional().nullable(),
});

router.post('/conversations/:id/messages', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content, model, pendingMessages, replyToId } = SendMessageSchema.parse(req.body);

    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
    });
    if (!conv) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const chatMode = user?.chatMode ?? false;
    const selectedModel = (model || conv.model || 'auto') as ModelId;

    const storedMsgs = conv.messages as StoredMessage[];

    // Reply targeting is a Chat Mode feature; ignore it otherwise. The target
    // must be an existing message in this conversation.
    const existingIds = new Set(storedMsgs.map(m => m.id));
    const validReplyToId = chatMode && replyToId && existingIds.has(replyToId) ? replyToId : null;

    // Save primary user message.
    const userMsg = await prisma.message.create({
      data: { conversationId: conv.id, role: 'user', content, replyToId: validReplyToId },
    });

    // Save any pending (queued) messages from Chat Mode.
    const savedPendingMsgs = [];
    if (chatMode && pendingMessages && pendingMessages.length > 0) {
      for (const pm of pendingMessages) {
        const msg = await prisma.message.create({
          data: { conversationId: conv.id, role: 'user', content: pm },
        });
        savedPendingMsgs.push(msg);
      }
    }

    // Build the message history for the API, with tapback/reply context.
    const history = buildModelHistory(storedMsgs);

    // Add the primary message (folding in reply context if present).
    if (validReplyToId) {
      const target = storedMsgs.find(m => m.id === validReplyToId)!;
      history.push({ role: 'user', content: foldReplyContext(target, content) });
    } else {
      history.push({ role: 'user', content });
    }

    // If Chat Mode pending messages exist, add a context note + all of them.
    if (savedPendingMsgs.length > 0) {
      history.push({
        role: 'system',
        content: `[Chat Mode] The user sent ${savedPendingMsgs.length} additional message${savedPendingMsgs.length > 1 ? 's' : ''} while you were responding. They arrived in order and should be treated as a natural continuation of the conversation — reply to all of them together as you would in a real chat.`,
      });
      for (const pm of savedPendingMsgs) {
        history.push({ role: 'user', content: pm.content });
      }
    }

    // The last user message is the target for any AI tapback / reply.
    const lastUserMsg = savedPendingMsgs.length > 0
      ? savedPendingMsgs[savedPendingMsgs.length - 1]
      : userMsg;

    // Compose the system prompt: personality + user's custom instruction,
    // plus Chat Mode directives when enabled.
    let systemPrompt = buildSystemPrompt(user?.personality, user?.systemPrompt);
    if (chatMode) {
      systemPrompt = `${systemPrompt}\n\n${chatModeInstructions()}`;
    }

    // Auto-select model if needed.
    let resolvedModel = selectedModel;
    if (selectedModel === 'auto') {
      resolvedModel = selectAutoModel(history);
    }

    // Set up SSE streaming.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send the persisted user message ids first.
    res.write(`data: ${JSON.stringify({ type: 'user_message', message: userMsg })}\n\n`);
    if (savedPendingMsgs.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'pending_messages', messages: savedPendingMsgs })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'model', model: resolvedModel })}\n\n`);

    // Filter strips any Chat Mode control block (tapback / reply directive)
    // from the visible stream so it never reaches the user.
    const filter = new AssistantStreamFilter();
    let visibleContent = '';

    const result = await streamChat(
      selectedModel,
      history,
      systemPrompt,
      (chunk) => {
        const visible = chatMode ? filter.push(chunk) : chunk;
        if (visible) {
          visibleContent += visible;
          res.write(`data: ${JSON.stringify({ type: 'delta', content: visible })}\n\n`);
        }
      }
    );

    // Flush any buffered remainder and read the parsed control directives.
    if (chatMode) {
      const tail = filter.end();
      if (tail) {
        visibleContent += tail;
        res.write(`data: ${JSON.stringify({ type: 'delta', content: tail })}\n\n`);
      }
    } else {
      visibleContent = result.content;
    }

    const control = filter.getControl();

    // Apply an AI-authored tapback to the last user message.
    let aiReaction: { messageId: string; reaction: string } | null = null;
    if (chatMode && control.reaction) {
      await prisma.message.update({
        where: { id: lastUserMsg.id },
        data: { reaction: control.reaction },
      });
      aiReaction = { messageId: lastUserMsg.id, reaction: control.reaction };
      res.write(`data: ${JSON.stringify({ type: 'reaction', ...aiReaction })}\n\n`);
    }

    // Persist the assistant message — unless it is a bare tapback (a reaction
    // with no text), in which case the reaction itself is the reply.
    let assistantMsg = null;
    const trimmed = visibleContent.trim();
    if (trimmed.length > 0) {
      assistantMsg = await prisma.message.create({
        data: {
          conversationId: conv.id,
          role: 'assistant',
          content: visibleContent,
          model: result.model,
          tokens: result.tokens,
          replyToId: chatMode && control.isReply ? lastUserMsg.id : null,
        },
      });
    }

    // Auto-generate the title from the first message.
    if (conv.messages.length === 0) {
      const title = content.slice(0, 60) + (content.length > 60 ? '…' : '');
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { title, updatedAt: new Date() },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { updatedAt: new Date() },
      });
    }

    res.write(`data: ${JSON.stringify({ type: 'done', message: assistantMsg })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to send message' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'API error' })}\n\n`);
      res.end();
    }
  }
});

export default router;
