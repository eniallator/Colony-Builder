import { isInteger } from "deep-guards";
import type { Tagged } from "niall-utils/core";
import { positiveMod } from "niall-utils/math";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import {
  binaryEncodable,
  codI32,
  codMap,
  codTupleOf,
  codU16,
  U16_MAX,
  type BinaryCodec,
} from "../encoding/index.ts";

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

export type SubRegionId = Tagged<number, "RegionPos">;
export const encSubRegionId = binaryEncodable(
  (value): value is SubRegionId =>
    isInteger(value) && value >= 0 && value < U16_MAX,
  codU16 as BinaryCodec<SubRegionId>
);

export const subRegionIdToPos = (id: SubRegionId): [x: number, y: number] => [
  (id >> 8) & 0xff,
  id & 0xff,
];

export const subRegionPosToId = (x: number, y: number): SubRegionId =>
  ((x << 8) | y) as SubRegionId;

export const subRegionPosToRelativePos = (
  subRegionX: number,
  subRegionY: number
): [relativeX: number, relativeY: number] => [
  subRegionX / REGION_SIDE_LENGTH,
  subRegionY / REGION_SIDE_LENGTH,
];

export const relativePosToSubRegionPos = (
  relativeX: number,
  relativeY: number
): [subRegionX: number, subRegionY: number] => [
  Math.floor(relativeX * REGION_SIDE_LENGTH),
  Math.floor(relativeY * REGION_SIDE_LENGTH),
];

export const worldPosToRegionIds = (
  worldX: number,
  worldY: number
): [RegionId, SubRegionId] => [
  regionPosToId(...worldToRegionPos(worldX, worldY)),
  subRegionPosToId(
    ...relativePosToSubRegionPos(
      positiveMod(worldX, REGION_SIDE_LENGTH),
      positiveMod(worldY, REGION_SIDE_LENGTH)
    )
  ),
];

export const regionIdsToWorldPos = (
  reg: RegionId,
  sub: SubRegionId
): [worldX: number, worldY: number] => {
  const [regionX, regionY] = regionToWorldPos(...regionIdToPos(reg));
  const [relX, relY] = subRegionPosToRelativePos(...subRegionIdToPos(sub));
  return [regionX + relX, regionY + relY];
};
