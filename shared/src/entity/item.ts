import { Vector } from "vectyped";

import type { World } from "../world.ts";
import type { EntityId } from "./types.ts";

export const createItem = (
  world: World,
  position: Vector<2> = Vector.zero(2)
): EntityId => {
  const id = world.spawn();

  world.add(id, "entityType", "item");
  world.add(id, "position", position);

  return id;
};
