// Injectable "now" so time-based rules are deterministic in tests.
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };
