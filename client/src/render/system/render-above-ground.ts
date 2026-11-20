import {
  ITEM_TILES,
  REGION_SIDE_LENGTH,
  type EntityId,
} from "@colony-builder/shared";
import { checkExhausted } from "niall-utils/core";
import { Vector } from "vectyped";

import type { ClientSystem } from "../../system.ts";
import type { ClickableTarget } from "../../ui/clickable.ts";
import { getAtlas } from "../atlas.ts";
import { directionOf, usesTextures, type Direction } from "../sprite.ts";
import {
  paintWithShadow,
  sqrDistToSpriteMiddle,
  type Painter,
} from "./painter.ts";
import { screenOrigin } from "./screen.ts";

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
 *
 * A left click picks the nearest sprite under the cursor as the `clickTarget`.
 */
export const renderAboveGround: ClientSystem = ({
  canvas,
  ctx,
  camera,
  world,
  time,
  mouse,
  clickTarget,
}) => {
  const atlas = getAtlas();
  if (atlas == null) return;

  const pxPerTile = 2 ** camera.zoom;
  const origin = screenOrigin(canvas, camera);
  const painter: Painter = {
    ctx,
    atlas,
    textured: usesTextures(pxPerTile),
    now: time.now,
  };
  ctx.imageSmoothingEnabled = pxPerTile < atlas.tileSize;

  const footOf = (pos: Vector<2>) => pos.copy().multiply(pxPerTile).add(origin);
  const aboveGround: AboveGround[] = [];

  let clicked: [dist: number, target: ClickableTarget] | null = null;
  const hasClicked = mouse.clicked("left");
  const clickDist = (
    name: string,
    pos: Vector<2>,
    size: number
  ): number | null =>
    hasClicked
      ? sqrDistToSpriteMiddle(painter, name, footOf(pos), size, mouse.pos)
      : null;
  const considerTarget = (target: ClickableTarget, dist: number | null) => {
    if (dist != null && (clicked == null || clicked[0] > dist)) {
      clicked = [dist, target];
    }
  };

  const viewSide = Math.max(canvas.width, canvas.height) / pxPerTile;
  for (const {
    regionId,
    id,
    type,
    worldPos,
  } of world.structures.structuresAround(
    ...camera.center.toArray(),
    // A region of margin each side, since structures stick out of their tile.
    viewSide + 2 * REGION_SIDE_LENGTH
  )) {
    const pos = Vector.create(...worldPos);
    aboveGround.push({
      depth: pos.y(),
      paint: () => {
        paintWithShadow(painter, "shadow_small", type, footOf(pos), pxPerTile);
      },
    });

    considerTarget(
      [`structure.${type}`, regionId, id],
      clickDist(type, pos, pxPerTile)
    );
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

        considerTarget(
          [`entity.${entityType}`, id],
          clickDist(`${entityType}_${facing}`, pos, pxPerTile)
        );

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
          considerTarget(
            ["entity.item", id],
            clickDist(`item_${itemId}`, pos, ITEM_TILES * pxPerTile)
          );
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
  for (const { paint } of aboveGround.sort((a, b) => a.depth - b.depth)) {
    paint();
  }

  // Forget entities that no longer exist.
  for (const id of new Set(facings.keys()).difference(seen)) facings.delete(id);

  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (clicked != null) clickTarget.setValue(clicked[1]);
};
