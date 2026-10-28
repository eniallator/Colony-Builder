import { Vector } from "vectyped";

import { PLAYER_SPEED } from "../constants.ts";
import type { World } from "../world.ts";
import type { EntityId } from "./types.ts";

export const createPlayer = (
  world: World,
  position: Vector<2> = Vector.zero(2)
): EntityId => {
  const id = world.spawn();

  world.add(id, "entityType", "player");
  world.add(id, "controller", { destination: Vector.zero(2) });
  world.add(id, "position", position);
  world.add(id, "speed", PLAYER_SPEED);

  return id;
};
