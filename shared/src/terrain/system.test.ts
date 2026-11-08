import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import {
  CONVEYOR_CENTER_SNAP_DISTANCE,
  CONVEYOR_SPEED,
  REGION_SIDE_LENGTH,
} from "../constants.ts";
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

  it("snaps an entity within the threshold onto the centre line at full speed", () => {
    const world = worldWithTile("conveyor_right");
    const id = world.entities.spawn({
      position: Vector.create(1.5, 1.5 + CONVEYOR_CENTER_SNAP_DISTANCE * 0.9),
      conveyable: true,
    });

    conveyorMovementSystem({ world, dt: 0.5 });

    const [x, y] = world.entities.get(id, "position").toArray();
    expect(y).toBeCloseTo(1.5, 10);
    expect(x).toBeCloseTo(1.5 + 0.5 * CONVEYOR_SPEED, 10);
  });

  it("snaps from either side of the centre line", () => {
    const world = worldWithTile("conveyor_right");
    const id = world.entities.spawn({
      position: Vector.create(1.5, 1.5 - CONVEYOR_CENTER_SNAP_DISTANCE * 0.9),
      conveyable: true,
    });

    conveyorMovementSystem({ world, dt: 0.5 });

    expect(world.entities.get(id, "position").y()).toBeCloseTo(1.5, 10);
  });

  it("eases an entity beyond the threshold towards the centre line without snapping", () => {
    const world = worldWithTile("conveyor_right");
    const startY = 1.5 + CONVEYOR_CENTER_SNAP_DISTANCE * 3;
    const id = world.entities.spawn({
      position: Vector.create(1.5, startY),
      conveyable: true,
    });

    conveyorMovementSystem({ world, dt: 0.05 });

    const y = world.entities.get(id, "position").y();
    expect(y).toBeLessThan(startY);
    expect(y).toBeGreaterThan(1.5);
  });

  it("brings an off-centre entity up to full belt speed", () => {
    const world = worldWithTile("conveyor_right");
    const id = world.entities.spawn({
      position: Vector.create(1.5, 1.5 + 0.4),
      conveyable: true,
    });
    const dt = 0.05;

    // Run until it has had time to settle, then measure one more tick.
    for (let tick = 0; tick < 100; tick++)
      conveyorMovementSystem({ world, dt });
    const before = world.entities.get(id, "position").x();
    conveyorMovementSystem({ world, dt });

    const speed = (world.entities.get(id, "position").x() - before) / dt;
    expect(speed).toBeCloseTo(CONVEYOR_SPEED, 10);
  });

  it("ignores entities that are not conveyable", () => {
    const world = worldWithTile("conveyor_right");
    const id = world.entities.spawn({ position: Vector.create(1.5, 1.5) });

    conveyorMovementSystem({ world, dt: 1 });

    expect(world.entities.get(id, "position").toArray()).toEqual([1.5, 1.5]);
  });
});
