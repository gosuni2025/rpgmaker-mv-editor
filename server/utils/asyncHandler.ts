import { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
