import { describe, expect, it } from "vitest";

import { encInventory, encItem } from "./types.ts";

describe("encItem", () => {
  it("round-trips a count without data", () => {
    expect(encItem.decode(encItem.encode({ count: 7 }))).toEqual({ count: 7 });
  });

  it("drops any data when round-tripping", () => {
    const encoded = encItem.encode({ count: 7, data: { any: "thing" } });

    expect(encItem.decode(encoded)).toEqual({ count: 7 });
  });

  it("only accepts non-negative integer counts", () => {
    expect(encItem.guard({ count: 0 })).toBe(true);
    expect(encItem.guard({ count: -1 })).toBe(false);
    expect(encItem.guard({ count: 1.5 })).toBe(false);
  });
});

describe("encInventory", () => {
  it("round-trips", () => {
    const inventory = new Map([
      ["iron_ore", { count: 3 }],
      ["log", { count: 9 }],
    ] as const);

    expect(encInventory.decode(encInventory.encode(inventory))).toEqual(
      inventory
    );
  });
});
