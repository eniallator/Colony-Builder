import type { CreateTerrainGenerator } from "@colony-builder/shared";

import { biomeTile, createBiomeAt } from "./biome.ts";
import { fbm, seededNoise, type FbmOptions } from "./noise.ts";
import { createStoneAt } from "./stone.ts";

const WATER: FbmOptions = {
  scale: 0.015,
  octaves: 2,
  lacunarity: 2,
  persistence: 0.5,
};

const WATER_LEVEL = -0.6;

export const createTerrainGenerator: CreateTerrainGenerator = seed => {
  const waterNoise = seededNoise(seed, "water");
  const biomeAt = createBiomeAt(seed);
  const stoneAt = createStoneAt(seed);

  return (x, y) =>
    fbm(waterNoise, x, y, WATER) >= WATER_LEVEL
      ? (stoneAt(x, y) ?? biomeTile(biomeAt(x, y)))
      : "water";
};
