import { describe, expect, it } from "vitest";

import { createStoneAt, stoneOres } from "./stone.ts";

const SIDE = 400;

const scan = (seed: string) => {
  const stoneAt = createStoneAt(seed);
  return Array.from({ length: SIDE * SIDE }, (_, i) =>
    stoneAt((i % SIDE) - SIDE / 2, Math.floor(i / SIDE) - SIDE / 2)
  );
};

type Scan = ReturnType<typeof scan>;

const isOre = (tile: Scan[number]) => tile != null && tile !== "stone";

/** Groups touching tiles that satisfy `wanted` into patches of scan indices. */
const patches = (tiles: Scan, wanted: (tile: Scan[number]) => boolean) => {
  const seen = new Set<number>();
  const found: number[][] = [];

  tiles.forEach((tile, start) => {
    if (!wanted(tile) || seen.has(start)) return;
    const patch: number[] = [];
    const stack = [start];
    seen.add(start);
    for (let i = stack.pop(); i != null; i = stack.pop()) {
      patch.push(i);
      const x = i % SIDE;
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < SIDE - 1 ? i + 1 : -1,
        i - SIDE,
        i + SIDE,
      ];
      for (const next of neighbours) {
        if (!seen.has(next) && wanted(tiles[next])) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    found.push(patch);
  });

  return found;
};

describe("createStoneAt", () => {
  it("is deterministic for the same seed", () => {
    const a = createStoneAt("seed");
    const b = createStoneAt("seed");

    for (let i = 0; i < 500; i++) {
      expect(a(i * 31, -i * 17)).toBe(b(i * 31, -i * 17));
    }
  });

  it("differs between seeds", () => {
    expect(scan("seed-a")).not.toEqual(scan("seed-b"));
  });

  it.each(["a", "b", "colony"])(
    "covers a small share of the land (seed %s)",
    seed => {
      const tiles = scan(seed);
      const stone = tiles.filter(t => t != null).length / tiles.length;

      expect(stone).toBeGreaterThan(0.003);
      expect(stone).toBeLessThan(0.1);
    }
  );

  it.each(["a", "b", "colony"])(
    "is split into separate worms, none dominating (seed %s)",
    seed => {
      const found = patches(scan(seed), tile => tile != null);
      const total = found.reduce((sum, patch) => sum + patch.length, 0);
      const largest = Math.max(...found.map(patch => patch.length));

      expect(found.length).toBeGreaterThan(10);
      expect(largest).toBeLessThan(total / 2);
    }
  );

  it.each(["a", "b", "colony"])(
    "puts a minority of ore deposits inside the stone (seed %s)",
    seed => {
      const tiles = scan(seed);
      const deposits = patches(tiles, isOre);
      const ore = tiles.filter(isOre).length;
      const stone = tiles.filter(t => t != null).length;

      expect(deposits.length).toBeGreaterThan(10);
      expect(ore).toBeLessThan(stone / 3);
    }
  );

  it.each(["a", "b", "colony"])(
    "keeps ore off the stone's edge (seed %s)",
    seed => {
      const tiles = scan(seed);
      const ore = tiles.flatMap((tile, i) => (isOre(tile) ? i : []));
      const surrounded = ore.filter(i =>
        [i - 1, i + 1, i - SIDE, i + SIDE].every(n => tiles[n] != null)
      );

      expect(surrounded.length / ore.length).toBeGreaterThan(0.7);
    }
  );

  it.each(["a", "b", "colony"])(
    "shares ore tiles roughly evenly between the ores (seed %s)",
    seed => {
      const stoneAt = createStoneAt(seed);
      const counts = new Map<string, number>();
      for (let x = -1600; x < 1600; x += 2) {
        for (let y = -1600; y < 1600; y += 2) {
          const tile = stoneAt(x, y);
          if (tile != null && tile !== "stone")
            counts.set(tile, (counts.get(tile) ?? 0) + 1);
        }
      }
      const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

      for (const ore of stoneOres) {
        const share = (counts.get(ore) ?? 0) / total;
        expect(share, ore).toBeGreaterThan(0.5 / stoneOres.length);
        expect(share, ore).toBeLessThan(1.5 / stoneOres.length);
      }
    }
  );

  it.each(["a", "b", "colony"])(
    "carries every ore, each in its own deposits (seed %s)",
    seed => {
      const tiles = scan(seed);

      for (const ore of stoneOres) {
        expect(
          patches(tiles, tile => tile === ore).length,
          ore
        ).toBeGreaterThan(0);
      }
    }
  );
});
