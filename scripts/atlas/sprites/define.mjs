// Helpers for registering sprites. A sprite definition is `{ name, frames }`
// where `frames` is a list of 16x16 RGBA buffers (variants OR animation frames),
// plus optional metadata that pack.mjs copies into atlas.json for the renderer
// (so nothing about the art is hard-coded in the client):
//   frameMs  time each animation frame is shown, in ms
//   stepPx   pixels the art moves per frame, for animations that depict motion
//            at a game speed (the client derives the frame time from the speed)
//   ground   pixel row line the sprite rests on; measured from the lowest
//            opaque pixel unless given here (see pack.mjs)
// Every sprite with more than one animation frame needs `frameMs` or `stepPx`.
//
// Naming contract with the game (checked by coverage.mjs):
//   terrain tile `x`        -> sprite `x`
//   item id `x`             -> sprite `item_x`
//   entity type `x`         -> sprites `x_up|down|left|right`

import { hash, mulberry32 } from "../core.mjs";

export const DIRS = ["up", "down", "left", "right"];

const range = n => Array.from({ length: n }, (_, i) => i);

/**
 * Random-variant sprite (e.g. terrain). `draw(rng, variantIndex)` is called once
 * per variant with an RNG seeded from the name, so output is deterministic and
 * adding a sprite never changes any other sprite's look.
 */
export const variants = (name, draw, count = 4) => ({
  name,
  // Tells the client these are interchangeable looks (pick one per tile by
  // position), not animation frames (cycle through over time).
  mode: "variants",
  frames: range(count).map(i => draw(mulberry32(hash(`${name}:${i}`)), i)),
});

/**
 * Animated sprite. `draw(rng, frame)` gets a fresh RNG with the SAME seed for
 * every frame, so only the deliberately animated parts change between frames.
 */
export const animated = (name, count, draw, meta = {}) => ({
  name,
  frames: range(count).map(frame => draw(mulberry32(hash(name)), frame)),
  ...meta,
});

/** A single static sprite from an already-drawn buffer. */
export const still = (name, sprite, meta = {}) => ({
  name,
  frames: [sprite],
  ...meta,
});

/** Four-direction sprite set: `<name>_up|down|left|right`, `count` frames each. */
export const directional = (name, count, draw, meta = {}) =>
  DIRS.map(dir => ({
    name: `${name}_${dir}`,
    frames: range(count).map(frame => draw(dir, frame)),
    ...meta,
  }));
