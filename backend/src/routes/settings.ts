import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { PERSONALITY_IDS } from '../services/personalities';

const router = Router();
const prisma = new PrismaClient();

const UpdateSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  defaultModel: z.enum(['lite', 'pro', 'beast', 'auto']).optional(),
  personality: z.enum(PERSONALITY_IDS as [string, ...string[]]).optional(),
  systemPrompt: z.string().max(2000).optional().nullable(),
  avatarColor: z.string().optional(),
  onboardingDone: z.boolean().optional(),
});

router.put('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = UpdateSettingsSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
    });
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      onboardingDone: user.onboardingDone,
      defaultModel: user.defaultModel,
      personality: user.personality,
      avatarColor: user.avatarColor,
      systemPrompt: user.systemPrompt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Interner Fehler' });
  }
});

export default router;
