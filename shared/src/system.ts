import type { World } from "./world.ts";

export interface SystemContext {
  world: World;
  dt: number;
}

export type System = (ctx: SystemContext) => void;

export const movementSystem: System = ({ world, dt }) => {
  for (const id of world.query("position", "destination")) {
    const pos = world.get(id, "position");
    const des = world.get(id, "destination");
    const speed = world.get(id, "speed");

    const targetMag = speed * dt;
    const diff = des.copy().sub(pos);

    if (diff.getSquaredMagnitude() > targetMag ** 2) {
      pos.add(diff.setMagnitude(targetMag));
    } else {
      pos.setHead(des);
      world.delete(id, "destination");
    }
  }
};

export const predictionSystems: System[] = [movementSystem];
