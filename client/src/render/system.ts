import {
  CONVEYOR_SPEED,
  ITEM_TILES,
  type EntityId,
  type Tile,
} from "@colony-builder/shared";
import { isString } from "deep-guards";
import { checkExhausted } from "niall-utils/core";
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

const DEFAULT_TILE_FRAME_MS = 120;
const BELT_TILES_PER_FRAME = 2 / 16;
// Time per belt frame so the chevrons keep pace with items riding the belt.
const BELT_FRAME_MS = (BELT_TILES_PER_FRAME / CONVEYOR_SPEED) * 1000;

const TILE_FRAME_MS: Partial<Record<Tile, number>> = {
  water: 300,
  conveyor_up: BELT_FRAME_MS,
  conveyor_down: BELT_FRAME_MS,
  conveyor_left: BELT_FRAME_MS,
  conveyor_right: BELT_FRAME_MS,
};
const WALK_FRAME_MS = 160;
// Item art fills its cell down to the bottom rows, so its shadow is drawn this
// fraction of the item size lower (2 art pixels) to show beneath the pile.
const ITEM_SHADOW_DROP = 2 / 16;

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
            frameAt(
              sprite.frames,
              TILE_FRAME_MS[tile] ?? DEFAULT_TILE_FRAME_MS,
              nowMs
            ).frame
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
        ? tileFillStyles(ctx, sprite, tile, textured, nowMs)
        : undefined;
    },
    tile => tile
  );

  // Screen position of a tile corner. Neighbours share corners, so there are
  // never gaps or overlaps, even at fractional zoom.
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
  cell: Cell,
  topLeft: Vector<2>,
  size: number
) => {
  const { tileSize } = atlas;
  ctx.drawImage(
    atlas.sheet,
    ...Vector.create(...cell)
      .multiply(tileSize)
      .toArray(),
    tileSize,
    tileSize,
    ...topLeft.toArray(),
    size,
    size
  );
};

/**
 * Draws the sprite `name`, `size` pixels square and centred on `centre`.
 * Animated if `frameMs` is given, otherwise its first frame. Zoomed out, it
 * becomes a flat square of the sprite's colour.
 */
const paintSprite = (
  painter: Painter,
  name: string,
  centre: Vector<2>,
  size: number,
  frameMs?: number
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

  const cell =
    frameMs != null
      ? frameAt(sprite.cells, frameMs, painter.nowMs).frame
      : sprite.cells.at(0);
  if (cell != null) drawCell(painter, cell, topLeft, size);
};

/** Soft ground shadow under an entity. Only drawn when textured. */
const paintShadow = (
  painter: Painter,
  name: "shadow" | "shadow_small",
  centre: Vector<2>,
  size: number
) => {
  if (painter.textured) paintSprite(painter, name, centre, size);
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

        paintShadow(painter, "shadow", centre, pxPerTile);
        paintSprite(
          painter,
          `${entityType}_${facing}`,
          centre,
          pxPerTile,
          // Walk only while it has somewhere to go; otherwise stand still.
          destination != null ? WALK_FRAME_MS : undefined
        );
        break;
      }

      case "item": {
        const itemId = world.entities
          .optGet(id, "inventory")
          ?.keys()
          .next().value;

        if (itemId != null) {
          const size = ITEM_TILES * pxPerTile;
          paintShadow(
            painter,
            "shadow_small",
            centre.copy().add(0, size * ITEM_SHADOW_DROP),
            size
          );
          paintSprite(painter, `item_${itemId}`, centre, size);
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
