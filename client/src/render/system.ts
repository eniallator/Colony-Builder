import { checkExhausted } from "niall-utils";

import type { ClientSystem } from "../system.ts";
import { toCanvasCoords } from "../ui/camera.ts";

export const prepareDraw: ClientSystem = ({ playerId, world, camera }) => {
  const playerPos =
    playerId != null ? world.optGet(playerId, "position") : undefined;
  if (playerPos != null) camera.center = playerPos;
};

export const renderSystem: ClientSystem = ({
  canvas,
  ctx,
  camera,
  playerId,
  world,
}) => {
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const id of world.query("entityType", "position")) {
    const entityType = world.get(id, "entityType");
    const pos = world.get(id, "position");

    const drawPos = toCanvasCoords(canvas, camera, pos);

    switch (entityType) {
      case "player": {
        ctx.fillStyle = id === playerId ? "green" : "red";

        ctx.fillRect(drawPos.x() - 5, drawPos.y() - 5, 10, 10);

        break;
      }

      case "item": {
        ctx.fillStyle = "blue";

        ctx.beginPath();
        ctx.arc(drawPos.x(), drawPos.y(), 5, 0, 2 * Math.PI);
        ctx.fill();

        break;
      }

      default:
        return checkExhausted(entityType);
    }
  }
};
