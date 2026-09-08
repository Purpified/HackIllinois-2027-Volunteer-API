import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType } from 'mongoose';

// An Event is a scheduled activity at the hackathon (Opening Ceremony, Friday Dinner, ...).
// Shifts belong to events; volunteers attach to events only through shift signups.
const eventSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    location: { type: String, trim: true, maxlength: 120 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
  },
  { timestamps: true },
);

eventSchema.index({ startTime: 1 });

// Guards non-HTTP writers. Runs on create()/save() only, not on findOneAndUpdate.
eventSchema.pre('validate', function () {
  if (this.endTime <= this.startTime) {
    this.invalidate('endTime', 'endTime must be after startTime');
  }
});

export type Event = InferSchemaType<typeof eventSchema>;
export type EventDoc = HydratedDocumentFromSchema<typeof eventSchema>;

export const EventModel = model('Event', eventSchema);
