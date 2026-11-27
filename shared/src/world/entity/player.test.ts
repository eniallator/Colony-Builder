import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { PLAYER_SPEED } from "../../constants.ts";
import { World } from "../index.ts";
import { createPlayer } from "./player.ts";

describe("createPlayer", () => {
  it("spawns a player at the origin by default", () => {
    const world = new World();
    const id = createPlayer(world);

    expect(world.entities.get(id, "type")).toBe("player");
    expect(world.entities.get(id, "position").toArray()).toEqual([0, 0]);
    expect(world.entities.get(id, "speed")).toBe(PLAYER_SPEED);
    expect(world.entities.optGet(id, "conveyable")).toBeUndefined();
  });

  it("spawns at the given position", () => {
    const world = new World();
    const id = createPlayer(world, Vector.create(4, 5));

    expect(world.entities.get(id, "position").toArray()).toEqual([4, 5]);
  });
});
