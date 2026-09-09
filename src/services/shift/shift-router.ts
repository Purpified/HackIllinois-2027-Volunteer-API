import { Router } from 'express';
import { idParams } from '../../common/schemas.ts';
import { listMeta } from '../../common/serializers.ts';
import { handle } from '../../common/validate.ts';
import {
  createShiftBody,
  eventIdParams,
  listShiftsQuery,
  toShiftDto,
  updateShiftBody,
} from './shift-schemas.ts';
import { createShift, getShiftById, listShiftsForEvent, updateShift } from './shift-service.ts';

// Declares full paths, mounted at the app root: shifts are created and listed under their
// event (they cannot exist without one) but addressed flat by their own id.
export const shiftRouter = Router();

shiftRouter.post(
  '/events/:eventId/shifts',
  handle({ params: eventIdParams, body: createShiftBody }, async ({ params, body }, _req, res) => {
    const shift = await createShift(params.eventId, body);
    res
      .status(201)
      .location(`/shifts/${shift._id.toString()}`)
      .json({ data: toShiftDto(shift) });
  }),
);

shiftRouter.get(
  '/events/:eventId/shifts',
  handle(
    { params: eventIdParams, query: listShiftsQuery },
    async ({ params, query }, _req, res) => {
      const { items, total } = await listShiftsForEvent(params.eventId, query);
      res.status(200).json({
        data: items.map(toShiftDto),
        meta: listMeta(query.page, query.limit, total),
      });
    },
  ),
);

shiftRouter.get(
  '/shifts/:id',
  handle({ params: idParams }, async ({ params }, _req, res) => {
    const shift = await getShiftById(params.id);
    res.status(200).json({ data: toShiftDto(shift) });
  }),
);

shiftRouter.patch(
  '/shifts/:id',
  handle({ params: idParams, body: updateShiftBody }, async ({ params, body }, _req, res) => {
    const shift = await updateShift(params.id, body);
    res.status(200).json({ data: toShiftDto(shift) });
  }),
);
