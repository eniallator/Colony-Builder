import { tuple, type Tagged } from "niall-utils/core";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import {
  codI32,
  encArrayOf,
  encodable,
  encOneOf,
  type Codec,
  type EncodableType,
} from "../encoding/index.ts";

/** Two i32 region coordinates packed into one u64: `x` in the high 32 bits, `y` in the low 32. */
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
  x: number,
  y: number
): [x: number, y: number] => [
  Math.floor(x / REGION_SIDE_LENGTH),
  Math.floor(y / REGION_SIDE_LENGTH),
];

export const regionToWorldPos = (
  x: number,
  y: number
): [x: number, y: number] => [x * REGION_SIDE_LENGTH, y * REGION_SIDE_LENGTH];

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

const codRegionId: Codec<RegionId> = {
  size: () => 2 * codI32.size(0),
  write: (cursor, id) => {
    const [x, y] = regionIdToPos(id);
    codI32.write(cursor, x);
    codI32.write(cursor, y);
  },
  read: cursor => regionPosToId(codI32.read(cursor), codI32.read(cursor)),
};

export const encRegionId = encodable<RegionId>(
  (value): value is RegionId =>
    typeof value === "bigint" && value >= 0n && value < U64_LIMIT,
  codRegionId
);

export const tiles = tuple(
  "grass",
  "swampland",
  "jungle",
  "water",
  "sand",
  "stone",
  "iron_deposit",
  "conveyor_up",
  "conveyor_down",
  "conveyor_left",
  "conveyor_right"
);
export type Tile = (typeof tiles)[number];
export const encTile = encOneOf(tiles);

export type TerrainGenerator = (x: number, y: number) => Tile;
export type CreateTerrainGenerator = (seed: string) => TerrainGenerator;

export const encRegionTiles = encArrayOf(encTile, {
  fixedLength: REGION_SIDE_LENGTH ** 2,
});
export type RegionTiles = EncodableType<typeof encRegionTiles>;
