import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { predictionSystems } from "./system.ts";
import type { System } from "./system/index.ts";
import { World } from "./world/index.ts";

const runTick = (world: World, systems: System[], dt: number) => {
  for (const system of systems) system({ world, dt });
};

const speed = 1;
const dt = 1;
// Far enough that one tick never reaches it.
const destination = Vector.create(10 * speed * dt, 0);
const oneTickOfTravel = [speed * dt, 0];

describe("predictionSystems", () => {
  it("moves an entity towards its destination", () => {
    const world = new World();
    const id = world.entities.spawn({
      position: Vector.zero(2),
      destination: destination.copy(),
      speed,
    });

    runTick(world, predictionSystems(), dt);

    expect(world.entities.get(id, "position").toArray()).toEqual(
      oneTickOfTravel
    );
  });

  it("applies a destination set by a given system on the same tick", () => {
    const world = new World();
    const id = world.entities.spawn({ position: Vector.zero(2), speed });
    const sendAway: System = ({ world }) => {
      world.entities.add(id, "destination", destination.copy());
    };

    runTick(world, predictionSystems(sendAway), dt);

    expect(world.entities.get(id, "position").toArray()).toEqual(
      oneTickOfTravel
    );
  });
});
