import { describe, expect, it, vi } from "vitest";

import { appMethods } from "./types.ts";

describe("appMethods", () => {
  it("returns the methods it was given", () => {
    const methods = { init: vi.fn(), animationFrame: vi.fn() };

    expect(appMethods(methods)).toBe(methods);
  });
});
