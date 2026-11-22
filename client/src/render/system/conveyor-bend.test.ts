import {
  facingDirOf,
  FACINGS,
  REGION_SIDE_LENGTH,
  StructureStore,
  type ConveyorData,
  type Facing,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { conveyorBend } from "./conveyor-bend.ts";

const belt = (facing: Facing, tiles: number): ConveyorData => ({
  facing,
  length: tiles * REGION_SIDE_LENGTH,
});

const perpendicularsOf = (facing: Facing) =>
  FACINGS.filter(other => facingDirOf[other].dot(facingDirOf[facing]) === 0);

describe("conveyorBend", () => {
  const head = Vector.create(
    REGION_SIDE_LENGTH / 2 + 0.5,
    REGION_SIDE_LENGTH / 2 + 0.5
  );
  const tiles = 2;

  const storeWith = (...belts: [Facing, Vector<2>, number][]) => {
    const store = new StructureStore();
    for (const [facing, anchor, length] of belts) {
      store.addStructureAt(...anchor.toArray(), {
        type: "conveyor",
        data: belt(facing, length),
      });
    }
    return store;
  };

  const headOf = (facing: Facing) => ({
    worldPos: head.toArray(),
    data: belt(facing, tiles),
  });

  // A belt of `tiles` tiles whose last tile is directly behind the head.
  const feederInto = (
    facing: Facing,
    feeding: Facing
  ): [Facing, Vector<2>, number] => [
    feeding,
    head.copy().sub(facingDirOf[feeding].copy().multiply(tiles)),
    tiles,
  ];

  it.each(FACINGS)("runs straight with nothing behind it (%s)", facing => {
    const store = storeWith([facing, head, tiles]);

    expect(conveyorBend(store, headOf(facing))).toBeNull();
  });

  it.each(FACINGS)("runs straight when fed straight on (%s)", facing => {
    const store = storeWith([facing, head, tiles], feederInto(facing, facing));

    expect(conveyorBend(store, headOf(facing))).toBeNull();
  });

  it.each(FACINGS)("bends when fed from the side (%s)", facing => {
    for (const feeding of perpendicularsOf(facing)) {
      const store = storeWith(
        [facing, head, tiles],
        feederInto(facing, feeding)
      );

      expect(conveyorBend(store, headOf(facing))).not.toBeNull();
    }
  });

  it.each(FACINGS)(
    "bends to opposite sides for opposite feeders (%s)",
    facing => {
      const [one, two] = perpendicularsOf(facing).map(feeding =>
        conveyorBend(
          storeWith([facing, head, tiles], feederInto(facing, feeding)),
          headOf(facing)
        )
      );

      expect(one).not.toBe(two);
    }
  );

  it("turns anticlockwise when fed from its left", () => {
    // Travelling up the screen, the left is where a rightwards belt comes from.
    const store = storeWith(["up", head, tiles], feederInto("up", "right"));

    expect(conveyorBend(store, headOf("up"))).toBe("anticlockwise");
  });

  it("turns clockwise when fed from its right", () => {
    const store = storeWith(["up", head, tiles], feederInto("up", "left"));

    expect(conveyorBend(store, headOf("up"))).toBe("clockwise");
  });

  it.each(FACINGS)("prefers a straight feeder to a side one (%s)", facing => {
    const [side] = perpendicularsOf(facing);
    const store = storeWith(
      [facing, head, tiles],
      feederInto(facing, facing),
      feederInto(facing, side ?? facing)
    );

    expect(conveyorBend(store, headOf(facing))).toBeNull();
  });

  it.each(FACINGS)("ignores a side belt that ends short of it (%s)", facing => {
    const [side] = perpendicularsOf(facing);
    const [feeding, anchor, length] = feederInto(facing, side ?? facing);
    const store = storeWith(
      [facing, head, tiles],
      [feeding, anchor.sub(facingDirOf[feeding]), length]
    );

    expect(conveyorBend(store, headOf(facing))).toBeNull();
  });

  it.each(FACINGS)(
    "ignores a belt behind it facing against it (%s)",
    facing => {
      const against = FACINGS.find(
        other => facingDirOf[other].dot(facingDirOf[facing]) < 0
      );
      const store = storeWith(
        [facing, head, tiles],
        // One tile, in the tile directly behind the head.
        [against ?? facing, head.copy().sub(facingDirOf[facing]), 1]
      );

      expect(conveyorBend(store, headOf(facing))).toBeNull();
    }
  );
});
