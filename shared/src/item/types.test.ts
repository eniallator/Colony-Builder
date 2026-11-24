import { describe, expect, it } from "vitest";

import {
  encInventory,
  encItem,
  itemIds,
  type Inventory,
  type Item,
} from "./types.ts";

const [idA, idB] = itemIds;
const data = false;

describe("encItem", () => {
  const count = 1;

  it("round-trips an item", () => {
    const item: Item = { id: idA, count, data };

    expect(encItem.decode(encItem.encode(item))).toEqual(item);
  });

  it("rejects data that does not match the item's data encoding", () => {
    expect(encItem.guard({ id: idA, count, data: { any: "thing" } })).toBe(
      false
    );
  });

  it("rejects an unknown item id", () => {
    expect(encItem.guard({ id: "not an item id", count, data })).toBe(false);
  });

  it("only accepts non-negative integer counts", () => {
    expect(encItem.guard({ id: idA, count: 0, data })).toBe(true);
    expect(encItem.guard({ id: idA, count: -1, data })).toBe(false);
    expect(encItem.guard({ id: idA, count: 1.5, data })).toBe(false);
  });
});

describe("encInventory", () => {
  it("round-trips", () => {
    const inventory: Inventory = {
      [idA]: { count: 1, data },
      [idB]: { count: 2, data },
    };

    expect(encInventory.decode(encInventory.encode(inventory))).toEqual(
      inventory
    );
  });
});
