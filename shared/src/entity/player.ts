import { Vector } from "vectyped";

import { PLAYER_SPEED } from "../constants.ts";
import type { World } from "../world.ts";
import type { EntityId } from "./entityid.ts";

export interface PlayerCreate {
  controller: { destination: Vector<2> };
  position: Vector<2>;
  destination?: Vector<2>;
  speed: number;
}

export interface Player extends PlayerCreate {
  id: EntityId;
}

export const createPlayer = (world: World): EntityId => {
  const id = world.spawn();

  world.add(id, "controller", { destination: Vector.zero(2) });
  world.add(id, "position", Vector.zero(2));
  world.add(id, "speed", PLAYER_SPEED);

  return id;
};
