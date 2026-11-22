import type { System } from "../../system/index.ts";

export const selfMovementSystem: System = ({ world: { entities }, dt }) => {
  for (const id of entities.query("destination", "position", "speed")) {
    const pos = entities.get(id, "position");
    const des = entities.get(id, "destination");
    const speed = entities.get(id, "speed");

    const targetMag = speed * dt;
    const diff = des.copy().sub(pos);

    if (diff.getSquaredMagnitude() > targetMag ** 2) {
      entities.add(
        id,
        "position",
        pos.copy().add(diff.setMagnitude(targetMag))
      );
    } else {
      entities.add(id, "position", des.copy());
      entities.delete(id, "destination");
    }
  }
};
