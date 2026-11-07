import { ITEM_TILES, type ItemId, type Tile } from "@colony-builder/shared";
import { memoize } from "niall-utils";
import { checkExhausted } from "niall-utils/core";
import { Vector } from "vectyped";

import type { ClientSystem } from "../system.ts";
import { fromCanvasCoords, toCanvasCoords } from "../ui/camera.ts";
import { ITEM_RENDER_DATA } from "../ui/index.ts";

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

const TILE_COLOUR_LOOKUP: Record<Tile, string> = {
  grass: "#4a9c3c",
  swampland: "#4f6b3a",
  jungle: "#1f6b2a",
  water: "#2f6fdb",
  sand: "#e3d38a",
  stone: "#8a8a8a",
  iron_deposit: "#8fa3b8",
  conveyor_up: "#7a7a86",
  conveyor_left: "#6b6b76",
  conveyor_right: "#4d4d56",
  conveyor_down: "#40404a",
};

export const renderTiles: ClientSystem = ({ canvas, ctx, camera, world }) => {
  const minWorld = fromCanvasCoords(canvas, camera, Vector.zero(2)).floor();
  const maxWorld = fromCanvasCoords(
    canvas,
    camera,
    Vector.create(canvas.width, canvas.height)
  ).floor();

  const paths = new Map<Tile, Path2D>();

  for (let y = minWorld.y(); y <= maxWorld.y(); y++) {
    for (let x = minWorld.x(); x <= maxWorld.x(); x++) {
      const tile = world.terrain.optTileAt(x, y);
      if (tile == null) continue;

      const topLeft = toCanvasCoords(canvas, camera, Vector.create(x, y));
      const bottomRight = toCanvasCoords(
        canvas,
        camera,
        Vector.create(x + 1, y + 1)
      );

      const path = paths.get(tile) ?? new Path2D();
      path.rect(
        ...topLeft.floor().toArray(),
        // The line above mutates topLeft with .floor
        ...bottomRight.ceil().sub(topLeft).toArray()
      );
      paths.set(tile, path);
    }
  }

  for (const [tile, path] of paths) {
    ctx.fillStyle = TILE_COLOUR_LOOKUP[tile];
    ctx.fill(path);
  }
};

const getItemImage = memoize((id: ItemId): HTMLImageElement => {
  const image = new Image();
  image.src = `data:image/svg+xml,${encodeURIComponent(ITEM_RENDER_DATA[id].icon)}`;
  return image;
});

const renderItem = (
  ctx: CanvasRenderingContext2D,
  id: ItemId,
  centre: Vector<2>,
  size: number
) => {
  const { color } = ITEM_RENDER_DATA[id];
  const [x, y] = centre.toArray();

  const glow = ctx.createRadialGradient(x, y, 0, x, y, size);
  glow.addColorStop(0, color);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;

  ctx.beginPath();
  ctx.arc(x, y, size, 0, 2 * Math.PI);
  ctx.fill();

  const image = getItemImage(id);
  if (image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
  }
};

export const renderEntities: ClientSystem = ({
  canvas,
  ctx,
  camera,
  playerId,
  world,
}) => {
  for (const id of world.entities.query("type", "position")) {
    const entityType = world.entities.get(id, "type");
    const pos = world.entities.get(id, "position");

    const drawPos = toCanvasCoords(canvas, camera, pos);

    switch (entityType) {
      case "player": {
        ctx.fillStyle = id === playerId ? "green" : "red";
        ctx.fillRect(drawPos.x() - 5, drawPos.y() - 5, 10, 10);

        break;
      }

      case "robot": {
        ctx.fillStyle = "blue";
        ctx.fillRect(drawPos.x() - 5, drawPos.y() - 5, 10, 10);
        break;
      }

      case "item": {
        const itemId = world.entities
          .optGet(id, "inventory")
          ?.keys()
          .next().value;

        if (itemId != null) {
          renderItem(ctx, itemId, drawPos, ITEM_TILES * 2 ** camera.zoom);
        }

        break;
      }

      default:
        return checkExhausted(entityType);
    }
  }
};
