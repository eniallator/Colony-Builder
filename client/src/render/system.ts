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

  for (const id of world.query("position")) {
    const pos = world.get(id, "position");

    const drawPos = toCanvasCoords(canvas, camera, pos);

    ctx.fillStyle = id === playerId ? "green" : "red";
    ctx.fillRect(drawPos.x() - 5, drawPos.y() - 5, 10, 10);
  }
};
