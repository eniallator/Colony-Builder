import { describe, expect, it } from "vitest";

import { addItemToInventory, mergeInventories } from "./inventory.ts";
import { itemIds } from "./registry.ts";
import type { Inventory } from "./types.ts";

const [itemA, itemB] = itemIds;

describe("addItemToInventory", () => {
  it("stores a copy rather than the item it was given", () => {
    const inventory: Inventory = new Map();
    const item = { count: 1 };

    addItemToInventory(inventory, itemA, item);

    expect(inventory.get(itemA)).toEqual(item);
    expect(inventory.get(itemA)).not.toBe(item);
  });

  it("does not change the item it was given when stacking", () => {
    const [held, added] = [1, 2];
    const inventory: Inventory = new Map([[itemA, { count: held }]]);
    const item = { count: added };

    addItemToInventory(inventory, itemA, item);

    expect(inventory.get(itemA)).toEqual({ count: held + added });
    expect(item).toEqual({ count: added });
  });

  it("does not multiply a shared item when picked up repeatedly", () => {
    const count = 1;
    const source = { count };
    const first: Inventory = new Map();
    const second: Inventory = new Map();
    const player: Inventory = new Map();

    addItemToInventory(first, itemA, source);
    addItemToInventory(second, itemA, source);
    mergeInventories(first, player);
    mergeInventories(second, player);

    expect(player.get(itemA)).toEqual({ count: 2 * count });
    expect(source).toEqual({ count });
  });
});

describe("mergeInventories", () => {
  it("adds counts of items already in the target", () => {
    const [fromCount, toCount] = [1, 2];
    const from: Inventory = new Map([[itemA, { count: fromCount }]]);
    const to: Inventory = new Map([[itemA, { count: toCount }]]);

    mergeInventories(from, to);

    expect(to.get(itemA)).toEqual({ count: fromCount + toCount });
  });

  it("moves over items the target does not have", () => {
    const [fromCount, toCount] = [1, 2];
    const from: Inventory = new Map([[itemA, { count: fromCount }]]);
    const to: Inventory = new Map([[itemB, { count: toCount }]]);

    mergeInventories(from, to);

    expect(to.get(itemA)).toEqual({ count: fromCount });
    expect(to.get(itemB)).toEqual({ count: toCount });
  });

  it("leaves nothing remaining", () => {
    expect(
      mergeInventories(new Map([[itemA, { count: 1 }]]), new Map())
    ).toBeNull();
  });
});
