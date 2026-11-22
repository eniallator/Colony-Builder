import { isInteger } from "deep-guards";
import { tuple, type Tagged } from "niall-utils/core";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import {
  binaryEncodable,
  chooseUIntCod,
  codTagged,
  encArrayOf,
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

export const encTileId = binaryEncodable<TileId>(
  (value): value is TileId =>
    isInteger(value) && value >= 0 && value < tiles.length,
  codTagged(chooseUIntCod(tiles.length))
);

export const tileToId = (tile: Tile): TileId => tiles.indexOf(tile) as TileId;
export const idToTile = (id: TileId): Tile => tiles[id] as Tile;

export const encRegionTiles = encArrayOf(encTileId, {
  fixedLength: REGION_SIDE_LENGTH ** 2,
});
export type RegionTiles = EncodableType<typeof encRegionTiles>;
