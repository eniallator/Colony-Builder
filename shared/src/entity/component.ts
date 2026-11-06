import { isNumber, isOneOf } from "deep-guards";
import { tuple, type UnionToTuple } from "niall-utils/core";

import { encInventory } from "../item/index.ts";
import { codF32 } from "../protocol/codec.ts";
import {
  encObjectOf,
  encodable,
  encOneOf,
  encOptional,
  encVec2,
  type EncodableType,
} from "../protocol/encodable.ts";
import { encEntityType } from "./types.ts";

const encFiniteNumber = encodable(
  (value): value is number => isNumber(value) && Number.isFinite(value),
  codF32
);

export const encComponents = encObjectOf({
  type: encEntityType,
  position: encVec2,
  destination: encOptional(encVec2),
  speed: encOptional(encFiniteNumber),
  conveyable: encOptional(encOneOf([true])),
  inventory: encOptional(encInventory),
});
export type Components = EncodableType<typeof encComponents>;

export type StoreComponents = {
  [K in keyof Components]-?: Exclude<Components[K], undefined>;
};

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

export type ComponentName = keyof Components;

export const componentNames = tuple(
  "type",
  "position",
  "destination",
  "speed",
  "conveyable",
  "inventory"
);
type _ComponentNamesComplete = AssertTrue<
  IsCompleteTuple<typeof componentNames, ComponentName>
>;

export const optionalComponentNames = tuple(
  "destination",
  "speed",
  "conveyable",
  "inventory"
);
type _OptionalComponentNamesComplete = AssertTrue<
  IsCompleteTuple<typeof optionalComponentNames, OptionalComponentName>
>;
export const isOptionalComponentName = isOneOf(...optionalComponentNames);
