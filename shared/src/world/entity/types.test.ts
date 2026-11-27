import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { itemIds, type ItemData } from "../../item/types.ts";
import {
  allEntityTypes,
  encComponents,
  encEntityId,
  encEntitySnapshot,
  encEntityType,
  unsafeEntityId,
  type Components,
  type EntitySnapshot,
} from "./types.ts";

const [heldItem] = itemIds;
const itemData: ItemData<typeof heldItem> = true;

const player: Components = {
  type: "player",
  position: Vector.create(1.5, -2.25),
  destination: Vector.create(4, 8),
  speed: 3,
  canPickup: undefined,
  conveyable: undefined,
  inventory: { [heldItem]: { data: itemData, count: 5 } },
  taskList: undefined,
};

const robot: Components = {
  type: "robot",
  position: Vector.create(2, 3),
  destination: undefined,
  speed: 2,
  canPickup: undefined,
  conveyable: undefined,
  inventory: {},
  taskList: {
    tasks: [
      { type: "gatherTile", target: Vector.create(3, 4), endsAt: 0.5 },
      { type: "dropInventory", target: Vector.create(-1, 2) },
    ],
    repeat: true,
  },
};

const item: Components = {
  type: "item",
  position: Vector.create(0, 0),
  destination: undefined,
  speed: undefined,
  canPickup: true,
  conveyable: true,
  inventory: undefined,
  taskList: undefined,
};

describe("encEntityId", () => {
  it("accepts non-negative integers", () => {
    expect(encEntityId.guard(0)).toBe(true);
    expect(encEntityId.guard(12)).toBe(true);
  });

  it("rejects negatives, fractions, non-finite values and non-numbers", () => {
    expect(encEntityId.guard(-1)).toBe(false);
    expect(encEntityId.guard(1.5)).toBe(false);
    expect(encEntityId.guard(Infinity)).toBe(false);
    expect(encEntityId.guard("1")).toBe(false);
  });

  it("round-trips through four bytes", () => {
    const id = unsafeEntityId(70000);

    expect(encEntityId.encode(id)).toHaveLength(4);
    expect(encEntityId.decode(encEntityId.encode(id))).toBe(70000);
  });
});

describe("encEntityType", () => {
  it("lists every entity type", () => {
    expect(allEntityTypes).toEqual(["player", "robot", "item"]);
  });

  it.each(allEntityTypes)("round-trips %s", type => {
    expect(encEntityType.decode(encEntityType.encode(type))).toBe(type);
  });
});

describe("encComponents", () => {
  it("round-trips an entity with every field", () => {
    expect(encComponents.decode(encComponents.encode(player))).toEqual(player);
  });

  it("round-trips a robot with a task list", () => {
    expect(encComponents.decode(encComponents.encode(robot))).toEqual(robot);
  });

  it("round-trips an entity without its optional fields", () => {
    expect(encComponents.decode(encComponents.encode(item))).toEqual(item);
  });

  it("rejects non-finite numbers when decoding", () => {
    const nan = encComponents.encode({
      ...item,
      position: Vector.create(Number.NaN, 0),
    });
    const infinite = encComponents.encode({ ...item, speed: Infinity });

    expect(encComponents.decode(nan)).toBeUndefined();
    expect(encComponents.decode(infinite)).toBeUndefined();
  });

  it("round-trips an empty inventory", () => {
    const empty = { ...item, inventory: {} };

    expect(encComponents.decode(encComponents.encode(empty))).toEqual(empty);
  });

  it("rejects an unknown item id or a negative item count", () => {
    const withItem = (id: string, count: number) => ({
      ...item,
      inventory: { [id]: { data: itemData, count } },
    });

    expect(encComponents.guard(withItem("not an item id", 1))).toBe(false);
    expect(encComponents.guard(withItem(heldItem, -1))).toBe(false);
    expect(encComponents.guard(withItem(heldItem, 1.5))).toBe(false);
  });

  it("rejects an unknown entity type", () => {
    expect(encComponents.guard({ ...item, type: "not an entity type" })).toBe(
      false
    );
  });
});

describe("encEntitySnapshot", () => {
  const entities: EntitySnapshot = new Map([
    [unsafeEntityId(1), player],
    [unsafeEntityId(2), item],
  ]);

  it("round-trips entities keyed by id", () => {
    expect(
      encEntitySnapshot.decode(encEntitySnapshot.encode(entities))
    ).toEqual(entities);
  });

  it("round-trips an empty snapshot", () => {
    expect(
      encEntitySnapshot.decode(encEntitySnapshot.encode(new Map()))
    ).toEqual(new Map());
  });

  it("rejects an invalid entity id", () => {
    expect(encEntitySnapshot.guard(new Map([[-1, item]]))).toBe(false);
    expect(encEntitySnapshot.guard(new Map([[1.5, item]]))).toBe(false);
  });
});
