import type { Vector } from "vectyped";

import type { ItemId } from "../item/registry.ts";
import type { Item } from "../item/types.ts";
import type { World } from "../stores/world.ts";
import type { EntityId } from "./types.ts";

export const createItem = (
  world: World,
  { id, ...item }: { id: ItemId } & Item,
  position: Vector<2>
): EntityId =>
  world.entities.spawn({
    type: "item",
    position,
    canPickup: true,
    conveyable: true,
    inventory: new Map([[id, item]]),
  });
