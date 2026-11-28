import {
  conveyorFootprint,
  facingOf,
  ITEM_TILES,
  REGION_SIDE_LENGTH,
  type EntityId,
  type Facing,
  type Task,
} from "@colony-builder/shared";
import { checkExhausted } from "niall-utils/core";
import { typedKeys } from "niall-utils/data";
import { Vector } from "vectyped";

import type { ClientSystem } from "../../system.ts";
import type { ClickableTarget } from "../../ui/clickable.ts";
import { getAtlas } from "../atlas.ts";
import { usesTextures } from "../sprite.ts";
import { conveyorSpriteName } from "../structure-sprites.ts";
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

/** Whether `task` is a gather that has started: it has an end time. */
const isGathering = (task: Task | undefined): boolean =>
  (task?.type === "gatherTile" || task?.type === "gatherStructure") &&
  task.endsAt != null;

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

  const clicked: [dist: number, target: ClickableTarget | null] = [
    Infinity,
    null,
  ];
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
    if (dist != null && clicked[0] > dist) {
      clicked[0] = dist;
      clicked[1] = target;
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
    // The tile it stands on picks which look it has, the same way for every
    // player and every frame.
    const variantTile = pos.copy().floor().toArray();
    aboveGround.push({
      depth: pos.y(),
      paint: () => {
        paintWithShadow(painter, "shadow_small", type, footOf(pos), pxPerTile, {
          variantTile,
        });
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

        const swinging = isGathering(
          world.entities.optGet(id, "taskList")?.tasks[0]
        );
        const spriteName = swinging
          ? `${entityType}_gather_${facing}`
          : `${entityType}_${facing}`;

        considerTarget(
          { domain: "entity", type: entityType, id },
          clickDist(spriteName, pos, pxPerTile)
        );

        aboveGround.push({
          depth: pos.y(),
          paint: () => {
            paintWithShadow(
              painter,
              "shadow",
              spriteName,
              footOf(pos),
              pxPerTile,
              // Animate while walking or swinging; otherwise stand still.
              { animate: destination != null || swinging }
            );
          },
        });
        break;
      }

      case "item": {
        const itemInv = world.entities.optGet(id, "inventory");
        const itemId = itemInv != null ? typedKeys(itemInv)[0] : null;

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

  clickDetails.setValue({
    target: clicked[1],
    worldPos: mouse.pos.copy().sub(origin).divide(pxPerTile),
    clicked: hasClicked,
  });
};
