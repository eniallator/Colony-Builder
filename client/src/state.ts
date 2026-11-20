import type { ClientMessage, EntityId, World } from "@colony-builder/shared";

import type { Camera } from "./ui/camera.ts";
import type { ClickableHandlers, ClickableTarget } from "./ui/clickable.ts";
import type { Stateful } from "./ui/types.ts";

export interface State {
  camera: Camera;
  world: World;
  playerId?: EntityId;
  inventoryId?: EntityId;
  /** What the player last clicked, until its click action has finished. */
  clickTarget: Stateful<ClickableTarget | null>;
  clickHandlers: Partial<ClickableHandlers>;
  send: (message: ClientMessage) => void;
}
