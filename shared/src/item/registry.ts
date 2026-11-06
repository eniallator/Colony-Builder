import type { ReadonlyNonEmptyArray } from "niall-utils/core";

import { encOneOf, type EncodableType } from "../protocol/encodable.ts";

export const itemDataRegistry = {
  iron_ore: { label: "Iron Ore" },
  log: { label: "Log" },
} as const satisfies Record<string, { label: string; data?: unknown }>;

export const encItemId = encOneOf(
  Object.keys(itemDataRegistry) as unknown as ReadonlyNonEmptyArray<
    keyof typeof itemDataRegistry
  >
);
export type ItemId = EncodableType<typeof encItemId>;
