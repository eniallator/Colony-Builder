import {
  isArrayOf,
  isDiscriminatedObjectOf,
  isExactObjectOf,
  isNumber,
  isOptional,
  isTupleOf,
  isUnionOf,
  type Guard,
  type TypeFromGuard,
} from "deep-guards";

import { isEntityId, type EntityId } from "../entity/index.ts";

const isFiniteNumber: Guard<number> = (value): value is number =>
  isNumber(value) && Number.isFinite(value);

const isVec2 = isTupleOf(isFiniteNumber, isFiniteNumber);
type Vec2 = TypeFromGuard<typeof isVec2>;
export const isEntitySnapshot = isExactObjectOf({
  id: isEntityId,
  position: isVec2,
  destination: isOptional(isVec2),
  speed: isFiniteNumber,
});
export type EntitySnapshot = TypeFromGuard<typeof isEntitySnapshot>;

export const isWorldSnapshot = isExactObjectOf({
  entities: isArrayOf(isEntitySnapshot),
});
export type WorldSnapshot = TypeFromGuard<typeof isWorldSnapshot>;

export const isDestinationMessage = isDiscriminatedObjectOf(
  "destination",
  isExactObjectOf({ position: isVec2 })
);
export type DestinationMessage = TypeFromGuard<typeof isDestinationMessage>;
export const createDestinationMessage = (
  position: Vec2
): DestinationMessage => ({ type: "destination", position });

export const isInitMessage = isDiscriminatedObjectOf(
  "init",
  isExactObjectOf({ id: isEntityId })
);
export type InitMessage = TypeFromGuard<typeof isInitMessage>;
export const createInitMessage = (id: EntityId): InitMessage => ({
  type: "init",
  id,
});

export const isSnapshotMessage = isDiscriminatedObjectOf(
  "snapshot",
  isExactObjectOf({ snapshot: isWorldSnapshot })
);
export type SnapshotMessage = TypeFromGuard<typeof isSnapshotMessage>;
export const createSnapshotMessage = (
  snapshot: WorldSnapshot
): SnapshotMessage => ({ type: "snapshot", snapshot });

export const isClientMessage = isDestinationMessage;
export type ClientMessage = TypeFromGuard<typeof isClientMessage>;

export const isServerMessage = isUnionOf(isInitMessage, isSnapshotMessage);
export type ServerMessage = TypeFromGuard<typeof isServerMessage>;
