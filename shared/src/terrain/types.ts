import { isString } from "deep-guards";
import { tuple, unsafeTag, type Tagged } from "niall-utils/core";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import { codI32, codTagged, type Codec } from "../protocol/codec.ts";
import { encodable, encOneOf } from "../protocol/encodable.ts";

export type RegionId = Tagged<`${number},${number}`, "RegionId">;
export const unsafeRegionId = unsafeTag<RegionId>();

export const regionIdToPos = (id: RegionId): [x: number, y: number] =>
  id.split(",").map(Number) as [number, number];

export const regionPosToId = (x: number, y: number): RegionId =>
  unsafeRegionId(`${x},${y}`);

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

const codNumberPair: Codec<`${number},${number}`> = {
  size: () => 2 * codI32.size(0),
  write: (cursor, value) => {
    const [x, y] = value.split(",").map(Number) as [number, number];
    codI32.write(cursor, x);
    codI32.write(cursor, y);
  },
  read: cursor =>
    unsafeRegionId(`${codI32.read(cursor)},${codI32.read(cursor)}`),
};

const numberPairRegex = /^(0|-?[1-9]\d*),(0|-?[1-9]\d*)$/;

export const encRegionId = encodable<RegionId>(
  (value): value is RegionId => isString(value) && numberPairRegex.test(value),
  codTagged(codNumberPair)
);

export const tiles = tuple("grass", "dirt", "water", "sand", "stone");
export type Tile = (typeof tiles)[number];
export const encTile = encOneOf(tiles);
