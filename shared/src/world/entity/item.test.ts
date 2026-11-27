import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { itemIds, type Item, type ItemData } from "../../item/types.ts";
import { World } from "../index.ts";
import { createItem } from "./item.ts";

describe("createItem", () => {
  const [itemId] = itemIds;
  const data: ItemData<typeof itemId> = true;
  const item: Item = { id: itemId, count: 1, data };

  it("spawns a pickable, conveyable item holding the given item", () => {
    const world = new World();
    const id = createItem(world, item, Vector.zero(2));

    expect(world.entities.get(id, "type")).toBe("item");
    expect(world.entities.get(id, "position").toArray()).toEqual([0, 0]);
    expect(world.entities.get(id, "canPickup")).toBe(true);
    expect(world.entities.get(id, "conveyable")).toBe(true);
    expect(world.entities.get(id, "inventory")).toEqual({
      [itemId]: { count: item.count, data: item.data },
    });
    expect(world.entities.optGet(id, "speed")).toBeUndefined();
  });

  it("spawns at the given position", () => {
    const world = new World();
    const id = createItem(world, item, Vector.create(-1, 2));

    expect(world.entities.get(id, "position").toArray()).toEqual([-1, 2]);
  });
});
