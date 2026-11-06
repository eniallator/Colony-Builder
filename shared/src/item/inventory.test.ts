import { describe, expect, it } from "vitest";

import { mergeInventories } from "./inventory.ts";
import type { Inventory } from "./types.ts";

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
