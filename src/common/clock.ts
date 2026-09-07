// Services that stamp times take a Clock so tests can freeze "now" instead of sleeping.
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };
