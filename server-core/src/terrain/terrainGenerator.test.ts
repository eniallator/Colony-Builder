import type { Tile } from "@colony-builder/shared";
import { describe, expect, it } from "vitest";

import { biomeTile, createBiomeAt, type Biome } from "./biome.ts";
import { createTerrainGenerator } from "./terrainGenerator.ts";

const BIOMES: Biome[] = ["grass", "desert", "swamp", "jungle"];
/** Tiles that replace a biome's land tile. */
const OVERLAYS: Tile[] = ["water", "stone", "iron_deposit"];
const EXTENT = 1000;
const STEP = 16;

const sampleGrid = (seed: string) => {
  const generator = createTerrainGenerator(seed);
  const biomeAt = createBiomeAt(seed);
  const samples: { tile: Tile; biome: Biome }[] = [];
  for (let x = -EXTENT; x < EXTENT; x += STEP) {
    for (let y = -EXTENT; y < EXTENT; y += STEP) {
      samples.push({ tile: generator(x, y), biome: biomeAt(x, y) });
    }
  }
  return samples;
};

describe("createTerrainGenerator", () => {
  it("is deterministic for the same seed", () => {
    const a = createTerrainGenerator("seed");
    const b = createTerrainGenerator("seed");

    for (let i = 0; i < 500; i++) {
      expect(a(i * 31, -i * 17)).toBe(b(i * 31, -i * 17));
    }
  });

  it("differs between seeds", () => {
    const probe = (seed: string) => {
      const generator = createTerrainGenerator(seed);
      return Array.from({ length: 1000 }, (_, i) =>
        generator((i * 7919) % 4000, (i * 104729) % 4000)
      );
    };

    expect(probe("seed-a")).not.toEqual(probe("seed-b"));
  });

  it("produces only water, stone, ore and the biomes' land tiles", () => {
    const allowed: Tile[] = [
      ...BIOMES.map(biomeTile),
      "water",
      "stone",
      "iron_deposit",
    ];

    for (const { tile } of sampleGrid("seed")) expect(allowed).toContain(tile);
  });

  it("uses the biome's land tile wherever there is no water or stone", () => {
    for (const { tile, biome } of sampleGrid("seed")) {
      if (!OVERLAYS.includes(tile)) expect(tile).toBe(biomeTile(biome));
    }
  });

  it("places stone shards with iron ore at their centres on land", () => {
    const generator = createTerrainGenerator("seed");
    const tiles = new Set<Tile>();
    for (let x = -150; x < 150; x++) {
      for (let y = -150; y < 150; y++) tiles.add(generator(x, y));
    }

    expect(tiles).toContain("stone");
    expect(tiles).toContain("iron_deposit");
  });

  it("has both water and land in every biome", () => {
    const samples = sampleGrid("seed");

    for (const biome of BIOMES) {
      expect(samples.some(s => s.biome === biome && s.tile === "water")).toBe(
        true
      );
      expect(
        samples.some(s => s.biome === biome && s.tile === biomeTile(biome))
      ).toBe(true);
    }
  });
});
