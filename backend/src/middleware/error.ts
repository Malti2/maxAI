import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Lightweight request logger: one structured line per completed request, with
// method, path, status and duration. Avoids pulling in a logging dependency.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Don't log health-check noise.
    if (req.path === '/health') return;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

// Central error handler. Turns known error types (Zod validation, JSON parse)
// into clean 4xx responses and everything else into a generic 500 — never
// leaking stack traces or internal messages to the client.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) {
    // The response (e.g. an SSE stream) already started; just end it.
    res.end();
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid request' });
    return;
  }

  // Body-parser JSON syntax error.
  if (err instanceof SyntaxError && 'body' in (err as never)) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal error' });
}
