import {
  CONVEYOR_SPEED,
  ITEM_TILES,
  REGION_SIDE_LENGTH,
  type EntityId,
  type Tile,
} from "@colony-builder/shared";
import { isString } from "deep-guards";
import { checkExhausted, raise } from "niall-utils/core";
import { memoize } from "niall-utils/data";
import { Vector } from "vectyped";

import type { ClientSystem } from "../system.ts";
import { toCanvasCoords, type Camera } from "../ui/camera.ts";
import { getAtlas, type Atlas, type AtlasSprite, type Cell } from "./atlas.ts";
import {
  directionOf,
  frameAt,
  patternFor,
  runsOf,
  usesTextures,
  variantIndex,
  type Direction,
} from "./sprite.ts";

// Tiles that carry things along at a game speed (tiles per second). Their art
// declares how far it moves per frame (`stepPx`), so the animation keeps pace.
const TILE_SPEEDS: Partial<Record<Tile, number>> = {
  conveyor_up: CONVEYOR_SPEED,
  conveyor_down: CONVEYOR_SPEED,
  conveyor_left: CONVEYOR_SPEED,
  conveyor_right: CONVEYOR_SPEED,
};

/**
 * The one of `items` (one per animation frame of `sprite`) showing at `nowMs`.
 * Frame timing comes from the atlas: a fixed time, or, for animations that
 * depict motion at `tilesPerSecond`, the time to move `stepPx` pixels.
 */
const frameOf = <T>(
  sprite: AtlasSprite,
  items: T[],
  tileSize: number,
  nowMs: number,
  tilesPerSecond?: number
): T | undefined => {
  if (items.length <= 1) return items.at(0);

  const frameMs =
    sprite.frameMs ??
    (sprite.stepPx != null && tilesPerSecond != null
      ? (sprite.stepPx / tileSize / tilesPerSecond) * 1000
      : raise(new Error("Animated sprite has no frame timing in the atlas")));
  return frameAt(items, frameMs, nowMs).frame;
};

type FillStyle = string | CanvasPattern;

export const prepareRender: ClientSystem = ({
  ctx,
  canvas,
  playerId,
  world,
  camera,
}) => {
  const playerPos =
    playerId != null ? world.entities.optGet(playerId, "position") : undefined;
  if (playerPos != null) camera.center = playerPos;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const screenOrigin = (canvas: HTMLCanvasElement, camera: Camera): Vector<2> =>
  toCanvasCoords(canvas, camera, Vector.zero(2)).round();

const tileFillStyles = (
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  sprite: AtlasSprite,
  tile: Tile,
  textured: boolean,
  nowMs: number
): FillStyle[] =>
  !textured
    ? [sprite.colour]
    : sprite.mode === "variants"
      ? sprite.frames.map(frame => patternFor(ctx, frame))
      : [
          patternFor(
            ctx,
            frameOf(
              sprite,
              sprite.frames,
              atlas.tileSize,
              nowMs,
              TILE_SPEEDS[tile]
            ) ?? raise(new Error(`Sprite "${tile}" has no frames`))
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
  const nowMs = time.now * 1000;

  const stylesFor = memoize(
    (tile: Tile) => {
      const sprite = atlas.sprites.get(tile);
      return sprite != null
        ? tileFillStyles(ctx, atlas, sprite, tile, textured, nowMs)
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

interface Painter {
  ctx: CanvasRenderingContext2D;
  atlas: Atlas;
  textured: boolean;
  nowMs: number;
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
  const { ctx, atlas, textured, nowMs } = painter;
  const sprite = atlas.sprites.get(name);
  if (sprite == null) return;

  if (!textured) {
    const side = Math.max(1, Math.round(size));
    ctx.fillStyle = sprite.colour;
    ctx.fillRect(
      ...foot
        .copy()
        .sub([side / 2, side])
        .round()
        .toArray(),
      side,
      side
    );
    return;
  }

  const cell = animate
    ? frameOf(sprite, sprite.cells, atlas.tileSize, nowMs)
    : sprite.cells.at(0);
  if (cell == null) return;

  const topLeft = foot
    .copy()
    .sub([size / 2, (sprite.ground * size) / atlas.tileSize])
    .round();
  drawCell(painter, cell, sprite.rows ?? 1, topLeft, size);
};

/**
 * Draws the sprite `name` standing on `foot`, with the `shadowName` sprite
 * beneath it (only when textured). Both rest on `foot` by their atlas ground
 * lines (a shadow's is the middle of its ellipse), so redrawing either one
 * needs no change here.
 */
const paintWithShadow = (
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

/** Something above the ground, to be painted in depth order. */
interface AboveGround {
  /** World y of its feet: the larger it is, the nearer to the viewer. */
  depth: number;
  paint: () => void;
}

/** Last direction each entity faced, so it keeps facing that way when it stops. */
const facings = new Map<EntityId, Direction>();

/**
 * Draws everything above the ground (structures, players, robots, dropped
 * items), from back to front: the lower something's feet are on the screen,
 * the later it is drawn, so it covers whatever is behind it. Each stands with
 * its feet on its world position.
 */
export const renderAboveGround: ClientSystem = ({
  canvas,
  ctx,
  camera,
  world,
  time,
}) => {
  const atlas = getAtlas();
  if (atlas == null) return;

  const pxPerTile = 2 ** camera.zoom;
  const origin = screenOrigin(canvas, camera);
  const painter: Painter = {
    ctx,
    atlas,
    textured: usesTextures(pxPerTile),
    nowMs: time.now * 1000,
  };
  ctx.imageSmoothingEnabled = pxPerTile < atlas.tileSize;

  const footOf = (pos: Vector<2>) => pos.copy().multiply(pxPerTile).add(origin);
  const aboveGround: AboveGround[] = [];

  const viewSide = Math.max(canvas.width, canvas.height) / pxPerTile;
  for (const { id, worldPos } of world.structures.structuresAround(
    ...camera.center.toArray(),
    // A region of margin each side, since structures stick out of their tile.
    viewSide + 2 * REGION_SIDE_LENGTH
  )) {
    const pos = Vector.create(...worldPos);
    aboveGround.push({
      depth: pos.y(),
      paint: () => {
        paintWithShadow(painter, "shadow_small", id, footOf(pos), pxPerTile);
      },
    });
  }

  const seen = new Set<EntityId>();
  for (const id of world.entities.query("type", "position")) {
    seen.add(id);
    const entityType = world.entities.get(id, "type");
    const pos = world.entities.get(id, "position");

    switch (entityType) {
      case "player":
      case "robot": {
        const destination = world.entities.optGet(id, "destination");
        const heading =
          destination != null
            ? directionOf(destination.copy().sub(pos))
            : undefined;
        const facing = heading ?? facings.get(id) ?? "down";
        facings.set(id, facing);

        aboveGround.push({
          depth: pos.y(),
          paint: () => {
            paintWithShadow(
              painter,
              "shadow",
              `${entityType}_${facing}`,
              footOf(pos),
              pxPerTile,
              // Walk only while it has somewhere to go; otherwise stand still.
              destination != null
            );
          },
        });
        break;
      }

      case "item": {
        const itemId = world.entities
          .optGet(id, "inventory")
          ?.keys()
          .next().value;

        if (itemId != null) {
          aboveGround.push({
            depth: pos.y(),
            paint: () => {
              paintWithShadow(
                painter,
                "shadow_small",
                `item_${itemId}`,
                footOf(pos),
                ITEM_TILES * pxPerTile
              );
            },
          });
        }
        break;
      }

      default:
        return checkExhausted(entityType);
    }
  }

  // Back to front. The sort is stable, so equal depths keep their order.
  for (const { paint } of aboveGround.toSorted((a, b) => a.depth - b.depth)) {
    paint();
  }

  // Forget entities that no longer exist.
  for (const id of new Set(facings.keys()).difference(seen)) facings.delete(id);
};
