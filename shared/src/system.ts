import type { World } from "./stores/world.ts";

export interface SystemContext {
  world: World;
  dt: number;
}

export type System<Ctx = unknown> = (ctx: SystemContext & Ctx) => void;

export const movementSystem: System = ({ world, dt }) => {
  for (const id of world.entities.query("position", "destination", "speed")) {
    const pos = world.entities.get(id, "position");
    const des = world.entities.get(id, "destination");
    const speed = world.entities.get(id, "speed");

    const targetMag = speed * dt;
    const diff = des.copy().sub(pos);

    if (diff.getSquaredMagnitude() > targetMag ** 2) {
      pos.add(diff.setMagnitude(targetMag));
    } else {
      pos.setHead(des);
      world.entities.delete(id, "destination");
    }
  }
};

export const predictionSystems: System[] = [movementSystem];
