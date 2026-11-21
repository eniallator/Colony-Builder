import type { ClientMessage, EntityId, World } from "@colony-builder/shared";

import type { Camera } from "./ui/camera.ts";
import type { ClickDetails } from "./ui/clickable.ts";
import type { Stateful } from "./ui/types.ts";

export interface State {
  camera: Camera;
  world: World;
  playerId?: EntityId;
  inventoryId?: EntityId;
  clickDetails: Stateful<ClickDetails | null>;
  send: (message: ClientMessage) => void;
}
