import { encMapOf, type EncodableType } from "../encoding/index.ts";
import { encComponents, encEntityId } from "../entity/index.ts";
import { encRegionId, encRegionTiles } from "../terrain/index.ts";

export const encEntitySnapshot = encMapOf(encEntityId, encComponents);
export type EntitySnapshot = EncodableType<typeof encEntitySnapshot>;

export const encTerrainSnapshot = encMapOf(encRegionId, encRegionTiles);
export type TerrainSnapshot = EncodableType<typeof encTerrainSnapshot>;
