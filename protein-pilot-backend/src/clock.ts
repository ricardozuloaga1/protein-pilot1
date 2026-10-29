import type { DB } from "./db.js";
export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };
const clocks = new WeakMap<DB, Clock>();
export function bindClock(db: DB, clock: Clock) {
  clocks.set(db, clock);
}
export function clockFor(db: DB): Clock {
  return clocks.get(db) || systemClock;
}
