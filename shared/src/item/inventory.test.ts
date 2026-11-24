import { describe, expect, it } from "vitest";

import { addItemToInventory, mergeInventories } from "./inventory.ts";
import { itemIds, type Inventory, type Item } from "./types.ts";

const [idA, idB] = itemIds;
const data = false;

const itemOf = (id: Item["id"], count: number): Item => ({ id, count, data });

describe("addItemToInventory", () => {
  it("stores a copy rather than the item it was given", () => {
    const inventory: Inventory = {};
    const item = itemOf(idA, 1);

    addItemToInventory(inventory, item);

    expect(inventory[idA]).toEqual({ count: item.count, data });
    expect(inventory[idA]).not.toBe(item);
  });

  it("does not change the item it was given when stacking", () => {
    const [held, added] = [1, 2];
    const inventory: Inventory = { [idA]: { count: held, data } };
    const item = itemOf(idA, added);

    addItemToInventory(inventory, item);

    expect(inventory[idA]).toEqual({ count: held + added, data });
    expect(item).toEqual(itemOf(idA, added));
  });

  it("does not multiply a shared item when picked up repeatedly", () => {
    const count = 1;
    const source = itemOf(idA, count);
    const first: Inventory = {};
    const second: Inventory = {};
    const player: Inventory = {};

    addItemToInventory(first, source);
    addItemToInventory(second, source);
    mergeInventories(first, player);
    mergeInventories(second, player);

    expect(player[idA]).toEqual({ count: 2 * count, data });
    expect(source).toEqual(itemOf(idA, count));
  });
});

describe("mergeInventories", () => {
  it("adds counts of items already in the target", () => {
    const [fromCount, toCount] = [1, 2];
    const from: Inventory = { [idA]: { count: fromCount, data } };
    const to: Inventory = { [idA]: { count: toCount, data } };

    mergeInventories(from, to);

    expect(to[idA]).toEqual({ count: fromCount + toCount, data });
  });

  it("moves over items the target does not have", () => {
    const [fromCount, toCount] = [1, 2];
    const from: Inventory = { [idA]: { count: fromCount, data } };
    const to: Inventory = { [idB]: { count: toCount, data } };

    mergeInventories(from, to);

    expect(to[idA]).toEqual({ count: fromCount, data });
    expect(to[idB]).toEqual({ count: toCount, data });
  });

  it("leaves nothing remaining", () => {
    expect(mergeInventories({ [idA]: { count: 1, data } }, {})).toBeNull();
  });
});
