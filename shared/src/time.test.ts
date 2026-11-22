import { describe, expect, it } from "vitest";

import { encTime, type Time } from "./time.ts";

const time: Time = {
  start: 1.5,
  lastFrame: 1_000_000.25,
  now: 1_000_000.75,
  delta: 0.5,
};

describe("encTime", () => {
  it("round-trips a time", () => {
    expect(encTime.decode(encTime.encode(time))).toEqual(time);
  });

  it("keeps the precision of a clock that has run for a long time", () => {
    const late: Time = { ...time, now: 1_700_000_000.123, delta: 1 / 60 };

    expect(encTime.decode(encTime.encode(late))).toEqual(late);
  });

  it("rejects a value that is not a time", () => {
    expect(encTime.guard({ ...time, now: "now" })).toBe(false);
    expect(encTime.guard({ start: 0, lastFrame: 0, now: 0 })).toBe(false);
  });

  it("rejects truncated bytes", () => {
    expect(encTime.decode(encTime.encode(time).slice(1))).toBeUndefined();
  });
});
