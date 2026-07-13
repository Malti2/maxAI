import { Request, Response, NextFunction, RequestHandler } from 'express';

// Wraps an async route handler so any thrown/rejected error is forwarded to
// Express' error-handling middleware instead of crashing the process with an
// unhandled rejection. This lets handlers `throw` freely and keeps a single
// place (the global error handler) responsible for the response.
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next);
  };
}
