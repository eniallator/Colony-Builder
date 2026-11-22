import { describe, expect, it } from "vitest";

import { DirtyTracker } from "./dirty.ts";

describe("DirtyTracker", () => {
  it("is empty to begin with", () => {
    expect(new DirtyTracker<number>(true).flush()).toEqual([]);
  });

  it("returns the ids marked since the last flush", () => {
    const tracker = new DirtyTracker<number>(true);

    tracker.mark(3);
    tracker.mark(1);

    expect(tracker.flush()).toEqual([3, 1]);
  });

  it("returns an id once however often it was marked", () => {
    const tracker = new DirtyTracker<number>(true);

    tracker.mark(2);
    tracker.mark(2);

    expect(tracker.flush()).toEqual([2]);
  });

  it("is empty after a flush", () => {
    const tracker = new DirtyTracker<number>(true);
    tracker.mark(2);
    tracker.flush();

    expect(tracker.flush()).toEqual([]);
  });

  it("starts again after a flush", () => {
    const tracker = new DirtyTracker<number>(true);
    tracker.mark(2);
    tracker.flush();

    tracker.mark(2);

    expect(tracker.flush()).toEqual([2]);
  });

  it("remembers nothing when disabled", () => {
    const tracker = new DirtyTracker<number>(false);

    tracker.mark(2);

    expect(tracker.flush()).toEqual([]);
  });
});
