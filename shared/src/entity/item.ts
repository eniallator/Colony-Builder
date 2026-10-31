import { Vector } from "vectyped";

import type { World } from "../stores/world.ts";
import type { EntityId } from "./types.ts";

export const createItem = (
  world: World,
  position: Vector<2> = Vector.zero(2)
): EntityId =>
  world.entities.spawn({
    type: "item",
    position,
    conveyable: true,
  });
