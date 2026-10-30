import { isNumber, type Guard } from "deep-guards";
import { Vector } from "vectyped";

import type { Components } from "../component.ts";
import { encEntityId, encEntityType, type EntityId } from "../entity/index.ts";
import { codF32, codMap, codTupleOf } from "./codec.ts";
import {
  encArrayOf,
  encExact,
  encObjectOf,
  encodable,
  encOneOf,
  encOptional,
  encUnionOf,
  type EncodableType,
} from "./encodable.ts";

const encFiniteNumber = encodable(
  (value): value is number => isNumber(value) && Number.isFinite(value),
  codF32
);

const isVec =
  <const N extends number>(size: N): Guard<Vector<N>> =>
  (value): value is Vector<N> =>
    value instanceof Vector &&
    value.isSize(size) &&
    value.every(Number.isFinite);

const encVec2 = encodable<Vector<2>>(
  isVec(2),
  codMap(
    codTupleOf(codF32, codF32),
    vec => vec.toArray(),
    tup => Vector.create(...tup)
  )
);

export const encEntitySnapshot = encObjectOf<{ id: EntityId } & Components>({
  id: encEntityId,
  type: encEntityType,
  position: encVec2,
  destination: encOptional(encVec2),
  speed: encOptional(encFiniteNumber),
  conveyable: encOptional(encOneOf(true)),
});
export type EntitySnapshot = EncodableType<typeof encEntitySnapshot>;

export const encWorldSnapshot = encObjectOf(
  { entities: encArrayOf(encEntitySnapshot) },
  (entities: EntitySnapshot[]) => ({ entities })
);
export type WorldSnapshot = EncodableType<typeof encWorldSnapshot>;

export const encDestinationMessage = encObjectOf(
  { type: encExact("destination"), position: encVec2 },
  (x: number, y: number) => ({
    type: "destination",
    position: Vector.create(x, y),
  })
);
export type DestinationMessage = EncodableType<typeof encDestinationMessage>;

export const encInitMessage = encObjectOf(
  { type: encExact("init"), id: encEntityId },
  (id: EntityId) => ({ type: "init", id })
);
export type InitMessage = EncodableType<typeof encInitMessage>;

export const encSnapshotMessage = encObjectOf(
  { type: encExact("snapshot"), snapshot: encWorldSnapshot },
  (snapshot: WorldSnapshot) => ({ type: "snapshot", snapshot })
);
export type SnapshotMessage = EncodableType<typeof encSnapshotMessage>;

export const encClientMessage = encUnionOf(encDestinationMessage);
export type ClientMessage = EncodableType<typeof encClientMessage>;

export const encServerMessage = encUnionOf(encInitMessage, encSnapshotMessage);
export type ServerMessage = EncodableType<typeof encServerMessage>;
