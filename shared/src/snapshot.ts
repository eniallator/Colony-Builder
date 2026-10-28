import { Vector } from "vectyped";

import type { EntityId } from "./entity/index.ts";
import type { WorldSnapshot } from "./protocol/index.ts";
import type { World } from "./world.ts";

export const takeSnapshot = (world: World): WorldSnapshot => ({
  entities: world.query("position").map(id => ({
    id,
    type: world.get(id, "entityType"),
    position: world.get(id, "position").toArray(),
    destination: world.optGet(id, "destination")?.toArray(),
    speed: world.optGet(id, "speed"),
  })),
});

export const applySnapshot = (world: World, snapshot: WorldSnapshot): void => {
  const seen = new Set<EntityId>();
  for (const entity of snapshot.entities) {
    seen.add(entity.id);

    world.add(entity.id, "entityType", entity.type);
    world.add(entity.id, "position", Vector.create(...entity.position));

    if (entity.speed != null) {
      world.add(entity.id, "speed", entity.speed);
    }
    if (entity.destination != null) {
      world.add(entity.id, "destination", Vector.create(...entity.destination));
    }
  }

  for (const id of world.query("position")) {
    if (!seen.has(id)) world.despawn(id);
  }
};
