import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { env } from './env';

// Create the admin account on first boot if ADMIN_EMAIL + ADMIN_PASSWORD are
// configured and it doesn't exist yet. Seeding it here (rather than relying on
// open registration) guarantees the admin email is taken before anyone else can
// claim it, so the admin area can only ever belong to the operator.
export async function ensureAdminUser(): Promise<void> {
  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) return;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return;

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { email, password: hashed, name: 'Admin' },
    });
    console.log(`👑 Admin account created for ${email}`);
  } catch (err) {
    console.error('Could not ensure admin user:', err);
  }
}
