import type { ReadonlyNonEmptyArray } from "niall-utils/core";

import { encOneOf, type EncodableType } from "../encoding/index.ts";

export const itemDataRegistry = {
  iron_ore: { label: "Iron Ore" },
  copper_ore: { label: "Copper Ore" },
  log: { label: "Log" },
} as const satisfies Record<string, { label: string; data?: unknown }>;

export const encItemId = encOneOf(
  Object.keys(itemDataRegistry) as unknown as ReadonlyNonEmptyArray<
    keyof typeof itemDataRegistry
  >
);
export type ItemId = EncodableType<typeof encItemId>;
