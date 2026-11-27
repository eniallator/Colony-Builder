import { tuple, type Tagged } from "niall-utils/core";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import {
  encArrayOf,
  encNumber,
  encTagged,
  type EncodableType,
} from "../../encoding/index.ts";

export const tiles = tuple(
  "grass",
  "swampland",
  "jungle",
  "water",
  "sand",
  "stone",
  "iron_deposit",
  "copper_deposit"
);
export type Tile = (typeof tiles)[number];
export type TileId = Tagged<number, "TileId">;

export const encTileId = encTagged<TileId>(
  encNumber("uChoose", tiles.length - 1)
);

export const tileToId = (tile: Tile): TileId => tiles.indexOf(tile) as TileId;
export const idToTile = (id: TileId): Tile => tiles[id] as Tile;

export const encRegionTiles = encArrayOf(encTileId, {
  fixedLength: REGION_SIDE_LENGTH ** 2,
});
export type RegionTiles = EncodableType<typeof encRegionTiles>;
