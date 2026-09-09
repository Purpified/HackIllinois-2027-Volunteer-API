import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.ts';
import {
  EVENT_START,
  UNKNOWN_ID,
  hoursFrom,
  insertEvent,
  insertShift,
} from '../../../tests/factories.ts';
import { ShiftModel } from './shift-model.ts';

const app = createApp({ logging: false });

const CHECK_IN = {
  role: 'Check-in desk',
  startTime: '2027-02-26T17:00:00-06:00', // 5pm Chicago
  endTime: '2027-02-26T19:00:00-06:00',
  capacity: 4,
};

describe('POST /events/:eventId/shifts', () => {
  it('creates a shift under the event and returns times in UTC', async () => {
    const event = await insertEvent();
    const res = await request(app)
      .post(`/events/${event._id.toString()}/shifts`)
      .send(CHECK_IN)
      .expect(201);

    expect(res.body.data).toMatchObject({
      eventId: event._id.toString(),
      role: CHECK_IN.role,
      capacity: 4,
      signupCount: 0,
      startTime: '2027-02-26T23:00:00.000Z',
      endTime: '2027-02-27T01:00:00.000Z',
    });
    expect(res.body.data.id).toMatch(/^[0-9a-f]{24}$/);
    expect(res.body.data).not.toHaveProperty('_id');
    expect(res.headers.location).toBe(`/shifts/${res.body.data.id}`);

    const stored = await ShiftModel.findById(res.body.data.id);
    expect(stored?.eventId.toString()).toBe(event._id.toString());
  });

  it('returns 404 without creating anything when the event does not exist', async () => {
    const res = await request(app).post(`/events/${UNKNOWN_ID}/shifts`).send(CHECK_IN).expect(404);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
    expect(await ShiftModel.countDocuments()).toBe(0);
  });

  it('returns 400 for a malformed event id', async () => {
    const res = await request(app).post('/events/nope/shifts').send(CHECK_IN).expect(400);
    expect(res.body.error.details.issues[0]).toMatchObject({
      location: 'params',
      path: 'eventId',
    });
  });

  it.each([
    ['endTime equal to startTime', { endTime: CHECK_IN.startTime }, 'endTime'],
    ['a datetime without a timezone', { startTime: '2027-02-26T17:00:00' }, 'startTime'],
    ['a missing role', { role: undefined }, 'role'],
    ['a zero capacity', { capacity: 0 }, 'capacity'],
    ['a fractional capacity', { capacity: 2.5 }, 'capacity'],
    ['an eventId in the body', { eventId: UNKNOWN_ID }, ''],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, override, path) => {
    const event = await insertEvent();
    const res = await request(app)
      .post(`/events/${event._id.toString()}/shifts`)
      .send({ ...CHECK_IN, ...override })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues[0]).toMatchObject({ location: 'body', path });
    expect(await ShiftModel.countDocuments()).toBe(0);
  });

  it('may extend outside the event window (setup and teardown crews)', async () => {
    const event = await insertEvent({ startTime: EVENT_START, endTime: hoursFrom(EVENT_START, 3) });
    await request(app)
      .post(`/events/${event._id.toString()}/shifts`)
      .send({
        role: 'Setup crew',
        startTime: hoursFrom(EVENT_START, -2).toISOString(),
        endTime: EVENT_START.toISOString(),
        capacity: 6,
      })
      .expect(201);
  });

  it('is also guarded at the database layer for writers that skip HTTP', async () => {
    const event = await insertEvent();
    await expect(
      ShiftModel.create({
        eventId: event._id,
        role: 'Backwards',
        startTime: hoursFrom(EVENT_START, 2),
        endTime: EVENT_START,
        capacity: 1,
      }),
    ).rejects.toThrow(/endTime must be after startTime/);
  });
});

describe('GET /events/:eventId/shifts', () => {
  it("returns only that event's shifts, sorted by start time", async () => {
    const event = await insertEvent();
    const other = await insertEvent();
    await insertShift({
      eventId: event._id,
      role: 'Second',
      startTime: hoursFrom(EVENT_START, 2),
      endTime: hoursFrom(EVENT_START, 4),
    });
    await insertShift({ eventId: other._id, role: 'Elsewhere' });
    await insertShift({
      eventId: event._id,
      role: 'First',
      startTime: EVENT_START,
      endTime: hoursFrom(EVENT_START, 2),
    });

    const res = await request(app).get(`/events/${event._id.toString()}/shifts`).expect(200);
    expect(res.body.data.map((s: { role: string }) => s.role)).toEqual(['First', 'Second']);
    expect(res.body.meta.total).toBe(2);
  });

  it('returns an empty page for an event with no shifts', async () => {
    const event = await insertEvent();
    const res = await request(app).get(`/events/${event._id.toString()}/shifts`).expect(200);
    expect(res.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  it('returns 404 for an unknown event, distinguishing it from an empty list', async () => {
    const res = await request(app).get(`/events/${UNKNOWN_ID}/shifts`).expect(404);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('paginates', async () => {
    const event = await insertEvent();
    for (let i = 0; i < 5; i += 1) {
      await insertShift({ eventId: event._id });
    }
    const res = await request(app)
      .get(`/events/${event._id.toString()}/shifts?limit=2&page=3`)
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 3, limit: 2, total: 5, totalPages: 3 });
  });
});

describe('GET /shifts/:id', () => {
  it('returns the shift', async () => {
    const shift = await insertShift({ role: 'Food line' });
    const res = await request(app).get(`/shifts/${shift._id.toString()}`).expect(200);
    expect(res.body.data).toMatchObject({ id: shift._id.toString(), role: 'Food line' });
  });

  it('returns 400 for a malformed id and 404 for an unknown one', async () => {
    await request(app).get('/shifts/nope').expect(400);
    const res = await request(app).get(`/shifts/${UNKNOWN_ID}`).expect(404);
    expect(res.body.error.code).toBe('SHIFT_NOT_FOUND');
  });
});

describe('PATCH /shifts/:id', () => {
  it('updates only the fields sent', async () => {
    const shift = await insertShift({ role: 'Old role', capacity: 4 });
    const res = await request(app)
      .patch(`/shifts/${shift._id.toString()}`)
      .send({ capacity: 8 })
      .expect(200);
    expect(res.body.data).toMatchObject({
      role: 'Old role',
      capacity: 8,
      startTime: shift.startTime.toISOString(),
    });
  });

  it('rejects moving startTime past the stored endTime, naming endTime', async () => {
    const shift = await insertShift();
    const res = await request(app)
      .patch(`/shifts/${shift._id.toString()}`)
      .send({ startTime: hoursFrom(shift.endTime, 1).toISOString() })
      .expect(400);
    expect(res.body.error.details.issues[0]).toMatchObject({ location: 'body', path: 'endTime' });
    const stored = await ShiftModel.findById(shift._id);
    expect(stored?.startTime).toEqual(shift.startTime);
  });

  it('accepts moving both times together', async () => {
    const shift = await insertShift();
    const startTime = hoursFrom(shift.endTime, 1);
    const endTime = hoursFrom(startTime, 2);
    const res = await request(app)
      .patch(`/shifts/${shift._id.toString()}`)
      .send({ startTime: startTime.toISOString(), endTime: endTime.toISOString() })
      .expect(200);
    expect(res.body.data.startTime).toBe(startTime.toISOString());
  });

  it('rejects lowering capacity below the active signup count', async () => {
    const shift = await insertShift({ capacity: 5, signupCount: 3 });
    const res = await request(app)
      .patch(`/shifts/${shift._id.toString()}`)
      .send({ capacity: 2 })
      .expect(409);
    expect(res.body.error.code).toBe('CAPACITY_BELOW_SIGNUPS');
    expect((await ShiftModel.findById(shift._id))?.capacity).toBe(5);
  });

  it('accepts lowering capacity to exactly the active signup count', async () => {
    const shift = await insertShift({ capacity: 5, signupCount: 3 });
    await request(app).patch(`/shifts/${shift._id.toString()}`).send({ capacity: 3 }).expect(200);
  });

  it.each([
    ['an empty body', {}],
    ['an eventId (shifts cannot move between events)', { eventId: UNKNOWN_ID }],
    ['an empty role', { role: '   ' }],
  ])('rejects %s with 400', async (_label, body) => {
    const shift = await insertShift();
    const res = await request(app).patch(`/shifts/${shift._id.toString()}`).send(body).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an unknown shift', async () => {
    await request(app).patch(`/shifts/${UNKNOWN_ID}`).send({ capacity: 2 }).expect(404);
  });
});
