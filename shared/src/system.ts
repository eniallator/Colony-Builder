import type { EntityStore } from "./entityStore.ts";

export interface SystemContext {
  store: EntityStore;
  dt: number;
}

export type System<Ctx = unknown> = (ctx: SystemContext & Ctx) => void;

export const movementSystem: System = ({ store, dt }) => {
  for (const id of store.query("position", "destination", "speed")) {
    const pos = store.get(id, "position");
    const des = store.get(id, "destination");
    const speed = store.get(id, "speed");

    const targetMag = speed * dt;
    const diff = des.copy().sub(pos);

    if (diff.getSquaredMagnitude() > targetMag ** 2) {
      pos.add(diff.setMagnitude(targetMag));
    } else {
      pos.setHead(des);
      store.delete(id, "destination");
    }
  }
};

export const predictionSystems: System[] = [movementSystem];
