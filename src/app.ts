import express, { type Express } from 'express';
import morgan from 'morgan';
import { errorHandler } from './common/error-handler.ts';
import { notFound } from './common/not-found.ts';
import { healthRouter } from './services/health/health-router.ts';
import { volunteerRouter } from './services/volunteer/volunteer-router.ts';

export type AppOptions = { logging?: boolean };

// Builds the Express app without listening on a port. server.ts listens; tests hand the app
// straight to supertest. Order matters: a request walks this list top to bottom.
export function createApp(options: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');

  if (options.logging ?? true) {
    app.use(morgan('dev'));
  }

  // Parse JSON bodies into req.body. Without this, req.body is undefined in Express 5.
  // Invalid JSON or a body over the limit throws, and the error handler answers 400 / 413.
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);
  app.use('/volunteers', volunteerRouter);

  // Nothing above matched.
  app.use(notFound);
  // Anything thrown, anywhere above, lands here. Must be registered last.
  app.use(errorHandler);

  return app;
}
