import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { asyncHandler } from '../lib/asyncHandler';
import {
  getAdminProviderView,
  updateProviderConfig,
  RESOLVED_MODELS,
  type ResolvedModelId,
} from '../services/config';
import { testModel } from '../services/ai';

const router = Router();

// Everything under /api/admin requires the designated admin account.
router.use(authenticate, requireAdmin);

// ── AI provider configuration ────────────────────────────────────

router.get(
  '/config',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json(await getAdminProviderView());
  })
);

const ModelPatch = z
  .object({
    baseURL: z.string().max(500).optional(),
    model: z.string().max(200).optional(),
    // A non-empty string sets the key; null clears it; omitting leaves it as-is.
    apiKey: z.string().max(500).nullable().optional(),
  })
  .strict();

const UpdateConfigSchema = z
  .object({
    models: z
      .object({
        lite: ModelPatch.optional(),
        pro: ModelPatch.optional(),
        beast: ModelPatch.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

router.put(
  '/config',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const update = UpdateConfigSchema.parse(req.body);
    await updateProviderConfig(update);
    res.json(await getAdminProviderView());
  })
);

// Test connectivity for one model or all of them.
router.post(
  '/config/test',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const model = req.body?.model as string | undefined;
    const targets: ResolvedModelId[] =
      model && (RESOLVED_MODELS as string[]).includes(model)
        ? [model as ResolvedModelId]
        : RESOLVED_MODELS;

    const entries = await Promise.all(
      targets.map(async (m) => [m, await testModel(m)] as const)
    );
    res.json(Object.fromEntries(entries));
  })
);

// ── Basic stats for the admin dashboard ──────────────────────────
router.get(
  '/stats',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [users, conversations, messages] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count(),
      prisma.message.count(),
    ]);
    res.json({ users, conversations, messages });
  })
);

export default router;
