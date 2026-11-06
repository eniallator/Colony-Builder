import type { ReadonlyNonEmptyArray } from "niall-utils/core";

import { encOneOf, type EncodableType } from "../protocol/encodable.ts";

export const itemDataRegistry = {
  iron_ore: {
    label: "Iron Ore",
    color: "#8fa3b8",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 15l3.5-8L13 3l6 4.5 2 7.5-5.5 6H8z"/></svg>',
  },
  log: {
    label: "Log",
    color: "#b07840",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
  },
} as const satisfies Record<
  string,
  { label: string; color: string; icon: string; data?: unknown }
>;

export const encItemId = encOneOf(
  Object.keys(itemDataRegistry) as unknown as ReadonlyNonEmptyArray<
    keyof typeof itemDataRegistry
  >
);
export type ItemId = EncodableType<typeof encItemId>;
