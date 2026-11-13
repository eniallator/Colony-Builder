import type { Tile } from "@colony-builder/shared";

import { fbm, seededNoise, type FbmOptions } from "./noise.ts";

export type StoneTile = Extract<Tile, "stone" | "iron_deposit">;

/**
 * Stone comes as winding worms. Where the vein noise crosses zero it traces a
 * line, and stone hugs that line: wide where the noise is flat, pinched where
 * it is steep. A slower noise decides where worms exist at all and fades them
 * out into tapered ends.
 *
 * Every tile gets a height: 1 on a worm's centreline at full strength, falling
 * to 0 at its edge. Stone is anywhere above `STONE_HEIGHT`, and ore only where
 * the height is high, so it runs along the middle of the strongest stretches.
 */

const VEIN: FbmOptions = {
  scale: 0.03,
  octaves: 2,
  lacunarity: 2,
  persistence: 0.5,
};

const PRESENCE: FbmOptions = {
  scale: 0.015,
  octaves: 1,
  lacunarity: 2,
  persistence: 0.5,
};

/** How far from a zero crossing, in vein noise units, a worm's edge is. */
const VEIN_WIDTH = 0.12;

/** Presence noise below `START` has no worms; at `FULL` they are full width. */
const PRESENCE_START = 0.7;
const PRESENCE_FULL = 0.77;

/** Heights from which a tile is stone, and from which it is ore. */
const STONE_HEIGHT = 0.1;
const ORE_HEIGHT = 0.7;

/** Builds a pure `(x, y) => StoneTile | undefined` lookup for a world seed. */
export const createStoneAt = (
  seed: string
): ((x: number, y: number) => StoneTile | undefined) => {
  const vein = seededNoise(seed, "stone-vein");
  const presence = seededNoise(seed, "stone-presence");

  return (x, y) => {
    const strength = Math.min(
      Math.max(
        (fbm(presence, x, y, PRESENCE) - PRESENCE_START) /
          (PRESENCE_FULL - PRESENCE_START),
        0
      ),
      1
    );
    const height =
      (1 - Math.abs(fbm(vein, x, y, VEIN)) / VEIN_WIDTH) * strength;

    if (height >= ORE_HEIGHT) return "iron_deposit";
    return height >= STONE_HEIGHT ? "stone" : undefined;
  };
};
