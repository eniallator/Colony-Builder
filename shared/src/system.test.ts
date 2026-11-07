import { describe, expect, it } from "vitest";

import { selfMovementSystem } from "./entity/system.ts";
import { predictionSystems } from "./system.ts";
import { taskSystem } from "./task/system.ts";
import { conveyorMovementSystem } from "./terrain/system.ts";

describe("predictionSystems", () => {
  it("includes every simulation system", () => {
    expect(predictionSystems).toEqual(
      expect.arrayContaining([
        taskSystem,
        selfMovementSystem,
        conveyorMovementSystem,
      ])
    );
  });

  it("runs tasks before movement so new destinations apply the same tick", () => {
    expect(predictionSystems.indexOf(taskSystem)).toBeLessThan(
      predictionSystems.indexOf(selfMovementSystem)
    );
  });
});
