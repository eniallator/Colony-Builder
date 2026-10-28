import { isInteger } from "deep-guards";
import { tuple, unsafeTag, type Tagged } from "niall-utils/core";

import { taggedCodec, u32 } from "../protocol/codec.ts";
import { encodable, oneOf, type EncodableType } from "../protocol/encodable.ts";

export type EntityId = Tagged<number, "EntityId">;
export const unsafeEntityId = unsafeTag<EntityId>();

export const entityId = encodable<EntityId>(
  (value): value is EntityId =>
    isInteger(value) && Number.isFinite(value) && value >= 0,
  taggedCodec(u32)
);

export const allEntityTypes = tuple("player", "item");
export const entityType = oneOf(...allEntityTypes);
export type EntityType = EncodableType<typeof entityType>;
