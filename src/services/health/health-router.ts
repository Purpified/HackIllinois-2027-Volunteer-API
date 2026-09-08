import { Router } from 'express';
import { isDbConnected } from '../../common/db.ts';
import type { ErrorBody } from '../../common/error-handler.ts';

export const healthRouter = Router();

// 503 when MongoDB is not connected, so "up" and "usable" are distinguishable.
healthRouter.get('/', (_req, res) => {
  if (isDbConnected()) {
    res.status(200).json({ data: { status: 'ok', db: 'connected' } });
    return;
  }
  const body: ErrorBody = {
    error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is not connected' },
  };
  res.status(503).json(body);
});
