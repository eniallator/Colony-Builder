import { Vector } from "vectyped";

import {
  CONVEYOR_CENTER_SNAP_DISTANCE,
  CONVEYOR_SPEED,
} from "../../constants.ts";
import { facingDirOf } from "../../facing.ts";
import type { System } from "../../system/index.ts";

const TURN_RADIUS = 0.5;

export const conveyorMovementSystem: System = ({ world, dt }) => {
  for (const id of world.entities.query("conveyable", "position")) {
    const position = world.entities.get(id, "position");

    const belt = world.structures.structureAt(
      "conveyor",
      position.x(),
      position.y()
    );
    if (belt == null) continue;

    const direction = facingDirOf[belt.data.facing];
    const toCenter = Vector.create(...belt.worldPos)
      .sub(position)
      .map((n, i) => (direction.valueOf(i) === 0 ? n : 0));
    const distFromCenter = Math.abs(toCenter.sum());

    if (distFromCenter <= CONVEYOR_CENTER_SNAP_DISTANCE) {
      position.add(toCenter, direction.copy().multiply(dt, CONVEYOR_SPEED));
    } else {
      const turn = Math.min(1, distFromCenter / TURN_RADIUS);
      const heading = direction
        .copy()
        .multiply(1 - turn)
        .add(toCenter.getNorm().multiply(Math.sqrt(1 - (1 - turn) ** 2)));
      position.add(heading.multiply(dt, CONVEYOR_SPEED));
    }
  }
};
