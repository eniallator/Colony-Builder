import { REGION_SIDE_LENGTH } from "../constants.ts";
import { encComponents, encEntityId } from "../entity/index.ts";
import { encRegionId, encTile } from "../terrain/types.ts";
import {
  encArrayOf,
  encExact,
  encMapOf,
  encObjectOf,
  encUnionOf,
  encVec2,
  type EncodableType,
} from "./encodable.ts";

export const encEntitySnapshot = encMapOf(encEntityId, encComponents);
export type EntitySnapshot = EncodableType<typeof encEntitySnapshot>;

export const encRegionTiles = encArrayOf(encTile, {
  fixedLength: REGION_SIDE_LENGTH ** 2,
});
export type RegionTiles = EncodableType<typeof encRegionTiles>;

export const encTerrainSnapshot = encMapOf(encRegionId, encRegionTiles);
export type TerrainSnapshot = EncodableType<typeof encTerrainSnapshot>;

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
