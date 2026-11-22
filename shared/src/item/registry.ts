import { encOneOf, type EncodableType } from "../encoding/index.ts";

export const itemDataRegistry = {
  iron_ore: { label: "Iron Ore" },
  copper_ore: { label: "Copper Ore" },
  log: { label: "Log" },
  cactus: { label: "Cactus" },
} as const satisfies Record<string, { label: string; data?: unknown }>;

type RegistryItemId = keyof typeof itemDataRegistry;

export const itemIds = Object.keys(itemDataRegistry) as unknown as readonly [
  RegistryItemId,
  RegistryItemId,
  ...RegistryItemId[],
];

export const encItemId = encOneOf(itemIds);
export type ItemId = EncodableType<typeof encItemId>;
