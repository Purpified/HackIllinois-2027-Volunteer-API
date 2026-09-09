import express, { type Express } from 'express';
import morgan from 'morgan';
import { errorHandler } from './common/error-handler.ts';
import { notFound } from './common/not-found.ts';
import { eventRouter } from './services/event/event-router.ts';
import { healthRouter } from './services/health/health-router.ts';
import { shiftRouter } from './services/shift/shift-router.ts';
import { signupRouter } from './services/signup/signup-router.ts';
import { volunteerRouter } from './services/volunteer/volunteer-router.ts';

export type AppOptions = { logging?: boolean };

// Builds the app without listening; server.ts listens, tests use supertest.
// Middleware order matters: a request walks this list top to bottom.
export function createApp(options: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');

  if (options.logging ?? true) {
    app.use(morgan('dev'));
  }

  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);
  app.use('/volunteers', volunteerRouter);
  app.use('/events', eventRouter);
  // These declare their own full paths: /events/:eventId/shifts, /shifts/:id,
  // /shifts/:shiftId/signups, /volunteers/:volunteerId/signups, /signups/:id.
  app.use(shiftRouter);
  app.use(signupRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
