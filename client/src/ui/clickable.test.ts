import {
  regionPosToId,
  subRegionPosToId,
  unsafeEntityId,
  type EntityId,
  type RegionId,
  type SubRegionId,
} from "@colony-builder/shared";
import { describe, expect, it, vi } from "vitest";

import {
  actionFor,
  clickableCallback,
  clickableSelect,
  isSameTarget,
  type ClickableTarget,
} from "./clickable.ts";

const entity = (id: number): ClickableTarget => [
  "entity.robot",
  unsafeEntityId(id),
];
const structure = (region: number, sub: number): ClickableTarget => [
  "structure.tree",
  regionPosToId(region, 0),
  subRegionPosToId(sub, 0),
];

describe("isSameTarget", () => {
  it("is true for equal targets, and for two nulls", () => {
    expect(isSameTarget(entity(1), entity(1))).toBe(true);
    expect(isSameTarget(structure(1, 2), structure(1, 2))).toBe(true);
    expect(isSameTarget(null, null)).toBe(true);
  });

  it("tells apart different ids and types", () => {
    expect(isSameTarget(entity(1), entity(2))).toBe(false);
    expect(isSameTarget(entity(1), ["entity.player", unsafeEntityId(1)])).toBe(
      false
    );
  });

  it("needs both ids of a structure to match", () => {
    expect(isSameTarget(structure(1, 2), structure(2, 2))).toBe(false);
    expect(isSameTarget(structure(1, 2), structure(1, 3))).toBe(false);
  });

  it("is false when only one side is null", () => {
    expect(isSameTarget(entity(1), null)).toBe(false);
    expect(isSameTarget(null, entity(1))).toBe(false);
  });
});

describe("actionFor", () => {
  it("is undefined when nothing handles the target's type", () => {
    expect(actionFor({}, entity(1))).toBeUndefined();
  });

  it("binds an entity's id to a callback", () => {
    const onClick = vi.fn<(id: EntityId) => void>();
    const action = actionFor(
      { "entity.robot": clickableCallback(onClick) },
      entity(7)
    );

    expect(action?.type).toBe("Callback");
    if (action?.type === "Callback") action.run();
    expect(onClick).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("binds both ids of a structure to a callback", () => {
    const onClick = vi.fn<(region: RegionId, sub: SubRegionId) => void>();
    const action = actionFor(
      { "structure.tree": clickableCallback(onClick) },
      structure(3, 4)
    );

    expect(action?.type).toBe("Callback");
    if (action?.type === "Callback") action.run();
    expect(onClick).toHaveBeenCalledExactlyOnceWith(
      regionPosToId(3, 0),
      subRegionPosToId(4, 0)
    );
  });

  it("offers a select's options and passes the picked value before the ids", () => {
    const onSelect = vi.fn<(value: string, id: EntityId) => void>();
    const options = [
      { label: "Follow", value: "follow" },
      { label: "Stop", value: "stop" },
    ];
    const action = actionFor(
      { "entity.robot": clickableSelect(options, onSelect) },
      entity(5)
    );

    expect(action?.type).toBe("Select");
    if (action?.type !== "Select") return;
    expect(action.options).toEqual(options);

    action.run("stop");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("stop", 5);
  });
});
