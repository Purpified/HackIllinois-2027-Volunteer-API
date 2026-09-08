import { Router } from 'express';
import { idParams } from '../../common/schemas.ts';
import { listMeta } from '../../common/serializers.ts';
import { handle } from '../../common/validate.ts';
import { createVolunteerBody, listVolunteersQuery, toVolunteerDto } from './volunteer-schemas.ts';
import { createVolunteer, getVolunteerById, listVolunteers } from './volunteer-service.ts';

// Mounted at /volunteers.
export const volunteerRouter = Router();

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

volunteerRouter.get(
  '/:id',
  handle({ params: idParams }, async ({ params }, _req, res) => {
    const volunteer = await getVolunteerById(params.id);
    res.status(200).json({ data: toVolunteerDto(volunteer) });
  }),
);
