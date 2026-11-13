import type { Tile } from "@colony-builder/shared";
import alea from "alea";
import { tuple } from "niall-utils/core";
import { memoize, typedToEntries } from "niall-utils/data";
import { Vector } from "vectyped";

import { fbm, seededNoise, type FbmOptions } from "./noise.ts";

interface BiomeDef {
  centre: [moisture: number, fertility: number];
  tile: Tile;
}

const BIOMES = {
  grass: { centre: [-0.2, 0.25], tile: "grass" },
  desert: { centre: [-0.2, -0.25], tile: "sand" },
  swamp: { centre: [0.2, -0.25], tile: "swampland" },
  jungle: { centre: [0.2, 0.25], tile: "jungle" },
} satisfies Record<string, BiomeDef>;

export type Biome = keyof typeof BIOMES;

export const biomeTile = (biome: Biome): Tile => BIOMES[biome].tile;

const biomeCentres = typedToEntries(BIOMES);

/**
 * The world is cut into jittered grid cells, each with one centre point, and
 * every tile belongs to its nearest centre (a Voronoi diagram). A cell's biome
 * comes from the climate at its centre, so neighbouring cells often share a
 * biome and merge into bigger regions. Cells are convex and roughly round, so
 * biomes are compact and can never form thin slivers.
 */

const BIOME_CELL_SIZE = 150;

const CLIMATE: FbmOptions = {
  scale: 0.0025,
  octaves: 2,
  lacunarity: 2,
  persistence: 0.5,
};

const WARP_STRENGTH = 10;
const WARP: FbmOptions = {
  scale: 0.012,
  octaves: 4,
  lacunarity: 2,
  persistence: 0.7,
};

const MAX_CACHED_CELLS = 4096;

interface Site {
  centre: [number, number];
  biome: Biome;
}

const OFFSETS = [-2, -1, 0, 1, 2];
const NEIGHBOURS = OFFSETS.flatMap(dy => OFFSETS.map(dx => tuple(dx, dy)));

const nearestBiome = (moisture: number, fertility: number): Biome => {
  const climate = Vector.create(moisture, fertility);
  return biomeCentres.reduce((best, entry) =>
    climate.sqrDistTo(entry[1].centre) < climate.sqrDistTo(best[1].centre)
      ? entry
      : best
  )[0];
};

export const createBiomeAt = (
  seed: string
): ((x: number, y: number) => Biome) => {
  const warpX = seededNoise(seed, "warp-x");
  const warpY = seededNoise(seed, "warp-y");
  const moisture = seededNoise(seed, "moisture");
  const fertility = seededNoise(seed, "fertility");

  const cellCentre = (cx: number, cy: number): [number, number] => {
    const random = alea(`${seed}:cell:${cx},${cy}`);
    return tuple(
      (cx + random()) * BIOME_CELL_SIZE,
      (cy + random()) * BIOME_CELL_SIZE
    );
  };

  const neighbourhood = memoize(
    (cx: number, cy: number): Site[] =>
      NEIGHBOURS.map(([dx, dy]) => {
        const centre = cellCentre(cx + dx, cy + dy);
        return {
          centre,
          biome: nearestBiome(
            fbm(moisture, ...centre, CLIMATE),
            fbm(fertility, ...centre, CLIMATE)
          ),
        };
      }),
    (cx, cy) => `${cx},${cy}`,
    MAX_CACHED_CELLS
  );

  return (x, y) => {
    const wx = x + fbm(warpX, x, y, WARP) * WARP_STRENGTH;
    const wy = y + fbm(warpY, x, y, WARP) * WARP_STRENGTH;
    const point = Vector.create(wx, wy);

    return neighbourhood(
      Math.floor(wx / BIOME_CELL_SIZE),
      Math.floor(wy / BIOME_CELL_SIZE)
    ).reduce((best, site) =>
      point.sqrDistTo(site.centre) < point.sqrDistTo(best.centre) ? site : best
    ).biome;
  };
};
