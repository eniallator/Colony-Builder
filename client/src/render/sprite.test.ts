import { describe, expect, it } from "vitest";

import {
  frameAt,
  MIN_TEXTURE_PX_PER_TILE,
  patternFor,
  runsOf,
  usesTextures,
  variantIndex,
} from "./sprite.ts";
import { createFakeContext, FakePattern } from "./system/render-test-utils.ts";

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

describe("frameAt", () => {
  const frames = ["a", "b", "c"];

  it("steps through the frames over time and loops", () => {
    const at = (sec: number) => frameAt(frames, 1, sec).frame;
    expect([0, 0.99, 1, 2.5, 3, 5.5, 6.5].map(at)).toEqual([
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
    expect(frameAt(frames, 1, 1.5).index).toBe(1);
  });
});

describe("patternFor", () => {
  it("makes a repeating pattern from the bitmap", () => {
    const { ctx, context } = createFakeContext();
    const bitmap = {} as ImageBitmap;

    const pattern = patternFor(ctx, bitmap);

    expect(context.createPattern).toHaveBeenCalledExactlyOnceWith(
      bitmap,
      "repeat"
    );
    expect(pattern).toBeInstanceOf(FakePattern);
  });

  it("makes each bitmap's pattern once and reuses it", () => {
    const { ctx, context } = createFakeContext();
    const bitmap = {} as ImageBitmap;

    const first = patternFor(ctx, bitmap);
    const second = patternFor(ctx, bitmap);

    expect(second).toBe(first);
    expect(context.createPattern).toHaveBeenCalledOnce();
  });

  it("makes a separate pattern for each bitmap", () => {
    const { ctx } = createFakeContext();

    expect(patternFor(ctx, {} as ImageBitmap)).not.toBe(
      patternFor(ctx, {} as ImageBitmap)
    );
  });

  it("throws when the context cannot make a pattern", () => {
    const { ctx, context } = createFakeContext();
    context.createPattern.mockReturnValueOnce(null);

    expect(() => patternFor(ctx, {} as ImageBitmap)).toThrow(
      "Could not create a texture pattern"
    );
  });
});
