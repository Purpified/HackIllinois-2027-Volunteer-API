import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';

const app = createApp({ logging: false });

describe('GET /health', () => {
  it('reports ok when the database is connected', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ data: { status: 'ok', db: 'connected' } });
  });
});

describe('error envelope', () => {
  it('answers unknown routes with 404 ROUTE_NOT_FOUND', async () => {
    const res = await request(app).get('/definitely-not-a-route').expect(404);
    expect(res.body).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'No route for GET /definitely-not-a-route' },
    });
  });

  it('answers invalid JSON with 400 MALFORMED_JSON', async () => {
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"this is": not json')
      .expect(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });

  it('answers a JSON primitive body with 400 MALFORMED_JSON', async () => {
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('5')
      .expect(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });
});
