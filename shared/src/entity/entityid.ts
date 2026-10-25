import { isInteger, type Guard } from "deep-guards";
import { unsafeTag, type Tagged } from "niall-utils/core";

export type EntityId = Tagged<number, "EntityId">;
export const unsafeEntityId = unsafeTag<EntityId>();
export const isEntityId: Guard<EntityId> = (
  value: unknown
): value is EntityId =>
  isInteger(value) && Number.isFinite(value) && value >= 0;
