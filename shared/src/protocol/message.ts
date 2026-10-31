import { isNumber, type Guard } from "deep-guards";
import { Vector } from "vectyped";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import type { Components } from "../entity/component.ts";
import { encEntityId, encEntityType, type EntityId } from "../entity/index.ts";
import { encRegionId, encTile } from "../terrain/types.ts";
import { codF32, codMap, codTupleOf } from "./codec.ts";
import {
  encExact,
  encFixedArrayOf,
  encMapOf,
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

export const encComponentSnapshot = encObjectOf<Components>({
  type: encEntityType,
  position: encVec2,
  destination: encOptional(encVec2),
  speed: encOptional(encFiniteNumber),
  conveyable: encOptional(encOneOf(true)),
});
export type ComponentSnapshot = EncodableType<typeof encComponentSnapshot>;

export const encEntitySnapshot = encMapOf(encEntityId, encComponentSnapshot);
export type EntitySnapshot = EncodableType<typeof encEntitySnapshot>;

export const encRegionTiles = encObjectOf({
  tiles: encFixedArrayOf(
    encFixedArrayOf(encTile, REGION_SIDE_LENGTH),
    REGION_SIDE_LENGTH
  ),
});
export type RegionTiles = EncodableType<typeof encRegionTiles>;

export const encTerrainSnapshot = encMapOf(encRegionId, encRegionTiles);
export type TerrainSnapshot = EncodableType<typeof encTerrainSnapshot>;

export const encWorldSnapshot = encObjectOf(
  { entities: encEntitySnapshot, terrain: encTerrainSnapshot },
  (entities: EntitySnapshot, terrain: TerrainSnapshot) => ({
    entities,
    terrain,
  })
);
export type WorldSnapshot = EncodableType<typeof encWorldSnapshot>;

export const encMoveMessage = encObjectOf(
  { type: encExact("move"), position: encVec2 },
  (x: number, y: number) => ({ type: "move", position: Vector.create(x, y) })
);
export type MoveMessage = EncodableType<typeof encMoveMessage>;

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

export const encClientMessage = encUnionOf(encMoveMessage);
export type ClientMessage = EncodableType<typeof encClientMessage>;

export const encServerMessage = encUnionOf(encInitMessage, encSnapshotMessage);
export type ServerMessage = EncodableType<typeof encServerMessage>;
