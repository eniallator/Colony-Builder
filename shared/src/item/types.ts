import { isExactObjectOf, isInteger, isOptional, isUnknown } from "deep-guards";
import { tuple } from "niall-utils/core";

import {
  codObjectOf,
  codOptional,
  codU32,
  encMapOf,
  encodable,
  type EncodableType,
} from "../encoding/index.ts";
import { encItemId } from "./registry.ts";

export const itemTags = tuple("");
export type ItemTag = (typeof itemTags)[number];

export const encItem = encodable(
  isExactObjectOf({
    data: isOptional(isUnknown),
    count: (value): value is number => isInteger(value) && value >= 0,
  }),
  codObjectOf({
    data: codOptional({
      size: () => 0,
      write: () => undefined,
      read: () => undefined,
    }),
    count: codU32,
  })
);
export type Item = EncodableType<typeof encItem>;

export const encInventory = encMapOf(encItemId, encItem);
export type Inventory = EncodableType<typeof encInventory>;
