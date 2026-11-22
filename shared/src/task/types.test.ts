import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { regionPosToId, subRegionPosToId } from "../world/region.ts";
import {
  encGatherStructure,
  encGatherTile,
  encTask,
  encTaskList,
  type GatherStructure,
  type GatherTile,
  type Task,
  type TaskList,
} from "./types.ts";

const gatherTile: GatherTile = {
  type: "gatherTile",
  target: Vector.create(1.5, 2.5),
  endsAt: 0.5,
};

const gatherStructure: GatherStructure = {
  type: "gatherStructure",
  regionId: regionPosToId(-2, 3),
  subRegionId: subRegionPosToId(4, 5),
  endsAt: undefined,
};

const dropInventory: Task = {
  type: "dropInventory",
  target: Vector.create(3, 4),
};

const roundTrip = (task: Task) => encTask.decode(encTask.encode(task));

describe("encTask", () => {
  it.each([
    ["gatherTile", gatherTile],
    ["gatherStructure", gatherStructure],
    ["dropInventory", dropInventory],
  ])("round-trips a %s task", (_, task) => {
    expect(roundTrip(task)).toEqual(task);
  });
});

// The union refuses to encode a value no variant accepts, so the end time
// guard is checked on each variant's own encoding, which does decode it.
describe("task end time", () => {
  it("is rejected when negative on a gatherTile task", () => {
    const bytes = encGatherTile.encode({ ...gatherTile, endsAt: -1 });

    expect(encGatherTile.decode(bytes)).toBeUndefined();
  });

  it("is rejected when negative on a gatherStructure task", () => {
    const bytes = encGatherStructure.encode({
      ...gatherStructure,
      endsAt: -1,
    });

    expect(encGatherStructure.decode(bytes)).toBeUndefined();
  });
});

describe("encTaskList", () => {
  it("round-trips a list of mixed tasks and whether it repeats", () => {
    const list: TaskList = {
      tasks: [gatherTile, gatherStructure, dropInventory],
      repeat: true,
    };

    expect(encTaskList.decode(encTaskList.encode(list))).toEqual(list);
  });

  it("round-trips an empty list", () => {
    const list: TaskList = { tasks: [], repeat: false };

    expect(encTaskList.decode(encTaskList.encode(list))).toEqual(list);
  });
});
