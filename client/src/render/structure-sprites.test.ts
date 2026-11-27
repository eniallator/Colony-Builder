import { FACINGS, structureRegistry } from "@colony-builder/shared";
import { typedKeys } from "niall-utils/data";
import { describe, expect, it } from "vitest";

import {
  conveyorBends,
  conveyorSpriteName,
  conveyorSpriteNames,
  structureSprites,
} from "./structure-sprites.ts";

describe("conveyorSpriteName", () => {
  it.each(FACINGS)("names a straight belt facing %s after it", facing => {
    expect(conveyorSpriteName(facing)).toContain(facing);
    expect(conveyorSpriteName(facing, null)).toBe(conveyorSpriteName(facing));
  });

  it.each(FACINGS)("names the turns of a belt facing %s apart", facing => {
    const names = [
      conveyorSpriteName(facing),
      ...conveyorBends.map(bend => conveyorSpriteName(facing, bend)),
    ];

    expect(new Set(names).size).toBe(1 + conveyorBends.length);
    for (const bend of conveyorBends) {
      expect(conveyorSpriteName(facing, bend)).toContain(bend);
    }
  });

  it("lists a different sprite for every facing and bend", () => {
    expect(new Set(conveyorSpriteNames).size).toBe(
      FACINGS.length * (1 + conveyorBends.length)
    );
  });
});

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
