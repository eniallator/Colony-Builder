import { movementSystem } from "@colony-builder/shared";
import { describe, expect, it } from "vitest";

import { clientSystems } from "./system.ts";

describe("clientSystems", () => {
  it("predicts movement locally", () => {
    expect(clientSystems).toContain(movementSystem);
  });
});
