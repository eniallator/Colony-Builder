import { Vector } from "vectyped";

import { PLAYER_SPEED } from "../../constants.ts";
import type { World } from "../index.ts";
import type { EntityId } from "./types.ts";

export const createPlayer = (
  world: World,
  position: Vector<2> = Vector.zero(2)
): EntityId =>
  world.entities.spawn({
    type: "player",
    position,
    speed: PLAYER_SPEED,
    inventory: {},
    taskList: { tasks: [], repeat: true },
  });
