import { REGION_SIDE_LENGTH } from "../../constants.ts";
import {
  encAdapt,
  encExact,
  encMapOf,
  encNumber,
  encObjectOf,
  encRegistryValues,
  isIntegerIn,
  type BinaryEncodable,
  type EncodableType,
} from "../../encoding/index.ts";
import { encFacing } from "../../facing.ts";
import { encSubRegionId } from "../region.ts";

// Belt lengths count steps the size of a `SubRegionId` step, so a belt can end
// anywhere a structure can sit. A segment never leaves its region.
const MAX_LENGTH = REGION_SIDE_LENGTH ** 2;

// A belt is at least one step long, so it is stored as its length minus one.
export const encConveyorLength = encAdapt(
  encNumber("uChoose", MAX_LENGTH - 1),
  isIntegerIn(1, MAX_LENGTH),
  stored => stored + 1,
  length => length - 1
);

export const encConveyor = encObjectOf({
  facing: encFacing,
  length: encConveyorLength,
});
export type ConveyorData = EncodableType<typeof encConveyor>;

export const structureRegistry = {
  cactus: encExact(true),
  conveyor: encConveyor,
  tree: encExact(true),
  mushroom: encExact(true),
  fern: encExact(true),
} as const satisfies Record<string, BinaryEncodable>;

export const encStructureData = encRegistryValues(structureRegistry);
export type StructureData = EncodableType<typeof encStructureData>;

export type StructureType = StructureData["type"];

export type StructureDataByType = {
  [T in StructureType]: Extract<StructureData, { type: T }>["data"];
};

export type StructureOf<T extends StructureType> = StructureData & {
  type: T;
  data: StructureDataByType[T];
};

export const isStructureOfType = <T extends StructureType>(
  structure: StructureData,
  type: T
): structure is StructureOf<T> => structure.type === type;

export const encRegionStructures = encMapOf(encSubRegionId, encStructureData);
export type RegionStructures = EncodableType<typeof encRegionStructures>;

export type Structure = StructureData & { worldPos: [x: number, y: number] };
