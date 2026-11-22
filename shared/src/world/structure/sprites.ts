import { conveyorSpriteNames } from "./conveyor.ts";
import type { StructureType } from "./types.ts";

/** Every sprite each structure type is drawn with. */
export const structureSprites = {
  cactus: ["cactus"],
  conveyor: conveyorSpriteNames,
  tree: ["tree"],
} as const satisfies Record<StructureType, readonly string[]>;
