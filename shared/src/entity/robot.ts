import { Vector } from "vectyped";

import { ROBOT_SPEED } from "../constants.ts";
import type { World } from "../stores/world.ts";
import type { Task } from "../task/types.ts";
import type { EntityId } from "./types.ts";

export const createRobot = (
  world: World,
  position: Vector<2> = Vector.zero(2),
  tasks: Task[] = []
): EntityId =>
  world.entities.spawn({
    type: "robot",
    position,
    speed: ROBOT_SPEED,
    inventory: new Map(),
    taskList: { tasks, repeat: true },
  });
