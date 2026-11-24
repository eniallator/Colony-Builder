import { isInteger } from "deep-guards";
import { mapObject } from "niall-utils";

import {
  binaryEncodable,
  codU32,
  encExact,
  encObjectOf,
  encOneOf,
  encOptional,
  encUnionOf,
  type BinaryEncodable,
  type EncodableType,
} from "../encoding/index.ts";

export const itemRegistry = {
  iron_ore: encExact(false),
  copper_ore: encExact(false),
  log: encExact(false),
  cactus: encExact(false),
} as const satisfies Record<string, BinaryEncodable>;
type ItemRegistry = typeof itemRegistry;
export type ItemData<Id extends keyof ItemRegistry> = EncodableType<
  ItemRegistry[Id]
>;

type RegistryItemId = keyof typeof itemRegistry;

export const itemIds = Object.keys(itemRegistry) as unknown as readonly [
  RegistryItemId,
  RegistryItemId,
  ...RegistryItemId[],
];

export const encItemId = encOneOf(itemIds);
export type ItemId = EncodableType<typeof encItemId>;

const encCount = binaryEncodable(
  (value): value is number => isInteger(value) && value >= 0,
  codU32
);

export const encItem = encUnionOf<
  { [Id in ItemId]: { id: Id; count: number; data: ItemData<Id> } }[ItemId][]
>(
  ...itemIds.map(id =>
    encObjectOf({ id: encExact(id), count: encCount, data: itemRegistry[id] })
  )
);
export type Item = EncodableType<typeof encItem>;

export type Inventory = {
  [Id in ItemId]?: Omit<Extract<Item, { id: Id }>, "id">;
};
export const encInventory = encObjectOf<Inventory>(
  mapObject(itemRegistry, ([key, encData]) => [
    key,
    encOptional(encObjectOf({ count: encCount, data: encData })),
  ])
);
