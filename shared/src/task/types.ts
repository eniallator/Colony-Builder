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

export const encGatherResource = encObjectOf({
  type: encExact("gatherResource"),
  target: encVec2,
  progress: binaryEncodable(
    (value): value is number => isNumber(value) && value >= 0,
    codF16
  ),
});
export type GatherResource = EncodableWritableType<typeof encGatherResource>;

export const encDropInventory = encObjectOf({
  type: encExact("dropInventory"),
  target: encVec2,
});
export type DropInventory = EncodableWritableType<typeof encDropInventory>;

export const encTask = encUnionOf(encGatherResource, encDropInventory);
export type Task = EncodableWritableType<typeof encTask>;

export const encTaskList = encObjectOf({
  tasks: encArrayOf(encTask),
  repeat: encBoolean,
});
export type TaskList = EncodableWritableType<typeof encTaskList>;
