import { isNumber } from "deep-guards";

import {
  binaryEncodable,
  codF32,
  encArrayOf,
  encBoolean,
  encExact,
  encObjectOf,
  encOptional,
  encUnionOf,
  encVec2,
  type EncodableWritableType,
} from "../encoding/index.ts";
import { encRegionId, encSubRegionId } from "../world/region.ts";

// The time (see `Time`) the task finishes at, set once the entity starts it.
// An end time, not a counter, so a task being worked on isn't resent each tick.
const encEndsAt = encOptional(
  binaryEncodable(
    (value): value is number => isNumber(value) && value >= 0,
    codF32
  )
);

export const encGatherTile = encObjectOf({
  type: encExact("gatherTile"),
  target: encVec2,
  endsAt: encEndsAt,
});
export type GatherTile = EncodableWritableType<typeof encGatherTile>;

export const encGatherStructure = encObjectOf({
  type: encExact("gatherStructure"),
  regionId: encRegionId,
  subRegionId: encSubRegionId,
  endsAt: encEndsAt,
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
