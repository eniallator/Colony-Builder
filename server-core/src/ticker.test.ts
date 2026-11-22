import { MAX_DT } from "@colony-builder/shared";
import { describe, expect, it, vi } from "vitest";

import type { Game } from "./game.ts";
import { createTicker } from "./ticker.ts";

// Gaps the ticker passes on as they are, so both are shorter than `MAX_DT`.
const firstGapMs = (MAX_DT * 1000) / 2;
const secondGapMs = firstGapMs / 2;

const setup = () => {
  let time = 1_000;
  const tick = vi.fn<Game["tick"]>();
  const step = createTicker(
    { connect: vi.fn<Game["connect"]>(), tick },
    () => time
  );

  return {
    tick,
    step,
    advance: (ms: number) => {
      time += ms;
    },
  };
};

describe("createTicker", () => {
  it("does not tick until it is called", () => {
    const { tick, advance } = setup();

    advance(firstGapMs);

    expect(tick).not.toHaveBeenCalled();
  });

  it("steps the game by the seconds since it was created", () => {
    const { tick, step, advance } = setup();

    advance(firstGapMs);
    step();

    expect(tick).toHaveBeenCalledExactlyOnceWith(firstGapMs / 1000);
  });

  it("measures each step from the previous one", () => {
    const { tick, step, advance } = setup();

    advance(firstGapMs);
    step();
    advance(secondGapMs);
    step();

    expect(tick).toHaveBeenNthCalledWith(1, firstGapMs / 1000);
    expect(tick).toHaveBeenNthCalledWith(2, secondGapMs / 1000);
  });

  it("caps a long gap at MAX_DT", () => {
    const { tick, step, advance } = setup();

    advance(10 * MAX_DT * 1000);
    step();

    expect(tick).toHaveBeenCalledExactlyOnceWith(MAX_DT);
  });
});
