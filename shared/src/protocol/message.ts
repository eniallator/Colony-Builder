import { isExact, isNumber } from "deep-guards";
import { Vector } from "vectyped";

import type { Components } from "../component.ts";
import { entityId, entityType, type EntityId } from "../entity/index.ts";
import { f32, mapCodec, u8 } from "./codec.ts";
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

const trueEncodable = encodable(
  isExact(true),
  mapCodec(
    u8,
    () => 0,
    () => true
  )
);

const tup2 = tupled(finiteNumber, finiteNumber);

const isVec2 = (value: unknown): value is Vector<2> =>
  value instanceof Vector && value.isSize(2) && value.every(Number.isFinite);

const vec2 = encodable(
  isVec2,
  mapCodec(
    tup2.codec,
    vec => vec.toArray(),
    tup => Vector.create(...tup)
  )
);

export const entitySnapshot = object<{ id: EntityId } & Components>({
  id: entityId,
  type: entityType,
  position: vec2,
  destination: optional(vec2),
  speed: optional(finiteNumber),
  conveyable: optional(trueEncodable),
});
export type EntitySnapshot = EncodableType<typeof entitySnapshot>;

export const worldSnapshot = object(
  { entities: arrayOf(entitySnapshot) },
  (entities: EntitySnapshot[]) => ({ entities })
);
export type WorldSnapshot = EncodableType<typeof worldSnapshot>;

export const destinationMessage = object(
  { type: constant("destination"), position: vec2 },
  (x: number, y: number) => ({
    type: "destination",
    position: Vector.create(x, y),
  })
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
