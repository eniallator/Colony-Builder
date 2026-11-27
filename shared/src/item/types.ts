import { mapObject } from "niall-utils";

import {
  encExact,
  encNumber,
  encObjectOf,
  encOneOf,
  encOptional,
  encUnionOf,
  type BinaryEncodable,
  type EncodableType,
} from "../encoding/index.ts";

export const itemRegistry = {
  iron_ore: encExact(true),
  copper_ore: encExact(true),
  log: encExact(true),
  cactus: encExact(true),
  mushroom: encExact(true),
  fibre: encExact(true),
  robot: encExact(true),
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

const encCount = encNumber("u32");

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
