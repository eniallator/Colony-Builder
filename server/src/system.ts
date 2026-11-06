import {
  mergeInventories,
  PICKUP_SQR_RADIUS,
  predictionSystems,
  type System,
} from "@colony-builder/shared";

import type { State } from "./state.ts";

export type ServerSystem = System<{ state: State }>;

export const pickupSystem: ServerSystem = ({ world }) => {
  for (const id of world.entities.query("type", "position", "inventory")) {
    const type = world.entities.get(id, "type");
    if (type !== "player") continue;

    const pos = world.entities.get(id, "position");
    const inventory = world.entities.get(id, "inventory");

    const nearbyPickups = world.entitiesAround(pos.x(), pos.y(), 3, [
      "canPickup",
      "inventory",
    ]);

    for (const pickupId of nearbyPickups) {
      const pickupPos = world.entities.get(pickupId, "position");
      const pickupInventory = world.entities.get(pickupId, "inventory");

      if (pos.sqrDistTo(pickupPos) <= PICKUP_SQR_RADIUS) {
        const remainingInventory = mergeInventories(pickupInventory, inventory);

        // Is despawning right for all things you can pickup?
        if (remainingInventory == null) world.entities.despawn(pickupId);
        else world.entities.add(pickupId, "inventory", remainingInventory);
      }
    }
  }
};

export const serverSystems: ServerSystem[] = [
  ...predictionSystems,
  pickupSystem,
];
