import type { Vector } from "vectyped";

import type { Item, ItemId } from "../../item/index.ts";
import type { World } from "../index.ts";
import type { EntityId } from "./types.ts";

export const createItem = (
  world: World,
  id: ItemId,
  item: Item,
  position: Vector<2>
): EntityId =>
  world.entities.spawn({
    type: "item",
    position,
    canPickup: true,
    conveyable: true,
    inventory: new Map([[id, item]]),
  });
