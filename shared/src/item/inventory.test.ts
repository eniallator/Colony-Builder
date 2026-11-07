import { describe, expect, it } from "vitest";

import { addItemToInventory, mergeInventories } from "./inventory.ts";
import type { Inventory } from "./types.ts";

describe("addItemToInventory", () => {
  it("stores a copy rather than the item it was given", () => {
    const inventory: Inventory = new Map();
    const item = { count: 5 };

    addItemToInventory(inventory, "iron_ore", item);

    expect(inventory.get("iron_ore")).toEqual(item);
    expect(inventory.get("iron_ore")).not.toBe(item);
  });

  it("does not change the item it was given when stacking", () => {
    const inventory: Inventory = new Map([["log", { count: 3 }]]);
    const item = { count: 2 };

    addItemToInventory(inventory, "log", item);

    expect(inventory.get("log")).toEqual({ count: 5 });
    expect(item).toEqual({ count: 2 });
  });

  it("does not multiply a shared item when picked up repeatedly", () => {
    const source = { count: 5 };
    const first: Inventory = new Map();
    const second: Inventory = new Map();
    const player: Inventory = new Map();

    addItemToInventory(first, "iron_ore", source);
    addItemToInventory(second, "iron_ore", source);
    mergeInventories(first, player);
    mergeInventories(second, player);

    expect(player.get("iron_ore")).toEqual({ count: 10 });
    expect(source).toEqual({ count: 5 });
  });
});

describe("mergeInventories", () => {
  it("adds counts of items already in the target", () => {
    const from: Inventory = new Map([["log", { count: 2 }]]);
    const to: Inventory = new Map([["log", { count: 3 }]]);

    mergeInventories(from, to);

    expect(to.get("log")).toEqual({ count: 5 });
  });

  it("moves over items the target does not have", () => {
    const from: Inventory = new Map([["iron_ore", { count: 4 }]]);
    const to: Inventory = new Map([["log", { count: 1 }]]);

    mergeInventories(from, to);

    expect(to.get("iron_ore")).toEqual({ count: 4 });
    expect(to.get("log")).toEqual({ count: 1 });
  });

  it("leaves nothing remaining", () => {
    expect(
      mergeInventories(new Map([["log", { count: 1 }]]), new Map())
    ).toBeNull();
  });
});
