import { movementSystem } from "@colony-builder/shared";
import { describe, expect, it } from "vitest";

import { serverSystems } from "./system.ts";

describe("serverSystems", () => {
  it("includes the movement system", () => {
    expect(serverSystems).toContain(movementSystem);
  });
});
