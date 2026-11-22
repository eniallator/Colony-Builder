import {
  encMapOf,
  encObjectOf,
  type EncodableType,
} from "../encoding/binary/encodable.ts";
import { encRegionId, type RegionId } from "./region.ts";
import {
  encRegionStructures,
  type RegionStructures,
} from "./structure/types.ts";
import { encRegionTiles, type RegionTiles } from "./terrain/types.ts";

export type WorldGenerator = (regionId: RegionId) => {
  tiles: RegionTiles;
  structures: RegionStructures;
};

export const encWorldSnapshot = encMapOf(
  encRegionId,
  encObjectOf({ tiles: encRegionTiles, structures: encRegionStructures })
);
export type WorldSnapshot = EncodableType<typeof encWorldSnapshot>;
