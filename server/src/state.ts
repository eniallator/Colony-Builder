import type { EntityId, RegionId, World } from "@colony-builder/shared";
import type { WebSocket } from "ws";

export interface PlayerState {
  socket: WebSocket;
  loadedRegions: Set<RegionId>;
}

export interface State {
  world: World;
  players: Map<EntityId, PlayerState>;
  /** The entities in each region, rebuilt at the start of every tick. */
  entityRegions: Map<RegionId, EntityId[]>;
}
