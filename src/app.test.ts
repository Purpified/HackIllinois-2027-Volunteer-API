import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';
import { VolunteerModel } from './services/volunteer/volunteer-model.ts';

const app = createApp({ logging: false });

describe('GET /health', () => {
  it('reports ok when the database is connected', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ data: { status: 'ok', db: 'connected' } });
  });
});

// Every failure must use the same envelope.
describe('error envelope', () => {
  it('answers unknown routes with 404 ROUTE_NOT_FOUND', async () => {
    const res = await request(app).get('/definitely-not-a-route').expect(404);
    expect(res.body).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'No route for GET /definitely-not-a-route' },
    });
  });

  it('answers invalid JSON with 400 MALFORMED_JSON', async () => {
    const res = await request(app)
      .post('/volunteers')
      .set('Content-Type', 'application/json')
      .send('{"this is": not json')
      .expect(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });

  it('answers a JSON primitive body with 400 MALFORMED_JSON', async () => {
    const res = await request(app)
      .post('/volunteers')
      .set('Content-Type', 'application/json')
      .send('5')
      .expect(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });

  it('answers a body over 100kb with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(app)
      .post('/volunteers')
      .send({ name: 'x'.repeat(120_000), email: 'big@illinois.edu' })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('answers a non-UTF-8 charset with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = await request(app)
      .post('/volunteers')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send('{"name":"Ada"}')
      .expect(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('answers a path with broken percent-encoding with 400 BAD_REQUEST, not 500', async () => {
    const res = await request(app).get('/volunteers/%E0%A4%A').expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('answers a missing or non-JSON body with a message that says so', async () => {
    const res = await request(app)
      .post('/volunteers')
      .set('Content-Type', 'text/plain')
      .send('{"name":"Ada","email":"ada@illinois.edu"}')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues[0]).toMatchObject({
      location: 'body',
      message: expect.stringContaining('application/json'),
    });
  });

  it('turns an unexpected exception into 500 INTERNAL without leaking the stack', async () => {
    vi.spyOn(VolunteerModel, 'findById').mockImplementation(() => {
      throw new Error('simulated database failure with a secret path /etc/app');
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await request(app).get('/volunteers/000000000000000000000000').expect(500);

    expect(res.body.error.code).toBe('INTERNAL');
    expect(res.body.error.message).toMatch(/Reference: [0-9a-f-]{36}$/);
    expect(JSON.stringify(res.body)).not.toContain('simulated');
    expect(JSON.stringify(res.body)).not.toContain('/etc/app');
    const reference = res.body.error.message.split('Reference: ')[1];
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(reference), expect.any(Error));
  });
});
