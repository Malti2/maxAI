import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { toPublicUser } from '../lib/serialize';
import { PERSONALITY_IDS } from '../services/personalities';
import { LIMITS, REASONING_EFFORTS } from '../services/generation';
import { isWebSearchEnabled } from '../services/websearch';

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

    // Web search
    webSearch: z.boolean().optional(),
    webSearchSources: z.number().int().min(1).max(8).optional(),
    webSearchReadPages: z.boolean().optional(),

    // Generation (null = fall back to the tier default)
    temperature: z.number().min(LIMITS.temperature.min).max(LIMITS.temperature.max).nullable().optional(),
    maxTokens: z.number().int().min(LIMITS.maxTokens.min).max(LIMITS.maxTokens.max).nullable().optional(),
    historyLimit: z.number().int().min(LIMITS.historyLimit.min).max(LIMITS.historyLimit.max).optional(),
    reasoningEffort: z.enum(REASONING_EFFORTS as unknown as [string, ...string[]]).nullable().optional(),
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

// What this deployment supports. The frontend hides features the operator has
// switched off instead of offering a toggle that silently does nothing.
router.get(
  '/capabilities',
  authenticate,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ webSearch: isWebSearchEnabled() });
  })
);

export default router;
