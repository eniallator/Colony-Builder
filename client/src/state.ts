import type { EntityId, EntityStore } from "@colony-builder/shared";

import type { Camera } from "./ui/camera.ts";

export interface State {
  camera: Camera;
  store: EntityStore;
  playerId?: EntityId;
}
