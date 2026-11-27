import {
  FACINGS,
  type Facing,
  type StructureType,
} from "@colony-builder/shared";
import { tuple } from "niall-utils/core";

/** The ways the head of a belt can turn. */
export const conveyorBends = tuple("clockwise", "anticlockwise");
export type ConveyorBend = (typeof conveyorBends)[number];

/** The sprite a belt facing `facing` is drawn with, with its `bend` if it has one. */
export const conveyorSpriteName = (
  facing: Facing,
  bend: ConveyorBend | null = null
): string =>
  bend == null ? `conveyor_${facing}` : `conveyor_${facing}_turning_${bend}`;

export const conveyorSpriteNames = FACINGS.flatMap(facing => [
  conveyorSpriteName(facing),
  ...conveyorBends.map(bend => conveyorSpriteName(facing, bend)),
]);

/**
 * Every sprite each structure type is drawn with. Each plant has one sprite
 * holding several interchangeable looks (variants), picked per structure by
 * where it stands.
 */
export const structureSprites = {
  cactus: ["cactus"],
  conveyor: conveyorSpriteNames,
  fern: ["fern"],
  mushroom: ["mushroom"],
  tree: ["tree"],
} as const satisfies Record<StructureType, readonly string[]>;
