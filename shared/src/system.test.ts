import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { World } from "./stores/index.ts";
import { predictionSystems } from "./system.ts";
import type { System } from "./system/index.ts";

const runTick = (world: World, systems: System[], dt: number) => {
  for (const system of systems) system({ world, dt });
};

describe("predictionSystems", () => {
  it("moves an entity towards its destination", () => {
    const world = new World();
    const id = world.entities.spawn({
      position: Vector.zero(2),
      destination: Vector.create(10, 0),
      speed: 2,
    });

    runTick(world, predictionSystems(), 1);

    expect(world.entities.get(id, "position").toArray()).toEqual([2, 0]);
  });

  it("applies a destination set by a given system on the same tick", () => {
    const world = new World();
    const id = world.entities.spawn({ position: Vector.zero(2), speed: 2 });
    const sendEast: System = ({ world }) => {
      world.entities.add(id, "destination", Vector.create(10, 0));
    };

    runTick(world, predictionSystems(sendEast), 1);

    expect(world.entities.get(id, "position").toArray()).toEqual([2, 0]);
  });
});
