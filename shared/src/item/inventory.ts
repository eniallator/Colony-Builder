import { Vector } from "vectyped";

import { createItem } from "../entity/item.ts";
import type { World } from "../stores/world.ts";
import type { ItemId } from "./registry.ts";
import type { Inventory, Item } from "./types.ts";

export const addItemToInventory = (
  inventory: Inventory,
  id: ItemId,
  item: Item
) => {
  const existing = inventory.get(id);

  if (existing != null) existing.count += item.count;
  // Copy so the inventory never shares an item object with its source; otherwise
  // stacking two inventories that hold the same object adds it to itself.
  else inventory.set(id, { ...item });
};

export const mergeInventories = (
  from: Inventory,
  to: Inventory
): Inventory | null => {
  for (const [id, item] of from) addItemToInventory(to, id, item);

  return null;
};

export const dropInventory = (
  inventory: Inventory,
  position: Vector<2>,
  world: World,
  jitterRadius: number = 0.4
): void => {
  for (const [itemId, item] of inventory) {
    createItem(
      world,
      itemId,
      item,
      Vector.create(Math.random(), Math.random())
        .multiply(jitterRadius)
        .add(position)
    );
    inventory.delete(itemId);
  }
};
