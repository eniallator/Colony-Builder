import type { Tile } from "@colony-builder/shared";
import { isString } from "deep-guards";
import { raise } from "niall-utils/core";
import { memoize } from "niall-utils/data";
import { Vector } from "vectyped";

import type { ClientSystem } from "../../system.ts";
import { getAtlas, type Atlas, type AtlasSprite } from "../atlas.ts";
import { patternFor, runsOf, usesTextures, variantIndex } from "../sprite.ts";
import { frameOf } from "./frame.ts";
import { screenOrigin } from "./screen.ts";

type FillStyle = string | CanvasPattern;

const tileFillStyles = (
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  sprite: AtlasSprite,
  tile: Tile,
  textured: boolean,
  now: number
): FillStyle[] =>
  !textured
    ? [sprite.colour]
    : sprite.mode === "variants"
      ? sprite.frames.map(frame => patternFor(ctx, frame))
      : [
          patternFor(
            ctx,
            frameOf(sprite, sprite.frames, atlas.tileSize, now) ??
              raise(new Error(`Sprite "${tile}" has no frames`))
          ),
        ];

export const renderTiles: ClientSystem = ({
  canvas,
  ctx,
  camera,
  world,
  time,
}) => {
  const atlas = getAtlas();
  if (atlas == null) return;

  const pxPerTile = 2 ** camera.zoom;
  const textured = usesTextures(pxPerTile);
  const scale = pxPerTile / atlas.tileSize;
  const origin = screenOrigin(canvas, camera);

  const stylesFor = memoize(
    (tile: Tile) => {
      const sprite = atlas.sprites.get(tile);
      return sprite != null
        ? tileFillStyles(ctx, atlas, sprite, tile, textured, time.now)
        : undefined;
    },
    tile => tile
  );

  const cornerOf = (x: number, y: number) =>
    Vector.create(x, y).multiply(pxPerTile).add(origin).floor();

  const min = origin.copy().divide(-pxPerTile).floor();
  const max = Vector.create(canvas.width, canvas.height)
    .sub(origin)
    .divide(pxPerTile)
    .floor();

  const paths = new Map<FillStyle, Path2D>();
  for (let y = min.y(); y <= max.y(); y++) {
    const styleAt = (x: number) => {
      const tile = world.terrain.optTileAt(x, y);
      const styles = tile != null ? stylesFor(tile) : undefined;
      return styles?.[variantIndex(x, y, styles.length)];
    };

    // Merge neighbours with the same look into one rect.
    for (const [style, start, end] of runsOf(min.x(), max.x() + 1, styleAt)) {
      if (style == null) continue;

      const topLeft = cornerOf(start, y);
      const size = cornerOf(end, y + 1).sub(topLeft);
      const path = paths.get(style) ?? new Path2D();
      path.rect(...topLeft.toArray(), ...size.toArray());
      paths.set(style, path);
    }
  }

  // Minifying (zoomed out but still textured) is smoothed; magnifying is not.
  ctx.imageSmoothingEnabled = scale < 1;
  // Scale the 16px art to the tile size, anchored so each tile shows one whole texture.
  const [e, f] = origin.toArray();
  const patternTransform = { a: scale, d: scale, e, f };
  for (const [style, path] of paths) {
    if (!isString(style)) style.setTransform(patternTransform);
    ctx.fillStyle = style;
    ctx.fill(path);
  }
};
