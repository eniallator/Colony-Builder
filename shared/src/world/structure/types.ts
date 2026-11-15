import { isInteger } from "deep-guards";
import { positiveMod } from "niall-utils";
import type { Tagged } from "niall-utils/core";

import { REGION_SIDE_LENGTH } from "../../constants.ts";
import {
  codU16,
  encExact,
  encMapOf,
  encodable,
  encRegistryValues,
  U16_MAX,
  type Codec,
  type Encodable,
  type EncodableType,
} from "../../encoding/index.ts";
import {
  encRegionId,
  regionIdToPos,
  regionPosToId,
  regionToWorldPos,
  worldToRegionPos,
  type RegionId,
} from "../terrain/index.ts";

export const structureRegistry = {
  cactus: encExact(true),
  tree: encExact(true),
} as const satisfies Record<string, Encodable>;

export const encStructureData = encRegistryValues(structureRegistry);
export type StructureData = EncodableType<typeof encStructureData>;

export type SubRegionId = Tagged<number, "RegionPos">;
export const encSubRegionId = encodable(
  (value): value is SubRegionId =>
    isInteger(value) && value >= 0 && value < U16_MAX,
  codU16 as Codec<SubRegionId>
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

export const encRegionStructures = encMapOf(encSubRegionId, encStructureData);
export type RegionStructures = EncodableType<typeof encRegionStructures>;

export type Structure = StructureData & { worldPos: [x: number, y: number] };

export const encStructureSnapshot = encMapOf(encRegionId, encRegionStructures);
export type StructureSnapshot = EncodableType<typeof encStructureSnapshot>;
