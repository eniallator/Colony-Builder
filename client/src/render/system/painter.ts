import {
  CONVEYOR_SPEED,
  conveyorLengthToTiles,
  conveyorSpan,
  type ConveyorData,
} from "@colony-builder/shared";
import { Vector } from "vectyped";

import type { Atlas, AtlasSprite, Cell } from "../atlas.ts";
import { patternFor, variantIndex } from "../sprite.ts";
import { conveyorSpriteName, type ConveyorBend } from "../structure-sprites.ts";
import { frameOf } from "./frame.ts";

export interface Painter {
  ctx: CanvasRenderingContext2D;
  atlas: Atlas;
  textured: boolean;
  /** Seconds. */
  now: number;
}

export interface PaintOptions {
  /** Play the sprite's animation instead of showing its first frame. */
  animate?: boolean;
  /** The tile whose position picks which look of a sprite made of variants to show. */
  variantTile?: readonly [x: number, y: number];
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
 * is set, otherwise its first frame. A sprite made of variants shows the one
 * that `variantTile` picks (the first without it), as tiles do. Zoomed out, it
 * becomes a flat square of the sprite's colour sitting on `foot`.
 */
const paintSprite = (
  painter: Painter,
  name: string,
  foot: Vector<2>,
  size: number,
  { animate = false, variantTile = [0, 0] }: PaintOptions = {}
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

  const cell =
    sprite.mode === "variants"
      ? sprite.cells.at(variantIndex(...variantTile, sprite.cells.length))
      : animate
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
 * Draws a belt as repeating tiles of its sprites: its head, with the bend if
 * it has one, then the rest of it straight. It lies on the ground, so it casts
 * no shadow. The tiles line up with its first one, so the animation runs on
 * unbroken from the head to the end. A world position is on screen at
 * `position * pxPerTile + origin`.
 */
export const paintConveyor = (
  painter: Painter,
  { worldPos, data }: { worldPos: [x: number, y: number]; data: ConveyorData },
  bend: ConveyorBend | null,
  origin: Vector<2>,
  pxPerTile: number
) => {
  const { ctx, atlas, textured, now } = painter;
  const anchor = Vector.create(...worldPos);
  const tiles = conveyorLengthToTiles(data.length);
  const screenOf = (world: Vector<2>) =>
    world.copy().multiply(pxPerTile).add(origin).round();

  const firstTileCorner = screenOf(anchor.copy().sub(0.5));
  const scale = pxPerTile / atlas.tileSize;

  const spans = [
    [conveyorSpriteName(data.facing, bend), 0, Math.min(1, tiles)],
    [conveyorSpriteName(data.facing), 1, tiles],
  ] as const;
  for (const [name, from, to] of spans) {
    const sprite = atlas.sprites.get(name);
    if (sprite == null || to <= from) continue;

    if (textured) {
      const frame = frameOf(
        sprite,
        sprite.frames,
        atlas.tileSize,
        now,
        CONVEYOR_SPEED
      );
      if (frame == null) continue;

      const pattern = patternFor(ctx, frame);
      const [e, f] = firstTileCorner.toArray();
      pattern.setTransform({ a: scale, d: scale, e, f });
      ctx.fillStyle = pattern;
    } else {
      ctx.fillStyle = sprite.colour;
    }

    const span = conveyorSpan(data.facing, from, to);
    const topLeft = screenOf(anchor.copy().add(span.from));
    const bottomRight = screenOf(anchor.copy().add(span.from).add(span.size));
    ctx.fillRect(...topLeft.toArray(), ...bottomRight.sub(topLeft).toArray());
  }
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
  options?: PaintOptions
) => {
  if (painter.textured) paintSprite(painter, shadowName, foot, size);
  paintSprite(painter, name, foot, size, options);
};
