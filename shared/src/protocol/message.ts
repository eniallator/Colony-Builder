import { isNumber } from "deep-guards";

import { entityId, entityType, type EntityId } from "../entity/index.ts";
import { f32 } from "./codec.ts";
import {
  arrayOf,
  constant,
  encodable,
  object,
  optional,
  tupled,
  union,
  type EncodableType,
} from "./encodable.ts";

const finiteNumber = encodable(
  (value): value is number => isNumber(value) && Number.isFinite(value),
  f32
);

const vec2 = tupled(finiteNumber, finiteNumber);
export type Vec2 = EncodableType<typeof vec2>;

export const entitySnapshot = object({
  id: entityId,
  type: entityType,
  position: vec2,
  destination: optional(vec2),
  speed: optional(finiteNumber),
});
export type EntitySnapshot = EncodableType<typeof entitySnapshot>;

export const worldSnapshot = object(
  { entities: arrayOf(entitySnapshot) },
  (entities: EntitySnapshot[]) => ({ entities })
);
export type WorldSnapshot = EncodableType<typeof worldSnapshot>;

export const destinationMessage = object(
  { type: constant("destination"), position: vec2 },
  (position: Vec2) => ({ type: "destination", position })
);
export type DestinationMessage = EncodableType<typeof destinationMessage>;

export const initMessage = object(
  { type: constant("init"), id: entityId },
  (id: EntityId) => ({ type: "init", id })
);
export type InitMessage = EncodableType<typeof initMessage>;

export const snapshotMessage = object(
  { type: constant("snapshot"), snapshot: worldSnapshot },
  (snapshot: WorldSnapshot) => ({ type: "snapshot", snapshot })
);
export type SnapshotMessage = EncodableType<typeof snapshotMessage>;

export const clientMessage = union(destinationMessage);
export type ClientMessage = EncodableType<typeof clientMessage>;

export const serverMessage = union(initMessage, snapshotMessage);
export type ServerMessage = EncodableType<typeof serverMessage>;
