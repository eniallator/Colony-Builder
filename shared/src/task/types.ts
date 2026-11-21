import { isNumber } from "deep-guards";

import {
  binaryEncodable,
  codF16,
  encArrayOf,
  encBoolean,
  encExact,
  encObjectOf,
  encUnionOf,
  encVec2,
  type EncodableWritableType,
} from "../encoding/index.ts";
import { encSubRegionId } from "../world/structure/types.ts";
import { encRegionId } from "../world/terrain/types.ts";

export const encGatherTile = encObjectOf({
  type: encExact("gatherTile"),
  target: encVec2,
  progress: binaryEncodable(
    (value): value is number => isNumber(value) && value >= 0,
    codF16
  ),
});
export type GatherTile = EncodableWritableType<typeof encGatherTile>;

export const encGatherStructure = encObjectOf({
  type: encExact("gatherStructure"),
  regionId: encRegionId,
  subRegionId: encSubRegionId,
  progress: binaryEncodable(
    (value): value is number => isNumber(value) && value >= 0,
    codF16
  ),
});
export type GatherStructure = EncodableWritableType<typeof encGatherStructure>;

export const encDropInventory = encObjectOf({
  type: encExact("dropInventory"),
  target: encVec2,
});
export type DropInventory = EncodableWritableType<typeof encDropInventory>;

export const encTask = encUnionOf(
  encGatherTile,
  encGatherStructure,
  encDropInventory
);
export type Task = EncodableWritableType<typeof encTask>;

export const encTaskList = encObjectOf({
  tasks: encArrayOf(encTask),
  repeat: encBoolean,
});
export type TaskList = EncodableWritableType<typeof encTaskList>;
