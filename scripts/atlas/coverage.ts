// Cross-checks the game's content against the atlas, so adding a tile, item or
// entity type to the game without art is flagged immediately.
//
// Imports the game's own registries, so there is no second list to keep in sync.

import { structureSprites } from "../../client/src/render/structure-sprites.ts";
import { allEntityTypes, itemRegistry, tiles } from "../../shared/src/index.ts";

/** A sprite the game needs, and the entry of its registry that needs it. */
export interface Requirement {
  kind: "tile" | "item" | "entity" | "structure";
  id: string;
  sprite: string;
}

/** The sprite names the game needs. */
const REQUIRED_SPRITES: Requirement[] = [
  ...tiles.map(tile => ({ kind: "tile" as const, id: tile, sprite: tile })),
  ...Object.keys(itemRegistry).map(id => ({
    kind: "item" as const,
    id,
    sprite: `item_${id}`,
  })),
  // "item" entities render the item's own icon, so they need no sprite.
  ...allEntityTypes
    .filter(type => type !== "item")
    .map(type => ({
      kind: "entity" as const,
      id: type,
      sprite: `${type}_down`,
    })),
  ...Object.entries(structureSprites).flatMap(([id, sprites]) =>
    sprites.map(sprite => ({ kind: "structure" as const, id, sprite }))
  ),
];

/** The sprites the game needs which `spriteNames` lacks. */
export const checkCoverage = (
  spriteNames: readonly string[]
): Requirement[] => {
  const names = new Set(spriteNames);
  return REQUIRED_SPRITES.filter(({ sprite }) => !names.has(sprite));
};
