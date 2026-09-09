import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType } from 'mongoose';

// A Shift is a unit of volunteer work at an event ("Food line, 5-7pm, capacity 4").
// Volunteers attach to shifts through signups, never to events directly.
const shiftSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    role: { type: String, required: true, trim: true, maxlength: 120 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1, max: 500 },
    // Count of ACTIVE signups, denormalized so capacity is enforced with an atomic conditional
    // update on this one document (see claimSeat). Maintained by the signup feature only.
    signupCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Serves the hot query: one event's shifts in start-time order.
shiftSchema.index({ eventId: 1, startTime: 1 });

// Guards non-HTTP writers. Runs on create()/save() only, not on findOneAndUpdate.
shiftSchema.pre('validate', function () {
  if (this.endTime <= this.startTime) {
    this.invalidate('endTime', 'endTime must be after startTime');
  }
});

export type Shift = InferSchemaType<typeof shiftSchema>;
export type ShiftDoc = HydratedDocumentFromSchema<typeof shiftSchema>;

export const ShiftModel = model('Shift', shiftSchema);
