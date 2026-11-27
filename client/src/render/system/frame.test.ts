import { describe, expect, it } from "vitest";

import { frameOf } from "./frame.ts";
import { spriteOf, TILE_SIZE } from "./render-test-utils.ts";

const items = ["a", "b", "c"];

describe("frameOf", () => {
  it("shows the only item without needing any frame timing", () => {
    expect(frameOf(spriteOf(), ["only"], TILE_SIZE, 5)).toBe("only");
  });

  it("shows nothing when there are no items", () => {
    expect(frameOf<string>(spriteOf(), [], TILE_SIZE, 5)).toBeUndefined();
  });

  it("steps through the items by the sprite's frame time and loops", () => {
    const sprite = spriteOf({ frameSec: 2 });

    expect(
      [0, 1.9, 2, 4.1, 6].map(now => frameOf(sprite, items, TILE_SIZE, now))
    ).toEqual(["a", "a", "b", "c", "a"]);
  });

  it("takes the frame time from how far the art moves at the game's speed", () => {
    // 4px is a quarter of a 16px tile, which takes 1s at a quarter tile a second.
    const sprite = spriteOf({ stepPx: TILE_SIZE / 4 });
    const tilesPerSecond = 0.25;

    expect(
      [0.5, 1].map(now =>
        frameOf(sprite, items, TILE_SIZE, now, tilesPerSecond)
      )
    ).toEqual(["a", "b"]);
  });

  it("prefers a fixed frame time to the game's speed", () => {
    const sprite = spriteOf({ frameSec: 1, stepPx: 1000 });

    expect(frameOf(sprite, items, TILE_SIZE, 1, 0.25)).toBe("b");
  });

  it("throws when the sprite depicts motion but no speed was given", () => {
    const sprite = spriteOf({ stepPx: 2 });

    expect(() => frameOf(sprite, items, TILE_SIZE, 1)).toThrow(
      "no frame timing"
    );
  });

  it("throws when an animated sprite has no frame timing at all", () => {
    expect(() => frameOf(spriteOf(), items, TILE_SIZE, 1)).toThrow(
      "no frame timing"
    );
  });
});
