import {
  conveyorFootprint,
  conveyorSpriteName,
  facingOf,
  ITEM_TILES,
  REGION_SIDE_LENGTH,
  type EntityId,
  type Facing,
} from "@colony-builder/shared";
import { checkExhausted } from "niall-utils/core";
import { Vector } from "vectyped";

import type { ClientSystem } from "../../system.ts";
import type { ClickableTarget } from "../../ui/clickable.ts";
import { getAtlas } from "../atlas.ts";
import { usesTextures } from "../sprite.ts";
import { conveyorBend } from "./conveyor-bend.ts";
import {
  paintConveyor,
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
const facings = new Map<EntityId, Facing>();

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
  clickDetails,
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
  for (const structure of world.structures.structuresAround(
    ...camera.center.toArray(),
    // A region of margin each side, since structures stick out of their tile.
    viewSide + 2 * REGION_SIDE_LENGTH
  )) {
    if (structure.type === "conveyor") {
      const bend = conveyorBend(world.structures, structure);
      aboveGround.push({
        // The belt's top edge, so everything standing on it is drawn after it.
        depth:
          structure.worldPos[1] + conveyorFootprint(structure.data).from[1],
        paint: () => {
          paintConveyor(painter, structure, bend, origin, pxPerTile);
        },
      });
      continue;
    }

    const { regionId, id, type, worldPos } = structure;
    const pos = Vector.create(...worldPos);
    aboveGround.push({
      depth: pos.y(),
      paint: () => {
        paintWithShadow(painter, "shadow_small", type, footOf(pos), pxPerTile);
      },
    });

    considerTarget(
      { domain: "structure", type, regionId, subRegionId: id },
      clickDist(type, pos, pxPerTile)
    );
  }

  // How far above the ground, in tiles, a belt under `pos` holds what rides it.
  const raiseAt = (pos: Vector<2>): number => {
    const belt = world.structures.structureAt("conveyor", pos.x(), pos.y());
    const raise =
      belt != null
        ? atlas.sprites.get(conveyorSpriteName(belt.data.facing))?.raise
        : undefined;
    return (raise ?? 0) / atlas.tileSize;
  };

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
            ? facingOf(destination.copy().sub(pos))
            : undefined;
        const facing = heading ?? facings.get(id) ?? "down";
        facings.set(id, facing);

        considerTarget(
          { domain: "entity", type: entityType, id },
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
          // Resting on a belt, it is held above the ground.
          const raised = pos.copy().sub([0, raiseAt(pos)]);
          considerTarget(
            { domain: "entity", type: entityType, id },
            clickDist(`item_${itemId}`, raised, ITEM_TILES * pxPerTile)
          );
          aboveGround.push({
            depth: pos.y(),
            paint: () => {
              paintWithShadow(
                painter,
                "shadow_small",
                `item_${itemId}`,
                footOf(raised),
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

  if (hasClicked) {
    // Where the click landed in the world: the inverse of `footOf`.
    const clickPos = mouse.pos.copy().sub(origin).divide(pxPerTile);
    clickDetails.setValue({
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      target: clicked?.[1] ?? null,
      worldPos: clickPos,
    });
  }
};
