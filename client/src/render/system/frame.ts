import { CONVEYOR_SPEED, type Tile } from "@colony-builder/shared";
import { raise } from "niall-utils/core";

import type { AtlasSprite } from "../atlas.ts";
import { frameAt } from "../sprite.ts";

// Tiles that carry things along at a game speed (tiles per second). Their art
// declares how far it moves per frame (`stepPx`), so the animation keeps pace.
export const TILE_SPEEDS: Partial<Record<Tile, number>> = {
  conveyor_up: CONVEYOR_SPEED,
  conveyor_down: CONVEYOR_SPEED,
  conveyor_left: CONVEYOR_SPEED,
  conveyor_right: CONVEYOR_SPEED,
};

/**
 * The one of `items` (one per animation frame of `sprite`) showing at `now` (seconds).
 * Frame timing comes from the atlas: a fixed time, or, for animations that
 * depict motion at `tilesPerSecond`, the time to move `stepPx` pixels.
 */
export const frameOf = <T>(
  sprite: AtlasSprite,
  items: T[],
  tileSize: number,
  now: number,
  tilesPerSecond?: number
): T | undefined => {
  if (items.length <= 1) return items.at(0);

  const frameSec =
    sprite.frameSec ??
    (sprite.stepPx != null && tilesPerSecond != null
      ? sprite.stepPx / tileSize / tilesPerSecond
      : raise(new Error("Animated sprite has no frame timing in the atlas")));
  return frameAt(items, frameSec, now).frame;
};
