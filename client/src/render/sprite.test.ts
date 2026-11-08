import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import {
  directionOf as directionOfDelta,
  frameAt,
  MIN_TEXTURE_PX_PER_TILE,
  runsOf,
  usesTextures,
  variantIndex,
} from "./sprite.ts";

describe("usesTextures", () => {
  it("draws textures from 8px per tile upwards", () => {
    expect(MIN_TEXTURE_PX_PER_TILE).toBe(8);
    expect([2, 4, 8, 16, 32].map(usesTextures)).toEqual([
      false,
      false,
      true,
      true,
      true,
    ]);
  });
});

describe("variantIndex", () => {
  it("is always 0 when there is only one variant", () => {
    expect(variantIndex(5, -3, 1)).toBe(0);
    expect(variantIndex(5, -3, 0)).toBe(0);
  });

  it("is deterministic and within range, including negative positions", () => {
    for (let y = -20; y <= 20; y++) {
      for (let x = -20; x <= 20; x++) {
        const index = variantIndex(x, y, 4);
        expect(index).toBe(variantIndex(x, y, 4));
        expect(Number.isInteger(index) && index >= 0 && index < 4).toBe(true);
      }
    }
  });

  it("spreads tiles roughly evenly across the variants", () => {
    const counts = [0, 0, 0, 0];
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        const index = variantIndex(x, y, 4);
        counts[index] = (counts[index] ?? 0) + 1;
      }
    }
    for (const count of counts) {
      expect(count / 2500).toBeGreaterThan(0.2);
      expect(count / 2500).toBeLessThan(0.3);
    }
  });

  it("is not correlated with a tile's neighbours", () => {
    // For independent variants, a neighbour matches 1 time in `count`. A weak
    // hash made whole rows one variant (matching ~56% of the time).
    for (const count of [4, 8]) {
      let right = 0;
      let below = 0;
      let longestRun = 0;
      for (let y = -50; y < 50; y++) {
        let run = 1;
        for (let x = -50; x < 50; x++) {
          const here = variantIndex(x, y, count);
          const matchesRight = here === variantIndex(x + 1, y, count);
          if (matchesRight) right++;
          if (here === variantIndex(x, y + 1, count)) below++;
          run = matchesRight ? run + 1 : 1;
          longestRun = Math.max(longestRun, run);
        }
      }
      const expected = 1 / count;
      expect(right / 10000).toBeGreaterThan(expected * 0.85);
      expect(right / 10000).toBeLessThan(expected * 1.15);
      expect(below / 10000).toBeGreaterThan(expected * 0.85);
      expect(below / 10000).toBeLessThan(expected * 1.15);
      expect(longestRun).toBeLessThan(12);
    }
  });
});

describe("runsOf", () => {
  const runs = (
    values: (string | undefined)[],
    from = 0,
    to = values.length
  ) => [...runsOf(from, to, i => values[i])];

  it("groups consecutive equal values", () => {
    expect(runs(["a", "a", "b", "a", "a", "a"])).toEqual([
      ["a", 0, 2],
      ["b", 2, 3],
      ["a", 3, 6],
    ]);
  });

  it("returns a single run when every value is equal", () => {
    expect(runs(["a", "a", "a"])).toEqual([["a", 0, 3]]);
  });

  it("returns nothing for an empty range", () => {
    expect(runs([], 0, 0)).toEqual([]);
    expect(runs(["a"], 3, 3)).toEqual([]);
  });

  it("treats undefined as a value of its own", () => {
    expect(runs([undefined, undefined, "a"])).toEqual([
      [undefined, 0, 2],
      ["a", 2, 3],
    ]);
  });

  it("works on a range that does not start at 0", () => {
    const values: Record<number, string> = { "-2": "x", "-1": "x", 0: "y" };
    expect([...runsOf(-2, 1, i => values[i])]).toEqual([
      ["x", -2, 0],
      ["y", 0, 1],
    ]);
  });
});

describe("directionOf", () => {
  const directionOf = (dx: number, dy: number) =>
    directionOfDelta(Vector.create(dx, dy));

  it("is undefined when not moving", () => {
    expect(directionOf(0, 0)).toBeUndefined();
  });

  it("uses the dominant axis", () => {
    expect(directionOf(3, 1)).toBe("right");
    expect(directionOf(-3, 1)).toBe("left");
    expect(directionOf(1, 3)).toBe("down");
    expect(directionOf(1, -3)).toBe("up");
  });

  it("handles movement along a single axis", () => {
    expect(directionOf(5, 0)).toBe("right");
    expect(directionOf(0, -5)).toBe("up");
  });

  it("prefers vertical on an exact diagonal", () => {
    expect(directionOf(2, 2)).toBe("down");
    expect(directionOf(2, -2)).toBe("up");
  });
});

describe("frameAt", () => {
  const frames = ["a", "b", "c"];

  it("steps through the frames over time and loops", () => {
    const at = (ms: number) => frameAt(frames, 100, ms).frame;
    expect([0, 99, 100, 250, 300, 550, 650].map(at)).toEqual([
      "a",
      "a",
      "b",
      "c",
      "a",
      "c",
      "a",
    ]);
  });

  it("reports the frame's index too", () => {
    expect(frameAt(frames, 100, 150).index).toBe(1);
  });
});
