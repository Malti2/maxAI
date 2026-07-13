import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { loadEnv } from './lib/env';
import { prisma } from './lib/prisma';
import { ensureAdminUser } from './lib/bootstrap';
import { requestLogger, notFound, errorHandler } from './middleware/error';
import authRouter from './routes/auth';
import chatRouter from './routes/chat';
import settingsRouter from './routes/settings';
import adminRouter from './routes/admin';

// Fail fast with a clear message if the environment is misconfigured.
const env = loadEnv();

const app = express();

// Behind nginx: trust the proxy so req.ip / secure cookies work correctly.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// Baseline security headers (nginx adds more in production, but this keeps the
// backend safe when run directly).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', version: '2.0.0', uptime: process.uptime() })
);

app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin', adminRouter);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`🚀 maxAI backend running on port ${env.PORT} (${env.NODE_ENV})`);
});

// Seed the admin account once the server is up (non-blocking).
void ensureAdminUser();

// Graceful shutdown: stop accepting connections, then close the DB pool.
async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully…`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
