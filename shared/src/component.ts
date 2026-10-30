import { isOneOf } from "deep-guards";
import { tuple, type UnionToTuple } from "niall-utils/core";
import type { Vector } from "vectyped";

import type { EntityType } from "./entity/types.ts";

export interface Components {
  type: EntityType;
  position: Vector<2>;
  destination?: Vector<2>;
  speed?: number;
  conveyable?: true;
}

export type StoreComponents = Required<Components>;

export type OptionalComponentName = {
  [C in keyof Components]-?: undefined extends Components[C] ? C : never;
}[keyof Components];

type IsCompleteTuple<
  T extends readonly PropertyKey[],
  U extends PropertyKey,
> = [U] extends [T[number]]
  ? [T[number]] extends [U]
    ? T["length"] extends UnionToTuple<U>["length"]
      ? true
      : false
    : false
  : false;

type AssertTrue<_T extends true> = never;

export const optionalComponentNames = tuple(
  "destination",
  "speed",
  "conveyable"
);
type _OptionalComponentNamesComplete = AssertTrue<
  IsCompleteTuple<typeof optionalComponentNames, OptionalComponentName>
>;
export const isOptionalComponentName = isOneOf(...optionalComponentNames);

export type ComponentName = keyof Components;

export const componentNames = tuple(
  "type",
  "position",
  "destination",
  "speed",
  "conveyable"
);
type _ComponentNamesComplete = AssertTrue<
  IsCompleteTuple<typeof componentNames, ComponentName>
>;
