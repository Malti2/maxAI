import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { streamChat, selectAutoModel, ModelId } from '../services/azure';
import { buildSystemPrompt } from '../services/personalities';

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
    res.status(404).json({ error: 'Nicht gefunden' });
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
    res.status(404).json({ error: 'Nicht gefunden' });
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
    res.status(404).json({ error: 'Nicht gefunden' });
    return;
  }
  const updated = await prisma.conversation.update({
    where: { id: req.params.id },
    data: { pinned: !conv.pinned },
  });
  res.json(updated);
});

// Send message + stream response
const SendMessageSchema = z.object({
  content: z.string().min(1),
  model: z.enum(['lite', 'pro', 'beast', 'auto']).optional(),
});

router.post('/conversations/:id/messages', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content, model } = SendMessageSchema.parse(req.body);

    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
    });
    if (!conv) {
      res.status(404).json({ error: 'Nicht gefunden' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const selectedModel = (model || conv.model || 'auto') as ModelId;

    // Save user message
    const userMsg = await prisma.message.create({
      data: { conversationId: conv.id, role: 'user', content },
    });

    // Build message history for API
    const history = conv.messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));
    history.push({ role: 'user', content });

    // Auto-select model if needed
    let resolvedModel = selectedModel;
    if (selectedModel === 'auto') {
      resolvedModel = selectAutoModel(history);
    }

    // Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send user message id first
    res.write(`data: ${JSON.stringify({ type: 'user_message', message: userMsg })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'model', model: resolvedModel })}\n\n`);

    let fullContent = '';

    const systemPrompt = buildSystemPrompt(user?.personality, user?.systemPrompt);

    const result = await streamChat(
      selectedModel,
      history,
      systemPrompt,
      (chunk) => {
        fullContent += chunk;
        res.write(`data: ${JSON.stringify({ type: 'delta', content: chunk })}\n\n`);
      }
    );

    // Save assistant message
    const assistantMsg = await prisma.message.create({
      data: {
        conversationId: conv.id,
        role: 'assistant',
        content: result.content,
        model: result.model,
        tokens: result.tokens,
      },
    });

    // Auto-generate title from first message
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
      res.status(500).json({ error: 'Fehler beim Senden der Nachricht' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'API-Fehler' })}\n\n`);
      res.end();
    }
  }
});

export default router;
