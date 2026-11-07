import { isInteger } from "deep-guards";
import { tuple, unsafeTag, type Tagged } from "niall-utils/core";

import {
  codTagged,
  codU32,
  encodable,
  encOneOf,
  type EncodableType,
} from "../encoding/index.ts";

export type EntityId = Tagged<number, "EntityId">;
export const unsafeEntityId = unsafeTag<EntityId>();

export const encEntityId = encodable<EntityId>(
  (value): value is EntityId =>
    isInteger(value) && Number.isFinite(value) && value >= 0,
  codTagged(codU32)
);

export const allEntityTypes = tuple("player", "robot", "item");
export const encEntityType = encOneOf(allEntityTypes);
export type EntityType = EncodableType<typeof encEntityType>;
