import { isInteger } from "deep-guards";
import { tuple, type Tagged } from "niall-utils/core";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import {
  binaryEncodable,
  chooseUIntCod,
  codI32,
  codMap,
  codTagged,
  codTupleOf,
  encArrayOf,
  type EncodableType,
} from "../../encoding/index.ts";

// Two i32 region coordinates packed into one u64: `x` in the high 32 bits, `y` in the low 32.
export type RegionId = Tagged<bigint, "RegionId">;

const I32_BITS = 32;
const U64_LIMIT = 1n << 64n;

export const regionIdToPos = (id: RegionId): [x: number, y: number] => [
  Number(BigInt.asIntN(I32_BITS, id >> BigInt(I32_BITS))),
  Number(BigInt.asIntN(I32_BITS, id)),
];

export const regionPosToId = (x: number, y: number): RegionId =>
  ((BigInt.asUintN(I32_BITS, BigInt(x)) << BigInt(I32_BITS)) |
    BigInt.asUintN(I32_BITS, BigInt(y))) as RegionId;

export const worldToRegionPos = (
  worldX: number,
  worldY: number
): [regionX: number, regionY: number] => [
  Math.floor(worldX / REGION_SIDE_LENGTH),
  Math.floor(worldY / REGION_SIDE_LENGTH),
];

export const regionToWorldPos = (
  regionX: number,
  regionY: number
): [worldX: number, worldY: number] => [
  regionX * REGION_SIDE_LENGTH,
  regionY * REGION_SIDE_LENGTH,
];

export const regionsAround = (
  centerX: number,
  centerY: number,
  sideLength: number
): RegionId[] =>
  Array.from({ length: sideLength ** 2 }, (_, i) =>
    regionPosToId(
      Math.floor(centerX - sideLength / 2 + Math.floor(i / sideLength)),
      Math.floor(centerY - sideLength / 2 + (i % sideLength))
    )
  );

export const encRegionId = binaryEncodable<RegionId>(
  (value): value is RegionId =>
    typeof value === "bigint" && value >= 0n && value < U64_LIMIT,
  codMap(codTupleOf(codI32, codI32), regionIdToPos, ([x, y]) =>
    regionPosToId(x, y)
  )
);

export const tiles = tuple(
  "grass",
  "swampland",
  "jungle",
  "water",
  "sand",
  "stone",
  "iron_deposit",
  "copper_deposit",
  "conveyor_up",
  "conveyor_down",
  "conveyor_left",
  "conveyor_right"
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
