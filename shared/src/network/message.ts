import {
  encArrayOf,
  encExact,
  encObjectOf,
  encUnionOf,
  encVec2,
  type EncodableType,
} from "../encoding/index.ts";
import {
  encEntityId,
  encEntitySnapshot,
  encRegionId,
  encTileId,
  encWorldSnapshot,
} from "../world/index.ts";

// Client

export const encMoveMessage = encObjectOf({
  type: encExact("move"),
  position: encVec2,
});
export type MoveMessage = EncodableType<typeof encMoveMessage>;

export const encUnloadMessage = encObjectOf({
  type: encExact("unload"),
  ids: encArrayOf(encRegionId, { runPrecision: "u16" }),
});
export type UnloadMessage = EncodableType<typeof encUnloadMessage>;

export const encPlaceMessage = encObjectOf({
  type: encExact("place"),
  tile: encTileId,
  position: encVec2,
});
export type PlaceMessage = EncodableType<typeof encPlaceMessage>;

export const encClientMessage = encUnionOf(
  encMoveMessage,
  encUnloadMessage,
  encPlaceMessage
);
export type ClientMessage = EncodableType<typeof encClientMessage>;

// Server

export const encInitMessage = encObjectOf({
  type: encExact("init"),
  id: encEntityId,
});
export type InitMessage = EncodableType<typeof encInitMessage>;

export const encEntitiesMessage = encObjectOf({
  type: encExact("entities"),
  snapshot: encEntitySnapshot,
});
export type EntitiesMessage = EncodableType<typeof encEntitiesMessage>;

export const encLoadMessage = encObjectOf({
  type: encExact("load"),
  snapshot: encWorldSnapshot,
});
export type TerrainMessage = EncodableType<typeof encLoadMessage>;

export const encServerMessage = encUnionOf(
  encInitMessage,
  encEntitiesMessage,
  encLoadMessage
);
export type ServerMessage = EncodableType<typeof encServerMessage>;
