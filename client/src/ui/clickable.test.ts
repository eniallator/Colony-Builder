import {
  allEntityTypes,
  regionPosToId,
  structureRegistry,
  subRegionPosToId,
  unsafeEntityId,
  type EntityType,
  type StructureType,
} from "@colony-builder/shared";
import { raise } from "niall-utils/core";
import { typedKeys } from "niall-utils/data";
import { describe, expect, it, vi } from "vitest";

import {
  clickableCallback,
  clickableSelect,
  isSameTarget,
  type ClickableTarget,
} from "./clickable.ts";

const [entityType, otherEntityType] = allEntityTypes;

const structureTypeAt = (index: number): StructureType =>
  typedKeys(structureRegistry)[index] ??
  raise(new Error(`No structure type at ${index}`));
const [structureType, otherStructureType] = [
  structureTypeAt(0),
  structureTypeAt(1),
];

const entity = (
  id: number,
  type: EntityType = entityType
): ClickableTarget => ({
  domain: "entity",
  type,
  id: unsafeEntityId(id),
});

const structure = (
  region: number,
  sub: number,
  type: StructureType = structureType
): ClickableTarget => ({
  domain: "structure",
  type,
  regionId: regionPosToId(region, 0),
  subRegionId: subRegionPosToId(sub, 0),
});

describe("isSameTarget", () => {
  it("is true for the same target, equal targets and two nulls", () => {
    const target = entity(1);

    expect(isSameTarget(target, target)).toBe(true);
    expect(isSameTarget(entity(1), entity(1))).toBe(true);
    expect(isSameTarget(structure(1, 2), structure(1, 2))).toBe(true);
    expect(isSameTarget(null, null)).toBe(true);
  });

  it("tells apart entities with a different id or type", () => {
    expect(isSameTarget(entity(1), entity(2))).toBe(false);
    expect(
      isSameTarget(entity(1, entityType), entity(1, otherEntityType))
    ).toBe(false);
  });

  it("needs the type and both ids of a structure to match", () => {
    expect(isSameTarget(structure(1, 2), structure(2, 2))).toBe(false);
    expect(isSameTarget(structure(1, 2), structure(1, 3))).toBe(false);
    expect(
      isSameTarget(
        structure(1, 2, structureType),
        structure(1, 2, otherStructureType)
      )
    ).toBe(false);
  });

  it("never matches an entity with a structure", () => {
    expect(isSameTarget(entity(1), structure(1, 1))).toBe(false);
    expect(isSameTarget(structure(1, 1), entity(1))).toBe(false);
  });

  it("is false when only one side is null", () => {
    expect(isSameTarget(entity(1), null)).toBe(false);
    expect(isSameTarget(null, structure(1, 2))).toBe(false);
  });
});

describe("clickableCallback", () => {
  it("wraps the callback", () => {
    const onClick = vi.fn();
    const run = clickableCallback(onClick);

    expect(run.type).toBe("callback");
    run.onClick();
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("clickableSelect", () => {
  it("keeps the options and passes the picked value to the handler", () => {
    const onSelect = vi.fn<(value: string) => void>();
    const options = [
      { label: "Follow", value: "follow" },
      { label: "Stop", value: "stop" },
    ];
    const run = clickableSelect("Pick one", options, onSelect);

    expect(run.type).toBe("select");
    expect(run.title).toBe("Pick one");
    expect(run.options).toEqual(options);
    run.onSelect("stop");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("stop");
  });
});
