import {
  REGION_SIDE_LENGTH,
  regionIdToPos,
  regionToWorldPos,
  relativePosToSubRegionPos,
  subRegionPosToId,
  type CreateWorldGenerator,
  type RegionId,
  type RegionStructures,
  type StructureData,
  type Tile,
} from "@colony-builder/shared";
import alea from "alea";

import { biomeTile, createBiomeAt, type Biome } from "./biome.ts";
import { fbm, seededNoise, type FbmOptions } from "./noise.ts";
import { createStoneAt } from "./stone.ts";

const WATER: FbmOptions = {
  scale: 0.015,
  octaves: 2,
  lacunarity: 2,
  persistence: 0.5,
};

const WATER_LEVEL = -0.6;

/** What a biome grows, and the chance per land tile that it does. */
const BIOME_STRUCTURES: Partial<
  Record<Biome, { structure: StructureData; chance: number }>
> = {
  plains: { structure: { id: "tree", data: true }, chance: 0.005 },
  desert: { structure: { id: "cactus", data: true }, chance: 0.02 },
};

/** The tiles each kind of structure can grow on. */
const GROWS_ON: Record<StructureData["id"], Tile[]> = {
  tree: ["grass", "swampland", "jungle"],
  cactus: ["sand"],
};

/** A generated tile, with the biome it belongs to for later passes. */
interface TerrainCell {
  tile: Tile;
  biome: Biome;
}

const idxToDeltaXY = (idx: number): [x: number, y: number] => [
  idx % REGION_SIDE_LENGTH,
  Math.floor(idx / REGION_SIDE_LENGTH),
];

/** Generates a region's tiles, each with the biome it belongs to. */
const generateTerrain = (
  id: RegionId,
  terrainAt: (x: number, y: number) => TerrainCell
): TerrainCell[] => {
  const [originX, originY] = regionToWorldPos(...regionIdToPos(id));
  return Array.from({ length: REGION_SIDE_LENGTH ** 2 }, (_, idx) => {
    const [dx, dy] = idxToDeltaXY(idx);
    return terrainAt(originX + dx, originY + dy);
  });
};

/** Grows structures on a region's land, according to each tile's biome. */
const generateStructures = (
  seed: string,
  id: RegionId,
  terrain: TerrainCell[]
): RegionStructures => {
  const [regionX, regionY] = regionIdToPos(id);
  const random = alea(`${seed}:structures:${regionX},${regionY}`);
  const structures: RegionStructures = new Map();

  terrain.forEach(({ tile, biome }, idx) => {
    // Always draw, so one tile changing never shifts the others' structures.
    const [roll, offsetX, offsetY] = [random(), random(), random()];
    const growth = BIOME_STRUCTURES[biome];
    if (growth == null || roll >= growth.chance) return;
    // Only on tiles it can grow on, so never on water, stone or ore.
    if (!GROWS_ON[growth.structure.id].includes(tile)) return;

    const [dx, dy] = idxToDeltaXY(idx);
    structures.set(
      subRegionPosToId(
        ...relativePosToSubRegionPos(dx + offsetX, dy + offsetY)
      ),
      growth.structure
    );
  });

  return structures;
};

export const createWorldGenerator: CreateWorldGenerator = seed => {
  const waterNoise = seededNoise(seed, "water");
  const biomeAt = createBiomeAt(seed);
  const stoneAt = createStoneAt(seed);

  const terrainAt = (x: number, y: number): TerrainCell => {
    const biome = biomeAt(x, y);
    const isLand = fbm(waterNoise, x, y, WATER) >= WATER_LEVEL;
    return {
      biome,
      tile: isLand ? (stoneAt(x, y) ?? biomeTile(biome)) : "water",
    };
  };

  return id => {
    const terrain = generateTerrain(id, terrainAt);
    return {
      tiles: terrain.map(({ tile }) => tile),
      structures: generateStructures(seed, id, terrain),
    };
  };
};
