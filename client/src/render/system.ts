import {
  CONVEYOR_SPEED,
  ITEM_TILES,
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
  /** Zoomed-out sprites collected as rects, drawn at the end: one fill per colour. */
  flat: Map<string, Path2D>;
}

const drawCell = (
  { ctx, atlas }: Painter,
  [x, y]: Cell,
  topLeft: Vector<2>,
  size: number
) => {
  const { tileSize } = atlas;
  ctx.drawImage(
    atlas.sheet,
    ...Vector.create(x, y).multiply(tileSize).toArray(),
    tileSize,
    tileSize,
    ...topLeft.toArray(),
    size,
    size
  );
};

/**
 * Draws the sprite `name`, `size` pixels square and centred on `centre`.
 * Animated if `animate` is set, otherwise its first frame. Zoomed out, it
 * becomes a flat square of the sprite's colour.
 */
const paintSprite = (
  painter: Painter,
  name: string,
  centre: Vector<2>,
  size: number,
  animate = false
) => {
  const sprite = painter.atlas.sprites.get(name);
  if (sprite == null) return;

  const topLeft = centre
    .copy()
    .sub(size / 2)
    .round();

  if (!painter.textured) {
    const side = Math.max(1, Math.round(size));
    const path = painter.flat.get(sprite.colour) ?? new Path2D();
    path.rect(...topLeft.toArray(), side, side);
    painter.flat.set(sprite.colour, path);
    return;
  }

  const cell = animate
    ? frameOf(sprite, sprite.cells, painter.atlas.tileSize, painter.nowMs)
    : sprite.cells.at(0);
  if (cell != null) drawCell(painter, cell, topLeft, size);
};

/**
 * Draws the sprite `name` with the `shadowName` sprite beneath it (only when
 * textured). The shadow is shifted so its ground line lines up with the line
 * the sprite rests on; both come from the atlas, so redrawing either one needs
 * no change here.
 */
const paintWithShadow = (
  painter: Painter,
  shadowName: "shadow" | "shadow_small",
  name: string,
  centre: Vector<2>,
  size: number,
  animate?: boolean
) => {
  const { atlas, textured } = painter;
  const sprite = atlas.sprites.get(name);
  const shadow = atlas.sprites.get(shadowName);
  if (textured && sprite != null && shadow != null) {
    const drop = ((sprite.ground - shadow.ground) * size) / atlas.tileSize;
    paintSprite(painter, shadowName, centre.copy().add([0, drop]), size);
  }
  paintSprite(painter, name, centre, size, animate);
};

/** Last direction each entity faced, so it keeps facing that way when it stops. */
const facings = new Map<EntityId, Direction>();

export const renderEntities: ClientSystem = ({
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
    flat: new Map(),
  };
  ctx.imageSmoothingEnabled = pxPerTile < atlas.tileSize;

  const seen = new Set<EntityId>();
  for (const id of world.entities.query("type", "position")) {
    seen.add(id);
    const entityType = world.entities.get(id, "type");
    const pos = world.entities.get(id, "position");
    const centre = pos.copy().multiply(pxPerTile).add(origin);

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

        paintWithShadow(
          painter,
          "shadow",
          `${entityType}_${facing}`,
          centre,
          pxPerTile,
          // Walk only while it has somewhere to go; otherwise stand still.
          destination != null
        );
        break;
      }

      case "item": {
        const itemId = world.entities
          .optGet(id, "inventory")
          ?.keys()
          .next().value;

        if (itemId != null) {
          paintWithShadow(
            painter,
            "shadow_small",
            `item_${itemId}`,
            centre,
            ITEM_TILES * pxPerTile
          );
        }
        break;
      }

      default:
        return checkExhausted(entityType);
    }
  }

  for (const [colour, path] of painter.flat) {
    ctx.fillStyle = colour;
    ctx.fill(path);
  }

  // Forget entities that no longer exist.
  for (const id of new Set(facings.keys()).difference(seen)) facings.delete(id);
};
