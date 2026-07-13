import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { toPublicUser } from '../lib/serialize';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  name: z.string().min(2).max(80).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions);
  const refreshToken = uuidv4();
  return { accessToken, refreshToken };
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const data = RegisterSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { email: data.email, password: hashed, name: data.name },
    });

    const { accessToken, refreshToken } = generateTokens(user.id);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() },
    });

    res.status(201).json({ accessToken, refreshToken, user: toPublicUser(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const data = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() },
    });

    // Opportunistically clean up this user's expired refresh tokens so the
    // table doesn't grow without bound.
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    res.json({ accessToken, refreshToken, user: toPublicUser(user) });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken || typeof refreshToken !== 'string') {
      res.status(400).json({ error: 'Refresh token missing' });
      return;
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
      res.status(401).json({ error: 'Token expired' });
      return;
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(stored.userId);

    // Rotate the refresh token atomically: remove the old one, issue a new one.
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: stored.id } }),
      prisma.refreshToken.create({
        data: { token: newRefreshToken, userId: stored.userId, expiresAt: refreshExpiry() },
      }),
    ]);

    res.json({ accessToken, refreshToken: newRefreshToken });
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(toPublicUser(user));
  })
);

export default router;
