import { isNumber, type Guard } from "deep-guards";
import { Vector } from "vectyped";

import { REGION_SIDE_LENGTH } from "../constants.ts";
import type { Components } from "../entity/component.ts";
import { encEntityId, encEntityType } from "../entity/index.ts";
import { encRegionId, encTile } from "../terrain/types.ts";
import { codF32, codMap, codTupleOf } from "./codec.ts";
import {
  encArrayOf,
  encExact,
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
    codTupleOf<[number, number]>(codF32, codF32),
    vec => vec.toArray(),
    ([x, y]) => Vector.create(x, y)
  )
);

export const encComponentSnapshot = encObjectOf<Components>({
  type: encEntityType,
  position: encVec2,
  destination: encOptional(encVec2),
  speed: encOptional(encFiniteNumber),
  conveyable: encOptional(encOneOf([true])),
});
export type ComponentSnapshot = EncodableType<typeof encComponentSnapshot>;

export const encEntitySnapshot = encMapOf(encEntityId, encComponentSnapshot);
export type EntitySnapshot = EncodableType<typeof encEntitySnapshot>;

export const encRegionTiles = encObjectOf({
  tiles: encArrayOf(encTile, { fixedLength: REGION_SIDE_LENGTH ** 2 }),
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
