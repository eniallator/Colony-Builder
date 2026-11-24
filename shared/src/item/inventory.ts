import { typedToEntries } from "niall-utils";
import { Vector } from "vectyped";

import { createItem, type World } from "../world/index.ts";
import type { Inventory, Item } from "./types.ts";

export const addItemToInventory = (inventory: Inventory, item: Item) => {
  const { id, ...value } = item;
  const existing = inventory[id];

  if (existing != null) existing.count += item.count;
  else inventory[id] = value;
};

export const mergeInventories = (
  from: Inventory,
  to: Inventory
): Inventory | null => {
  for (const [id, value] of typedToEntries(from)) {
    addItemToInventory(to, { id, ...value } as Item);
  }

  return null;
};

export const dropInventory = (
  inventory: Inventory,
  position: Vector<2>,
  world: World,
  jitterRadius: number = 0.4
): void => {
  for (const [id, value] of typedToEntries(inventory)) {
    const dropPos = Vector.create(Math.random(), Math.random())
      .multiply(jitterRadius)
      .add(position);
    createItem(world, { id, ...value } as Item, dropPos);
    inventory[id] = undefined;
  }
};
