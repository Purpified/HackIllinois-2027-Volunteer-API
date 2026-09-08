import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.ts';
import { UNKNOWN_ID, insertVolunteer } from '../../../tests/factories.ts';
import { VolunteerModel } from './volunteer-model.ts';

const app = createApp({ logging: false });

const ADA = { name: 'Ada Lovelace', email: 'ada@illinois.edu', phone: '217-555-0101' };

describe('POST /volunteers', () => {
  it('creates a volunteer and returns 201 with the public shape', async () => {
    const res = await request(app).post('/volunteers').send(ADA).expect(201);

    expect(res.body.data).toMatchObject({ name: ADA.name, email: ADA.email, phone: ADA.phone });
    expect(res.body.data.id).toMatch(/^[0-9a-f]{24}$/);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.createdAt).toMatch(/Z$/); // ISO string in UTC
    expect(res.body.data).not.toHaveProperty('_id');
    expect(res.body.data).not.toHaveProperty('__v');
    expect(res.headers.location).toBe(`/volunteers/${res.body.data.id}`);

    const stored = await VolunteerModel.findById(res.body.data.id);
    expect(stored?.email).toBe(ADA.email);
  });

  it('normalizes the email: trims whitespace and lowercases', async () => {
    const res = await request(app)
      .post('/volunteers')
      .send({ name: 'Ada', email: '  Ada@Illinois.EDU ' })
      .expect(201);
    expect(res.body.data.email).toBe('ada@illinois.edu');
  });

  it('rejects a missing name with 400 VALIDATION_ERROR naming the field', async () => {
    const res = await request(app).post('/volunteers').send({ email: ADA.email }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues).toEqual([
      expect.objectContaining({ location: 'body', path: 'name' }),
    ]);
  });

  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/volunteers')
      .send({ name: 'Ada', email: 'not-an-email' })
      .expect(400);
    expect(res.body.error.details.issues[0].path).toBe('email');
  });

  it('rejects unknown fields so clients cannot set server-owned values', async () => {
    const res = await request(app)
      .post('/volunteers')
      .send({ ...ADA, isActive: false })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await VolunteerModel.countDocuments()).toBe(0);
  });

  it('reports every problem at once instead of stopping at the first', async () => {
    const res = await request(app)
      .post('/volunteers')
      .send({ email: 'nope', phone: '1' })
      .expect(400);
    const paths = res.body.error.details.issues.map((i: { path: string }) => i.path).sort();
    expect(paths).toEqual(['email', 'name', 'phone']);
  });

  it('lets exactly one of several simultaneous signups with the same email through', async () => {
    // Only the unique index can enforce this; a pre-check would let concurrent requests through.
    const attempts = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/volunteers')
        .send({ name: `Racer ${i}`, email: 'racer@illinois.edu' }),
    );
    const responses = await Promise.all(attempts);
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(await VolunteerModel.countDocuments({ email: 'racer@illinois.edu' })).toBe(1);
  });

  it('rejects a duplicate email with 409 DUPLICATE_EMAIL, even with different casing', async () => {
    await request(app).post('/volunteers').send(ADA).expect(201);
    const res = await request(app)
      .post('/volunteers')
      .send({ name: 'Ada Again', email: 'ADA@illinois.edu' })
      .expect(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
    expect(await VolunteerModel.countDocuments()).toBe(1);
  });
});

describe('GET /volunteers', () => {
  it('returns an empty page, not a 404, when there are no volunteers', async () => {
    const res = await request(app).get('/volunteers').expect(200);
    expect(res.body).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('sorts by name and paginates with stable pages', async () => {
    for (const name of ['Grace', 'Ada', 'Linus', 'Ken', 'Barbara']) {
      await insertVolunteer({ name });
    }
    const page1 = await request(app).get('/volunteers?limit=2&page=1').expect(200);
    const page2 = await request(app).get('/volunteers?limit=2&page=2').expect(200);
    const page3 = await request(app).get('/volunteers?limit=2&page=3').expect(200);

    const names = [...page1.body.data, ...page2.body.data, ...page3.body.data].map(
      (v: { name: string }) => v.name,
    );
    expect(names).toEqual(['Ada', 'Barbara', 'Grace', 'Ken', 'Linus']);
    expect(page1.body.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
  });

  it('looks up a volunteer by exact email, case-insensitively', async () => {
    const ada = await insertVolunteer({ email: 'ada@illinois.edu' });
    await insertVolunteer({ email: 'grace@illinois.edu' });
    const res = await request(app).get('/volunteers?email=ADA@illinois.edu').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(ada._id.toString());
  });

  it('filters by isActive', async () => {
    await insertVolunteer({ isActive: false });
    await insertVolunteer();
    const res = await request(app).get('/volunteers?isActive=false').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isActive).toBe(false);
  });

  it.each([
    ['limit=0', 'limit'],
    ['limit=1000', 'limit'],
    ['page=0', 'page'],
    ['page=abc', 'page'],
    ['isActive=maybe', 'isActive'],
    ['isActive=yes', 'isActive'],
    ['email=', 'email'],
  ])('rejects ?%s with 400', async (queryString, field) => {
    const res = await request(app).get(`/volunteers?${queryString}`).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues[0]).toMatchObject({ location: 'query', path: field });
  });
});

describe('GET /volunteers (unknown filter)', () => {
  it('rejects a misspelled filter key instead of silently returning everything', async () => {
    const res = await request(app).get('/volunteers?emial=ada@illinois.edu').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues[0]).toMatchObject({
      location: 'query',
      message: expect.stringContaining('emial'),
    });
  });
});

describe('GET /volunteers/:id', () => {
  it('returns the volunteer', async () => {
    const ada = await insertVolunteer({ name: 'Ada' });
    const res = await request(app).get(`/volunteers/${ada._id.toString()}`).expect(200);
    expect(res.body.data).toMatchObject({ id: ada._id.toString(), name: 'Ada' });
  });

  it('returns 400 VALIDATION_ERROR for a malformed id', async () => {
    const res = await request(app).get('/volunteers/not-an-id').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues[0]).toMatchObject({ location: 'params', path: 'id' });
  });

  it('returns 404 VOLUNTEER_NOT_FOUND for a well-formed id that does not exist', async () => {
    const res = await request(app).get(`/volunteers/${UNKNOWN_ID}`).expect(404);
    expect(res.body.error.code).toBe('VOLUNTEER_NOT_FOUND');
  });
});
