import {
  encArrayOf,
  encExact,
  encObjectOf,
  encUnionOf,
  encVec2,
  type EncodableType,
} from "../encoding/index.ts";
import { encEntityId } from "../entity/index.ts";
import { encEntitySnapshot, encTerrainSnapshot } from "../stores/index.ts";
import { encRegionId } from "../terrain/index.ts";

export const encMoveMessage = encObjectOf({
  type: encExact("move"),
  position: encVec2,
});
export type MoveMessage = EncodableType<typeof encMoveMessage>;

export const encUnloadMessage = encObjectOf({
  type: encExact("unload"),
  ids: encArrayOf(encRegionId, { runPrecision: "u16" }),
});

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

export const encTerrainMessage = encObjectOf({
  type: encExact("terrain"),
  snapshot: encTerrainSnapshot,
});
export type TerrainMessage = EncodableType<typeof encTerrainMessage>;

export const encClientMessage = encUnionOf(encMoveMessage, encUnloadMessage);
export type ClientMessage = EncodableType<typeof encClientMessage>;

export const encServerMessage = encUnionOf(
  encInitMessage,
  encEntitiesMessage,
  encTerrainMessage
);
export type ServerMessage = EncodableType<typeof encServerMessage>;
