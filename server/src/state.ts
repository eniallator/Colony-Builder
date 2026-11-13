import type {
  EntityId,
  RegionId,
  ServerMessage,
  World,
} from "@colony-builder/shared";

export interface PlayerState {
  send: (message: ServerMessage) => void;
  loadedRegions: Set<RegionId>;
}

export interface State {
  world: World;
  players: Map<EntityId, PlayerState>;
}
