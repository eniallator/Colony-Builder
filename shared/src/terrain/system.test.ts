import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { CONVEYOR_SPEED, REGION_SIDE_LENGTH } from "../constants.ts";
import { World } from "../stores/world.ts";
import { conveyorMovementSystem } from "./system.ts";
import { regionPosToId, tiles, type Tile } from "./types.ts";

const worldWithTile = (tile: Tile) => {
  const world = new World();
  world.terrain.add(
    regionPosToId(0, 0),
    Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () => tile)
  );
  return world;
};

const spawnConveyable = (world: World) =>
  world.entities.spawn({
    position: Vector.create(1.5, 1.5),
    conveyable: true,
  });

describe("conveyorMovementSystem", () => {
  it("moves a conveyable entity in the direction of the conveyor", () => {
    const world = worldWithTile("conveyor_right");
    const id = spawnConveyable(world);

    conveyorMovementSystem({ world, dt: 0.5 });

    expect(world.entities.get(id, "position").toArray()).toEqual([
      1.5 + 0.5 * CONVEYOR_SPEED,
      1.5,
    ]);
  });

  it("leaves an entity on a non-conveyor tile where it is", () => {
    const world = worldWithTile(tiles[0]);
    const id = spawnConveyable(world);

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1.5, 1.5]);
  });

  it("leaves an entity on unloaded terrain where it is", () => {
    const world = new World();
    const id = spawnConveyable(world);

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1.5, 1.5]);
  });

  it("ignores entities that are not conveyable", () => {
    const world = worldWithTile("conveyor_right");
    const id = world.entities.spawn({ position: Vector.create(1.5, 1.5) });

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1.5, 1.5]);
  });
});
