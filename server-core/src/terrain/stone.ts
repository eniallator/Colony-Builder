import type { Tile } from "@colony-builder/shared";
import { tuple } from "niall-utils/core";
import { clamp } from "niall-utils/math";

import { fbm, seededNoise, type FbmOptions } from "./noise.ts";

export const stoneOres = tuple(
  "iron_deposit",
  "copper_deposit"
) satisfies Tile[];

export type StoneTile = "stone" | (typeof stoneOres)[number];

/**
 * Stone comes as winding worms. Where the vein noise crosses zero it traces a
 * line, and stone hugs that line: wide where the noise is flat, pinched where
 * it is steep. A slower noise decides where worms exist at all and fades them
 * out into tapered ends.
 *
 * Every tile gets a height: 1 on a worm's centreline at full strength, falling
 * to 0 at its edge. Stone is anywhere above `STONE_HEIGHT`, and ore only where
 * the height is high, so it runs along the middle of the strongest stretches.
 *
 * Which ore a worm carries comes from another slow noise, sampled where the
 * ore is. It varies much more slowly than a worm winds, so a worm keeps one ore
 * along its length and neighbouring worms can differ. The noise clusters around
 * zero, so it is cut at its own quantiles (measured over a wide sample of the
 * seed's world) rather than at even steps, giving every ore in `stoneOres` the
 * same share.
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

const ORE_KIND: FbmOptions = {
  scale: 0.01,
  octaves: 1,
  lacunarity: 2,
  persistence: 0.5,
};

const ORE_SAMPLE_SIDE = 64;
const ORE_SAMPLE_STEP = 50;

const VEIN_WIDTH = 0.12;

const PRESENCE_START = 0.7;
const PRESENCE_FULL = 0.77;

const STONE_HEIGHT = 0.1;
const ORE_HEIGHT = 0.7;

export const createStoneAt = (
  seed: string
): ((x: number, y: number) => StoneTile | undefined) => {
  const vein = seededNoise(seed, "stone-vein");
  const presence = seededNoise(seed, "stone-presence");
  const oreKind = seededNoise(seed, "stone-ore-kind");
  const oreKindAt = (x: number, y: number) => fbm(oreKind, x, y, ORE_KIND);

  const samples = Array.from({ length: ORE_SAMPLE_SIDE ** 2 }, (_, i) =>
    oreKindAt(
      ((i % ORE_SAMPLE_SIDE) - ORE_SAMPLE_SIDE / 2) * ORE_SAMPLE_STEP,
      (Math.floor(i / ORE_SAMPLE_SIDE) - ORE_SAMPLE_SIDE / 2) * ORE_SAMPLE_STEP
    )
  ).sort((a, b) => a - b);

  const bucket = (i: number) =>
    Math.floor((i * stoneOres.length) / samples.length);
  const cuts = samples.filter((_, i) => i > 0 && bucket(i) > bucket(i - 1));

  return (x, y) => {
    const strength = clamp(
      (fbm(presence, x, y, PRESENCE) - PRESENCE_START) /
        (PRESENCE_FULL - PRESENCE_START),
      0,
      1
    );

    if (strength === 0) return undefined;

    const height =
      (1 - Math.abs(fbm(vein, x, y, VEIN)) / VEIN_WIDTH) * strength;

    if (height >= ORE_HEIGHT) {
      const kind = oreKindAt(x, y);
      return stoneOres[cuts.reduce((n, cut) => n + (kind >= cut ? 1 : 0), 0)];
    }
    return height >= STONE_HEIGHT ? "stone" : undefined;
  };
};
