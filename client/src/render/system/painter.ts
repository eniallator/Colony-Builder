import { Vector } from "vectyped";

import type { Atlas, AtlasSprite, Cell } from "../atlas.ts";
import { frameOf } from "./frame.ts";

export interface Painter {
  ctx: CanvasRenderingContext2D;
  atlas: Atlas;
  textured: boolean;
  /** Seconds. */
  now: number;
}

const drawCell = (
  { ctx, atlas }: Painter,
  [x, y]: Cell,
  rows: number,
  topLeft: Vector<2>,
  size: number
) => {
  const { tileSize } = atlas;
  ctx.drawImage(
    atlas.sheet,
    ...Vector.create(x, y).multiply(tileSize).toArray(),
    tileSize,
    tileSize * rows,
    ...topLeft.toArray(),
    size,
    size * rows
  );
};

/**
 * Where `sprite` is drawn on screen when standing on `foot`, `size` pixels
 * wide: its top left corner and its width and height. Zoomed out it is a flat
 * square sitting on `foot`; otherwise it is centred horizontally with its
 * `ground` line at `foot`.
 */
export const spriteRect = (
  { atlas, textured }: Pick<Painter, "atlas" | "textured">,
  sprite: AtlasSprite,
  foot: Vector<2>,
  size: number
): { topLeft: Vector<2>; dimensions: Vector<2> } => {
  if (!textured) {
    const side = Math.max(1, Math.round(size));
    return {
      topLeft: foot
        .copy()
        .sub([side / 2, side])
        .round(),
      dimensions: Vector.create(side, side),
    };
  }

  return {
    topLeft: foot
      .copy()
      .sub([size / 2, (sprite.ground * size) / atlas.tileSize])
      .round(),
    dimensions: Vector.create(size, size * (sprite.rows ?? 1)),
  };
};

/**
 * Draws the sprite `name`, `size` pixels wide (and as many tiles tall as the
 * atlas says), standing on `foot`: centred horizontally, with the line the
 * sprite rests on (its `ground` in the atlas) at `foot`. Animated if `animate`
 * is set, otherwise its first frame. Zoomed out, it becomes a flat square of
 * the sprite's colour sitting on `foot`.
 */
const paintSprite = (
  painter: Painter,
  name: string,
  foot: Vector<2>,
  size: number,
  animate = false
) => {
  const { ctx, atlas, textured, now } = painter;
  const sprite = atlas.sprites.get(name);
  if (sprite == null) return;

  const { topLeft, dimensions } = spriteRect(painter, sprite, foot, size);
  if (!textured) {
    ctx.fillStyle = sprite.colour;
    ctx.fillRect(...topLeft.toArray(), ...dimensions.toArray());
    return;
  }

  const cell = animate
    ? frameOf(sprite, sprite.cells, atlas.tileSize, now)
    : sprite.cells.at(0);
  if (cell == null) return;

  drawCell(painter, cell, sprite.rows ?? 1, topLeft, size);
};

/**
 * Squared distance from `point` to the middle of the sprite `name` drawn on
 * `foot`, or null if the sprite is missing or `point` is outside its bounds.
 */
export const sqrDistToSpriteMiddle = (
  painter: Painter,
  name: string,
  foot: Vector<2>,
  size: number,
  point: Vector<2>
): number | null => {
  const sprite = painter.atlas.sprites.get(name);
  if (sprite == null) return null;

  const { topLeft, dimensions } = spriteRect(painter, sprite, foot, size);
  return point.inBounds(dimensions, topLeft)
    ? point.sqrDistTo(dimensions.copy().divide(2).add(topLeft))
    : null;
};

/**
 * Draws the sprite `name` standing on `foot`, with the `shadowName` sprite
 * beneath it (only when textured). Both rest on `foot` by their atlas ground
 * lines (a shadow's is the middle of its ellipse), so redrawing either one
 * needs no change here.
 */
export const paintWithShadow = (
  painter: Painter,
  shadowName: "shadow" | "shadow_small",
  name: string,
  foot: Vector<2>,
  size: number,
  animate?: boolean
) => {
  if (painter.textured) paintSprite(painter, shadowName, foot, size);
  paintSprite(painter, name, foot, size, animate);
};
