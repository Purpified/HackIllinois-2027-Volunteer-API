import { Router } from 'express';
import { idParams } from '../../common/schemas.ts';
import { listMeta } from '../../common/serializers.ts';
import { handle } from '../../common/validate.ts';
import { createEventBody, listEventsQuery, toEventDto, updateEventBody } from './event-schemas.ts';
import { createEvent, getEventById, listEvents, updateEvent } from './event-service.ts';

// FILE 4 OF 5: the router, mounted at /events in app.ts.
// (The event's shifts and its volunteer roster live under /events/:id/... too, but those routes
// belong to the shift and signup features, which declare them with full paths.)

export const eventRouter = Router();

// POST /events
eventRouter.post(
  '/',
  handle({ body: createEventBody }, async ({ body }, _req, res) => {
    const event = await createEvent(body);
    res
      .status(201)
      .location(`/events/${event._id.toString()}`)
      .json({ data: toEventDto(event) });
  }),
);

// GET /events?from=...&to=...&page=1&limit=20
eventRouter.get(
  '/',
  handle({ query: listEventsQuery }, async ({ query }, _req, res) => {
    const { items, total } = await listEvents(query);
    res.status(200).json({
      data: items.map(toEventDto),
      meta: listMeta(query.page, query.limit, total),
    });
  }),
);

// GET /events/:id
eventRouter.get(
  '/:id',
  handle({ params: idParams }, async ({ params }, _req, res) => {
    const event = await getEventById(params.id);
    res.status(200).json({ data: toEventDto(event) });
  }),
);

// PATCH /events/:id  (two validated inputs: the id from the path and the partial body)
eventRouter.patch(
  '/:id',
  handle({ params: idParams, body: updateEventBody }, async ({ params, body }, _req, res) => {
    const event = await updateEvent(params.id, body);
    res.status(200).json({ data: toEventDto(event) });
  }),
);
