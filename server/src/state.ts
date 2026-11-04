import type { EntityId, RegionId, World } from "@colony-builder/shared";
import type { WebSocket } from "ws";

export interface PlayerState {
  socket: WebSocket;
  loadedRegions: Set<RegionId>;
}

export interface State {
  world: World;
  players: Map<EntityId, PlayerState>;
}
