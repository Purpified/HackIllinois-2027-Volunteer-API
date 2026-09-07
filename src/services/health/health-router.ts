import { Router } from 'express';
import { isDbConnected } from '../../common/db.ts';
import type { ErrorBody } from '../../common/error-handler.ts';

export const healthRouter = Router();

// GET /health: the demo opener and the CI smoke test. 503 when MongoDB is not connected so a
// load balancer (or a nervous interviewer) can tell "up" from "up but useless".
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
