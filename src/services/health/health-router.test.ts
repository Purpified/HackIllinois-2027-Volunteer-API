import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.ts';

const app = createApp({ logging: false });

describe('GET /health when the database is down', () => {
  it('answers 503 SERVICE_UNAVAILABLE in the error envelope', async () => {
    const state = vi
      .spyOn(mongoose.connection, 'readyState', 'get')
      .mockReturnValue(mongoose.ConnectionStates.disconnected);
    try {
      const res = await request(app).get('/health').expect(503);
      expect(res.body).toEqual({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is not connected' },
      });
    } finally {
      state.mockRestore();
    }
  });
});
