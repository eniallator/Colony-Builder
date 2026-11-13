import { describe, expect, it } from "vitest";

import { createBiomeAt, type Biome } from "./biome.ts";

const EXTENT = 2000;
const STEP = 32;
/** A strip narrower than twice this counts as a sliver. */
const SLIVER_HALF_WIDTH = 6;

const sampleGrid = (seed: string) => {
  const biomeAt = createBiomeAt(seed);
  const samples: {
    biome: Biome;
    neighbour: Biome;
    left: Biome;
    right: Biome;
  }[] = [];
  for (let x = -EXTENT; x < EXTENT; x += STEP) {
    for (let y = -EXTENT; y < EXTENT; y += STEP) {
      samples.push({
        biome: biomeAt(x, y),
        neighbour: biomeAt(x + 1, y),
        left: biomeAt(x - SLIVER_HALF_WIDTH, y),
        right: biomeAt(x + SLIVER_HALF_WIDTH, y),
      });
    }
  }
  return samples;
};

describe("createBiomeAt", () => {
  it("is deterministic for the same seed", () => {
    const a = createBiomeAt("seed");
    const b = createBiomeAt("seed");

    for (let i = 0; i < 200; i++) {
      expect(a(i * 37, -i * 53)).toBe(b(i * 37, -i * 53));
    }
  });

  it("differs between seeds", () => {
    const probe = (seed: string) => {
      const biomeAt = createBiomeAt(seed);
      return Array.from({ length: 1000 }, (_, i) =>
        biomeAt((i * 7919) % 4000, (i * 104729) % 4000)
      );
    };

    expect(probe("seed-a")).not.toEqual(probe("seed-b"));
  });

  it.each(["a", "b", "colony"])(
    "gives every biome a meaningful share of the world (seed %s)",
    seed => {
      const samples = sampleGrid(seed);
      const share = (biome: Biome) =>
        samples.filter(s => s.biome === biome).length / samples.length;

      expect(share("grass")).toBeGreaterThan(0.1);
      expect(share("desert")).toBeGreaterThan(0.1);
      expect(share("swamp")).toBeGreaterThan(0.1);
      expect(share("jungle")).toBeGreaterThan(0.1);
    }
  );

  it.each(["a", "b", "colony"])(
    "forms contiguous blobs rather than noise (seed %s)",
    seed => {
      const samples = sampleGrid(seed);
      const same = samples.filter(s => s.biome === s.neighbour).length;

      expect(same / samples.length).toBeGreaterThan(0.99);
    }
  );

  it.each(["a", "b", "colony"])(
    "has no narrow slivers of one biome inside another (seed %s)",
    seed => {
      const samples = sampleGrid(seed);
      const slivers = samples.filter(
        s => s.left === s.right && s.left !== s.biome
      );

      expect(slivers.length / samples.length).toBeLessThan(0.001);
    }
  );
});
