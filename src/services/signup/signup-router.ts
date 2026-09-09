import { Router } from 'express';
import { idParams } from '../../common/schemas.ts';
import { listMeta } from '../../common/serializers.ts';
import { handle } from '../../common/validate.ts';
import {
  createSignupBody,
  listSignupsQuery,
  shiftIdParams,
  toSignupDto,
  volunteerIdParams,
} from './signup-schemas.ts';
import {
  cancelSignup,
  createSignup,
  getSignupById,
  listSignupsForShift,
  listSignupsForVolunteer,
} from './signup-service.ts';

// Declares full paths, mounted at the app root: signups are created under their shift,
// listed from either side of the join, and addressed flat by their own id.
export const signupRouter = Router();

signupRouter.post(
  '/shifts/:shiftId/signups',
  handle({ params: shiftIdParams, body: createSignupBody }, async ({ params, body }, _req, res) => {
    const signup = await createSignup(params.shiftId, body);
    res
      .status(201)
      .location(`/signups/${signup._id.toString()}`)
      .json({ data: toSignupDto(signup) });
  }),
);

signupRouter.get(
  '/shifts/:shiftId/signups',
  handle(
    { params: shiftIdParams, query: listSignupsQuery },
    async ({ params, query }, _req, res) => {
      const { items, total } = await listSignupsForShift(params.shiftId, query);
      res.status(200).json({
        data: items.map(toSignupDto),
        meta: listMeta(query.page, query.limit, total),
      });
    },
  ),
);

signupRouter.get(
  '/volunteers/:volunteerId/signups',
  handle(
    { params: volunteerIdParams, query: listSignupsQuery },
    async ({ params, query }, _req, res) => {
      const { items, total } = await listSignupsForVolunteer(params.volunteerId, query);
      res.status(200).json({
        data: items.map(toSignupDto),
        meta: listMeta(query.page, query.limit, total),
      });
    },
  ),
);

signupRouter.get(
  '/signups/:id',
  handle({ params: idParams }, async ({ params }, _req, res) => {
    const signup = await getSignupById(params.id);
    res.status(200).json({ data: toSignupDto(signup) });
  }),
);

// A POST action, not DELETE: the row survives as history with status 'cancelled', a second
// cancel is a reportable error, and future transitions (check-in, no-show) fit the pattern.
signupRouter.post(
  '/signups/:id/cancel',
  handle({ params: idParams }, async ({ params }, _req, res) => {
    const signup = await cancelSignup(params.id);
    res.status(200).json({ data: toSignupDto(signup) });
  }),
);
