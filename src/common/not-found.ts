import type { Request, Response } from 'express';
import type { ErrorBody } from './error-handler.ts';

export function notFound(req: Request, res: Response): void {
  const body: ErrorBody = {
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
}
