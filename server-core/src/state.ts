import type {
  EntityId,
  RegionId,
  ServerMessage,
  Time,
  World,
} from "@colony-builder/shared";

export interface PlayerState {
  send: (message: ServerMessage) => void;
  loadedRegions: Set<RegionId>;
  loadedEntities: Set<EntityId>;
}

export interface State {
  world: World;
  time: Time;
  players: Map<EntityId, PlayerState>;
}
