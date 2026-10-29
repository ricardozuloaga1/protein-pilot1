export interface Clock { now(): number }
const realClock: Clock = { now: () => Date.now() };
let active: Clock = realClock;
export const appClock: Clock = { now: () => active.now() };
// No URL, environment-variable or remote endpoint can change the clock.
export function setTestClock(clock: Clock) {
  if (process.env.NODE_ENV !== "test") throw new Error("Test clock unavailable");
  active = clock;
  return () => { active = realClock; };
}
