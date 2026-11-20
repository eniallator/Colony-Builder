import type { ClientSystem } from "../../system.ts";

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
