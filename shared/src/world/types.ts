import type { RegionStructures } from "./structure/types.ts";
import type { RegionId, RegionTiles } from "./terrain/types.ts";

export type WorldGenerator = (regionId: RegionId) => {
  tiles: RegionTiles;
  structures: RegionStructures;
};
export type CreateWorldGenerator = (seed: string) => WorldGenerator;
