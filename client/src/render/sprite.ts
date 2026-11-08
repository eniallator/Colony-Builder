import { isOneOf, type TypeFromGuard } from "deep-guards";
import { raise, tuple } from "niall-utils/core";
import { sequence } from "niall-utils/ui";
import { Vector } from "vectyped";

export const DIRECTIONS = tuple("up", "down", "left", "right");
export const isDirection = isOneOf(...DIRECTIONS);
export type Direction = TypeFromGuard<typeof isDirection>;

export const MIN_TEXTURE_PX_PER_TILE = 8;

export const usesTextures = (pxPerTile: number): boolean =>
  pxPerTile >= MIN_TEXTURE_PX_PER_TILE;

/**
 * Murmur3's 32-bit mixing step: every input bit affects every output bit. This
 * matters because `% count` keeps only the low bits, which a plain
 * multiply-and-xor of x and y leaves almost entirely determined by x alone
 * (whole rows end up one variant).
 */
const mix = (value: number): number => {
  let h = value;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

/**
 * Picks which of a tile's `count` interchangeable variants to show, from its
 * position alone. A given tile always looks the same, and neighbours differ.
 */
export const variantIndex = (x: number, y: number, count: number): number =>
  count <= 1 ? 0 : mix(Math.imul(x, 0x9e3779b1) ^ mix(y)) % count;

/** The frame of a looping animation showing at `nowMs` (see niall-utils `sequence`). */
export const frameAt = <F>(
  frames: F[],
  frameMs: number,
  nowMs: number
): { frame: F; delta: number; index: number } =>
  sequence(frames, frameMs)(nowMs);

/** Splits `[from, to)` into runs of consecutive equal values: `[value, start, end)`. */
export function* runsOf<T>(
  from: number,
  to: number,
  valueAt: (index: number) => T
): Generator<readonly [value: T, start: number, end: number]> {
  if (from >= to) return;

  let start = from;
  let current = valueAt(from);
  for (let i = from + 1; i < to; i++) {
    const value = valueAt(i);
    if (value !== current) {
      yield [current, start, i];
      start = i;
      current = value;
    }
  }
  yield [current, start, to];
}

const CARDINALS: Record<Direction, Vector<2>> = {
  up: Vector.UP,
  down: Vector.DOWN,
  left: Vector.LEFT,
  right: Vector.RIGHT,
};

/**
 * Which cardinal direction a movement `delta` points most towards, or
 * `undefined` if it is zero. Ties go to the earlier of up, down, left, right.
 */
export const directionOf = (delta: Vector<2>): Direction | undefined =>
  delta.getSquaredMagnitude() === 0
    ? undefined
    : DIRECTIONS.reduce((best, direction) =>
        delta.dot(CARDINALS[direction]) > delta.dot(CARDINALS[best])
          ? direction
          : best
      );

const patterns = new WeakMap<ImageBitmap, CanvasPattern>();

/** A repeating fill pattern for a tile bitmap, created once and reused. */
export const patternFor = (
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap
): CanvasPattern => {
  const cached = patterns.get(bitmap);
  if (cached != null) return cached;

  const pattern =
    ctx.createPattern(bitmap, "repeat") ??
    raise(new Error("Could not create a texture pattern"));
  patterns.set(bitmap, pattern);
  return pattern;
};
