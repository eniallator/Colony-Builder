import { typedKeys } from "niall-utils/data";
import { describe, expect, it } from "vitest";

import { conveyorSpriteNames } from "./conveyor.ts";
import { structureSprites } from "./sprites.ts";
import { structureRegistry } from "./types.ts";

describe("structureSprites", () => {
  it.each(typedKeys(structureRegistry))(
    "gives %s at least one sprite",
    type => {
      expect(structureSprites[type].length).toBeGreaterThan(0);
    }
  );

  it("gives a belt every sprite it is drawn with", () => {
    expect(structureSprites.conveyor).toEqual(conveyorSpriteNames);
  });
});
