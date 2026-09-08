import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.ts';
import { EVENT_START, UNKNOWN_ID, hoursFrom, insertEvent } from '../../../tests/factories.ts';
import { EventModel } from './event-model.ts';

// FILE 5 OF 5: tests, in the same shape as volunteer-router.test.ts.

const app = createApp({ logging: false });

const OPENING = {
  name: 'Check-in and Opening Ceremony',
  description: 'Badge pickup, swag, welcome talk',
  location: 'Siebel Center atrium',
  startTime: '2027-02-26T17:00:00-06:00', // 5pm Chicago
  endTime: '2027-02-26T20:00:00-06:00',
};

describe('POST /events', () => {
  it('creates an event and returns times in UTC', async () => {
    const res = await request(app).post('/events').send(OPENING).expect(201);

    expect(res.body.data).toMatchObject({
      name: OPENING.name,
      description: OPENING.description,
      location: OPENING.location,
      // -06:00 input comes back as the same instant in UTC.
      startTime: '2027-02-26T23:00:00.000Z',
      endTime: '2027-02-27T02:00:00.000Z',
    });
    expect(res.body.data.id).toMatch(/^[0-9a-f]{24}$/);
    expect(res.body.data).not.toHaveProperty('_id');
    expect(res.headers.location).toBe(`/events/${res.body.data.id}`);

    const stored = await EventModel.findById(res.body.data.id);
    expect(stored?.startTime.toISOString()).toBe('2027-02-26T23:00:00.000Z');
  });

  it('accepts a Z (UTC) offset and omits optional fields that were not sent', async () => {
    const res = await request(app)
      .post('/events')
      .send({
        name: 'Friday Dinner',
        startTime: '2027-02-27T00:00:00Z',
        endTime: '2027-02-27T01:30:00Z',
      })
      .expect(201);
    expect(res.body.data).not.toHaveProperty('description');
    expect(res.body.data).not.toHaveProperty('location');
  });

  it.each([
    ['a datetime without a timezone', { startTime: '2027-02-26T17:00:00' }, 'startTime'],
    ['a date without a time', { startTime: '2027-02-26' }, 'startTime'],
    ['endTime equal to startTime', { endTime: OPENING.startTime }, 'endTime'],
    ['endTime before startTime', { endTime: '2027-02-26T16:00:00-06:00' }, 'endTime'],
    ['a missing name', { name: undefined }, 'name'],
    ['an unknown field', { capacity: 5 }, ''],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, override, path) => {
    const res = await request(app)
      .post('/events')
      .send({ ...OPENING, ...override })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues[0]).toMatchObject({ location: 'body', path });
    expect(await EventModel.countDocuments()).toBe(0);
  });

  it('is also guarded at the database layer for writers that skip HTTP', async () => {
    // The seed script calls the model directly. The schema hook still refuses bad times.
    await expect(
      EventModel.create({
        name: 'Backwards',
        startTime: hoursFrom(EVENT_START, 3),
        endTime: EVENT_START,
      }),
    ).rejects.toThrow(/endTime must be after startTime/);
  });
});

describe('GET /events', () => {
  it('returns an empty page when there are no events', async () => {
    const res = await request(app).get('/events').expect(200);
    expect(res.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  it('sorts by start time regardless of creation order', async () => {
    await insertEvent({ name: 'Second', startTime: hoursFrom(EVENT_START, 5) });
    await insertEvent({ name: 'Third', startTime: hoursFrom(EVENT_START, 9) });
    await insertEvent({ name: 'First', startTime: EVENT_START });
    const res = await request(app).get('/events').expect(200);
    expect(res.body.data.map((e: { name: string }) => e.name)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  it('selects events that overlap the from/to window', async () => {
    const t = (h: number) => hoursFrom(EVENT_START, h);
    await insertEvent({ name: 'A', startTime: t(9), endTime: t(11) });
    await insertEvent({ name: 'B', startTime: t(10), endTime: t(12) });
    await insertEvent({ name: 'C', startTime: t(13), endTime: t(14) });

    const window = (from: number, to: number) =>
      `/events?from=${t(from).toISOString()}&to=${t(to).toISOString()}`;

    // 10:30 to 13:30: A is still running at 10:30, B overlaps, C starts inside.
    let res = await request(app).get(window(10.5, 13.5)).expect(200);
    expect(res.body.data.map((e: { name: string }) => e.name)).toEqual(['A', 'B', 'C']);

    // 10:30 to 13:00: C starts exactly at the end of the window and is excluded (half-open).
    res = await request(app).get(window(10.5, 13)).expect(200);
    expect(res.body.data.map((e: { name: string }) => e.name)).toEqual(['A', 'B']);

    // Only a lower bound: everything still running after 11:30.
    res = await request(app)
      .get(`/events?from=${t(11.5).toISOString()}`)
      .expect(200);
    expect(res.body.data.map((e: { name: string }) => e.name)).toEqual(['B', 'C']);
  });

  it('rejects from after to', async () => {
    const res = await request(app)
      .get(
        `/events?from=${hoursFrom(EVENT_START, 5).toISOString()}&to=${EVENT_START.toISOString()}`,
      )
      .expect(400);
    expect(res.body.error.details.issues[0]).toMatchObject({ location: 'query', path: 'from' });
  });

  it('paginates', async () => {
    for (let i = 0; i < 5; i += 1) {
      await insertEvent();
    }
    const res = await request(app).get('/events?limit=2&page=3').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 3, limit: 2, total: 5, totalPages: 3 });
  });
});

describe('GET /events/:id', () => {
  it('returns the event', async () => {
    const event = await insertEvent({ name: 'Project Expo' });
    const res = await request(app).get(`/events/${event._id.toString()}`).expect(200);
    expect(res.body.data).toMatchObject({ id: event._id.toString(), name: 'Project Expo' });
  });

  it('returns 400 for a malformed id and 404 for an unknown one', async () => {
    await request(app).get('/events/nope').expect(400);
    const res = await request(app).get(`/events/${UNKNOWN_ID}`).expect(404);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });
});

describe('PATCH /events/:id', () => {
  it('updates only the fields sent', async () => {
    const event = await insertEvent({ name: 'Old name', location: 'Siebel 1404' });
    const res = await request(app)
      .patch(`/events/${event._id.toString()}`)
      .send({ name: 'New name' })
      .expect(200);
    expect(res.body.data).toMatchObject({
      name: 'New name',
      location: 'Siebel 1404',
      startTime: event.startTime.toISOString(),
    });
  });

  it('rejects moving startTime past the stored endTime, naming endTime', async () => {
    const event = await insertEvent();
    const res = await request(app)
      .patch(`/events/${event._id.toString()}`)
      .send({ startTime: hoursFrom(event.endTime, 1).toISOString() })
      .expect(400);
    expect(res.body.error.details.issues[0]).toMatchObject({ location: 'body', path: 'endTime' });
    const stored = await EventModel.findById(event._id);
    expect(stored?.startTime).toEqual(event.startTime);
  });

  it('accepts moving both times together', async () => {
    const event = await insertEvent();
    const startTime = hoursFrom(event.endTime, 1);
    const endTime = hoursFrom(startTime, 2);
    const res = await request(app)
      .patch(`/events/${event._id.toString()}`)
      .send({ startTime: startTime.toISOString(), endTime: endTime.toISOString() })
      .expect(200);
    expect(res.body.data.startTime).toBe(startTime.toISOString());
  });

  it.each([
    ['an empty body', {}],
    ['an unknown field', { capacity: 3 }],
    ['an empty name', { name: '   ' }],
  ])('rejects %s with 400', async (_label, body) => {
    const event = await insertEvent();
    const res = await request(app).patch(`/events/${event._id.toString()}`).send(body).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an unknown event', async () => {
    await request(app).patch(`/events/${UNKNOWN_ID}`).send({ name: 'x' }).expect(404);
  });
});
