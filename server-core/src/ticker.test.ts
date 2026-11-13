import { MAX_DT } from "@colony-builder/shared";
import { describe, expect, it, vi } from "vitest";

import type { Game } from "./game.ts";
import { createTicker } from "./ticker.ts";

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

    advance(50);

    expect(tick).not.toHaveBeenCalled();
  });

  it("steps the game by the seconds since it was created", () => {
    const { tick, step, advance } = setup();

    advance(50);
    step();

    expect(tick).toHaveBeenCalledExactlyOnceWith(0.05);
  });

  it("measures each step from the previous one", () => {
    const { tick, step, advance } = setup();

    advance(50);
    step();
    advance(30);
    step();

    expect(tick).toHaveBeenNthCalledWith(1, 0.05);
    expect(tick).toHaveBeenNthCalledWith(2, 0.03);
  });

  it("caps a long gap at MAX_DT", () => {
    const { tick, step, advance } = setup();

    advance(10_000);
    step();

    expect(tick).toHaveBeenCalledExactlyOnceWith(MAX_DT);
  });
});
