import { Vector } from "vectyped";

import { CONVEYOR_SPEED } from "./constants.ts";
import type { World } from "./stores/world.ts";
import type { Tile } from "./terrain/types.ts";

export interface SystemContext {
  world: World;
  dt: number;
}

export type System<Ctx = unknown> = (ctx: SystemContext & Ctx) => void;

export const reindexEntities: System = ({ world }) => {
  world.indexEntities();
};

export const selfMovementSystem: System = ({ world: { entities }, dt }) => {
  for (const id of entities.query("destination", "position", "speed")) {
    const pos = entities.get(id, "position");
    const des = entities.get(id, "destination");
    const speed = entities.get(id, "speed");

    const targetMag = speed * dt;
    const diff = des.copy().sub(pos);

    if (diff.getSquaredMagnitude() > targetMag ** 2) {
      pos.add(diff.setMagnitude(targetMag));
    } else {
      pos.setHead(des);
      entities.delete(id, "destination");
    }
  }
};

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
      position.add(
        toCenter
          .lerp((1 - 2 * Math.abs(toCenter.sum())) ** 2, direction)
          .multiply(dt, CONVEYOR_SPEED)
      );
    }
  }
};

export const predictionSystems: System[] = [
  reindexEntities,
  selfMovementSystem,
  conveyorMovementSystem,
];
