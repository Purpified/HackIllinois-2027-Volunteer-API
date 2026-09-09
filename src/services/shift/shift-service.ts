import { AppError } from '../../common/errors.ts';
import { assertEventExists } from '../event/event-service.ts';
import { ShiftModel, type ShiftDoc } from './shift-model.ts';
import type { CreateShiftBody, ListShiftsQuery, UpdateShiftBody } from './shift-schemas.ts';

// The event check and the insert are not atomic (MongoDB has no foreign keys), but events
// cannot be deleted, so a verified event cannot vanish before the create lands.
export async function createShift(eventId: string, input: CreateShiftBody): Promise<ShiftDoc> {
  await assertEventExists(eventId);
  return ShiftModel.create({ ...input, eventId });
}

export async function getShiftById(id: string): Promise<ShiftDoc> {
  const shift = await ShiftModel.findById(id);
  if (!shift) {
    throw new AppError(404, 'SHIFT_NOT_FOUND', `No shift with id ${id}`);
  }
  return shift;
}

// The signup feature calls this before creating a signup, as this feature does with events.
export async function assertShiftExists(id: string): Promise<void> {
  const exists = await ShiftModel.exists({ _id: id });
  if (!exists) {
    throw new AppError(404, 'SHIFT_NOT_FOUND', `No shift with id ${id}`);
  }
}

export type ShiftPage = { items: ShiftDoc[]; total: number };

// Asserts the event first so an empty page means "no shifts", never "no such event".
export async function listShiftsForEvent(
  eventId: string,
  query: ListShiftsQuery,
): Promise<ShiftPage> {
  await assertEventExists(eventId);

  const filter = { eventId };
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    ShiftModel.find(filter).sort({ startTime: 1, _id: 1 }).skip(skip).limit(query.limit),
    ShiftModel.countDocuments(filter),
  ]);
  return { items, total };
}

export async function updateShift(id: string, patch: UpdateShiftBody): Promise<ShiftDoc> {
  const shift = await getShiftById(id);

  // Check end > start on the merged values, since a PATCH may send only one of the two.
  const startTime = patch.startTime ?? shift.startTime;
  const endTime = patch.endTime ?? shift.endTime;
  if (endTime <= startTime) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request failed validation', {
      issues: [{ location: 'body', path: 'endTime', message: 'endTime must be after startTime' }],
    });
  }

  const updated = await ShiftModel.findByIdAndUpdate(
    id,
    { $set: patch },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) {
    throw new AppError(404, 'SHIFT_NOT_FOUND', `No shift with id ${id}`);
  }
  return updated;
}
