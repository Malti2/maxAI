import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { toPublicUser } from '../lib/serialize';
import { PERSONALITY_IDS } from '../services/personalities';

const router = Router();

const UpdateSettingsSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    defaultModel: z.enum(['lite', 'pro', 'beast', 'auto']).optional(),
    personality: z.enum(PERSONALITY_IDS as [string, ...string[]]).optional(),
    chatMode: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
    systemPrompt: z.string().max(2000).optional().nullable(),
    avatarColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'avatarColor must be a hex colour')
      .optional(),
    onboardingDone: z.boolean().optional(),
  })
  .strict();

router.put(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = UpdateSettingsSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.userId }, data });
    res.json(toPublicUser(user));
  })
);

export default router;
