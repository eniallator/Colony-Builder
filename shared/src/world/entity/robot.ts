import { Vector } from "vectyped";

import { ROBOT_SPEED } from "../../constants.ts";
import type { Task } from "../../task/index.ts";
import type { World } from "../index.ts";
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
    inventory: {},
    taskList: { tasks, repeat: true },
  });
