import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { isAdminEmail } from '../lib/env';
import { AuthRequest } from './auth';

// Gate for the admin area. Must run after `authenticate`. Admin status is
// derived solely from ADMIN_EMAIL, so it cannot be granted via the database.
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !isAdminEmail(user.email)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: 'Internal error' });
  }
}
