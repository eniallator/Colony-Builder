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
import { encodable } from "./encodable.ts";

const isFiniteNumber: Guard<number> = (value): value is number =>
  isNumber(value) && Number.isFinite(value);

const isVec2 = isTupleOf(isFiniteNumber, isFiniteNumber);
type Vec2 = TypeFromGuard<typeof isVec2>;
export const entitySnapshot = encodable(
  isExactObjectOf({
    id: isEntityId,
    position: isVec2,
    destination: isOptional(isVec2),
    speed: isFiniteNumber,
  })
);
export type EntitySnapshot = TypeFromGuard<typeof entitySnapshot.guard>;

export const worldSnapshot = encodable(
  isExactObjectOf({ entities: isArrayOf(entitySnapshot.guard) }),
  (entities: EntitySnapshot[]) => ({ entities })
);
export type WorldSnapshot = TypeFromGuard<typeof worldSnapshot.guard>;

export const destinationMessage = encodable(
  isDiscriminatedObjectOf("destination", isExactObjectOf({ position: isVec2 })),
  (position: Vec2) => ({ type: "destination", position })
);
export type DestinationMessage = TypeFromGuard<typeof destinationMessage.guard>;

export const initMessage = encodable(
  isDiscriminatedObjectOf("init", isExactObjectOf({ id: isEntityId })),
  (id: EntityId) => ({ type: "init", id })
);
export type InitMessage = TypeFromGuard<typeof initMessage.guard>;

export const snapshotMessage = encodable(
  isDiscriminatedObjectOf(
    "snapshot",
    isExactObjectOf({ snapshot: worldSnapshot.guard })
  ),
  (snapshot: WorldSnapshot) => ({ type: "snapshot", snapshot })
);
export type SnapshotMessage = TypeFromGuard<typeof snapshotMessage.guard>;

export const clientMessage = encodable(isUnionOf(destinationMessage.guard));
export type ClientMessage = TypeFromGuard<typeof clientMessage.guard>;

export const serverMessage = encodable(
  isUnionOf(initMessage.guard, snapshotMessage.guard)
);
export type ServerMessage = TypeFromGuard<typeof serverMessage.guard>;
