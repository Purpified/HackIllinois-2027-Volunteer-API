import { Router } from 'express';
import { idParams } from '../../common/schemas.ts';
import { listMeta } from '../../common/serializers.ts';
import { handle } from '../../common/validate.ts';
import { createVolunteerBody, listVolunteersQuery, toVolunteerDto } from './volunteer-schemas.ts';
import { createVolunteer, getVolunteerById, listVolunteers } from './volunteer-service.ts';

// FILE 4 OF 5: the router. HTTP in, HTTP out, nothing else. Each route is:
//   method + path -> handle({ which inputs to validate }, async (validated input, req, res) => ...)
// The router is mounted at /volunteers in app.ts, so '/' here means POST /volunteers.

export const volunteerRouter = Router();

// POST /volunteers
volunteerRouter.post(
  '/',
  handle({ body: createVolunteerBody }, async ({ body }, _req, res) => {
    const volunteer = await createVolunteer(body);
    res
      .status(201)
      .location(`/volunteers/${volunteer._id.toString()}`)
      .json({ data: toVolunteerDto(volunteer) });
  }),
);

// GET /volunteers?page=1&limit=20&email=...&isActive=true
volunteerRouter.get(
  '/',
  handle({ query: listVolunteersQuery }, async ({ query }, _req, res) => {
    const { items, total } = await listVolunteers(query);
    res.status(200).json({
      data: items.map(toVolunteerDto),
      meta: listMeta(query.page, query.limit, total),
    });
  }),
);

// GET /volunteers/:id
volunteerRouter.get(
  '/:id',
  handle({ params: idParams }, async ({ params }, _req, res) => {
    const volunteer = await getVolunteerById(params.id);
    res.status(200).json({ data: toVolunteerDto(volunteer) });
  }),
);
