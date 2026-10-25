import type { EntityId, World } from "@colony-builder/shared";

import type { Camera } from "./ui/camera.ts";

export interface State {
  camera: Camera;
  world: World;
  playerId?: EntityId;
}
