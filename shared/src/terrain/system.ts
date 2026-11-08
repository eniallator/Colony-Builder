import { Vector } from "vectyped";

import { CONVEYOR_CENTER_SNAP_DISTANCE, CONVEYOR_SPEED } from "../constants.ts";
import type { System } from "../system/index.ts";
import type { Tile } from "./types.ts";

const conveyorTileToDirection: Partial<Record<Tile, Vector<2>>> = {
  conveyor_up: Vector.UP,
  conveyor_down: Vector.DOWN,
  conveyor_left: Vector.LEFT,
  conveyor_right: Vector.RIGHT,
};

export const conveyorMovementSystem: System = ({ world, dt }) => {
  for (const id of world.entities.query("conveyable", "position")) {
    const position = world.entities.get(id, "position");

    const tileAtFeet = world.terrain.optTileAt(position.x(), position.y());
    const direction =
      tileAtFeet != null ? conveyorTileToDirection[tileAtFeet] : null;

    if (direction != null) {
      // Perpendicular offset to the belt's centre line (zero along the belt)
      const toCenter = position
        .copy()
        .positiveMod(1)
        .map((n, i) => (direction.valueOf(i) === 0 ? 0.5 - n : 0));
      const distFromCenter = Math.abs(toCenter.sum());
      if (distFromCenter <= CONVEYOR_CENTER_SNAP_DISTANCE) {
        position.add(toCenter, direction.copy().multiply(dt, CONVEYOR_SPEED));
      } else {
        position.add(
          toCenter
            .lerp((1 - 2 * distFromCenter) ** 2, direction)
            .multiply(dt, CONVEYOR_SPEED)
        );
      }
    }
  }
};
