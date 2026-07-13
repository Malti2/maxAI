import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { asyncHandler } from '../lib/asyncHandler';
import {
  getAdminAzureView,
  updateAzureConfig,
  RESOLVED_MODELS,
  type ResolvedModelId,
} from '../services/config';
import { testModel } from '../services/azure';

const router = Router();

// Everything under /api/admin requires the designated admin account.
router.use(authenticate, requireAdmin);

// ── Azure configuration ──────────────────────────────────────────

router.get(
  '/config',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json(await getAdminAzureView());
  })
);

const ModelPatch = z
  .object({
    endpoint: z.string().max(500).optional(),
    deployment: z.string().max(200).optional(),
    // A non-empty string sets the key; null clears it; omitting leaves it as-is.
    apiKey: z.string().max(500).nullable().optional(),
  })
  .strict();

const UpdateConfigSchema = z
  .object({
    apiVersion: z.string().max(50).optional(),
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
    await updateAzureConfig(update);
    res.json(await getAdminAzureView());
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
