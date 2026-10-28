import { predictionSystems, type System } from "@colony-builder/shared";

export type ServerSystem = System;

export const controlSystem: ServerSystem = ({ world }) => {
  for (const id of world.query("position", "controller")) {
    const pos = world.get(id, "position");
    const controller = world.get(id, "controller");

    if (!pos.equals(controller.destination)) {
      world.add(id, "destination", controller.destination);
    }
  }
};

export const serverSystems: ServerSystem[] = [
  controlSystem,
  ...predictionSystems,
];
