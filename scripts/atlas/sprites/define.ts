// Helpers for registering sprites. A sprite definition is `{ name, frames }`
// where `frames` is a list of 16x16 RGBA buffers (variants OR animation frames),
// plus optional metadata that pack.ts copies into atlas.json for the renderer
// (so nothing about the art is hard-coded in the client):
//   frameSec time each animation frame is shown, in seconds
//   stepPx   pixels the art moves per frame, for animations that depict motion
//            at a game speed (the client derives the frame time from the speed)
//   ground   pixel row line the sprite rests on; measured from the lowest
//            opaque pixel unless given here (see pack.ts)
//   raise    pixels the sprite stands above the ground, for surfaces things
//            ride on (belts); the client lifts what rides on it by this much
// Every sprite with more than one animation frame needs `frameSec` or `stepPx`.
//
// Naming contract with the game (checked by coverage.ts):
//   terrain tile `x`        -> sprite `x`
//   item id `x`             -> sprite `item_x`
//   entity type `x`         -> sprites `x_up|down|left|right`
//   structure type `x`      -> the sprites `structureSprites[x]` lists

import type { SpriteMode } from "../../../client/src/render/atlas.ts";
import type { Facing } from "../../../shared/src/facing.ts";
import { hash, mulberry32, type Pixels, type Rng } from "../core.ts";

/** What the renderer needs to know about a sprite's art (see above). */
export interface SpriteMeta {
  frameSec?: number;
  stepPx?: number;
  ground?: number;
  raise?: number;
}

export interface Sprite extends SpriteMeta {
  name: string;
  /** Animation frames when left out. */
  mode?: SpriteMode;
  frames: Pixels[];
}

export const DIRS: readonly Facing[] = ["up", "down", "left", "right"];

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/**
 * Random-variant sprite (e.g. terrain or plants), one variant per design.
 * `draw(rng, design, variantIndex)` is called once per variant with an RNG
 * seeded from the name, so output is deterministic and adding a sprite never
 * changes any other sprite's look.
 */
export const variants = <D>(
  name: string,
  designs: readonly D[],
  draw: (rng: Rng, design: D) => Pixels
): Sprite => ({
  name,
  // Tells the client these are interchangeable looks (pick one per tile by
  // position), not animation frames (cycle through over time).
  mode: "variants",
  frames: designs.map((design, i) =>
    draw(mulberry32(hash(`${name}:${i}`)), design)
  ),
});

/**
 * Animated sprite. `draw(rng, frame)` gets a fresh RNG with the SAME seed for
 * every frame, so only the deliberately animated parts change between frames.
 */
export const animated = (
  name: string,
  count: number,
  draw: (rng: Rng, frame: number) => Pixels,
  meta: SpriteMeta = {}
): Sprite => ({
  name,
  frames: range(count).map(frame => draw(mulberry32(hash(name)), frame)),
  ...meta,
});

/** A single static sprite from an already-drawn buffer. */
export const still = (
  name: string,
  sprite: Pixels,
  meta: SpriteMeta = {}
): Sprite => ({
  name,
  frames: [sprite],
  ...meta,
});

/** Four-direction sprite set: `<name>_up|down|left|right`, `count` frames each. */
export const directional = (
  name: string,
  count: number,
  draw: (dir: Facing, frame: number) => Pixels,
  meta: SpriteMeta = {}
): Sprite[] =>
  DIRS.map(dir => ({
    name: `${name}_${dir}`,
    frames: range(count).map(frame => draw(dir, frame)),
    ...meta,
  }));
