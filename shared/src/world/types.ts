import {
  encMapOf,
  encObjectOf,
  type EncodableType,
} from "../encoding/encodable.ts";
import {
  encRegionStructures,
  type RegionStructures,
} from "./structure/types.ts";
import {
  encRegionId,
  encRegionTiles,
  type RegionId,
  type RegionTiles,
} from "./terrain/types.ts";

export type WorldGenerator = (regionId: RegionId) => {
  tiles: RegionTiles;
  structures: RegionStructures;
};

export const encWorldSnapshot = encMapOf(
  encRegionId,
  encObjectOf({ tiles: encRegionTiles, structures: encRegionStructures })
);
export type WorldSnapshot = EncodableType<typeof encWorldSnapshot>;
