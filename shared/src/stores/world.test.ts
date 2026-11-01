import { describe, expect, it } from "vitest";

import { EntityStore } from "./entityStore.ts";
import { TerrainStore } from "./terrainStore.ts";
import { World } from "./world.ts";

describe("World", () => {
  it("exposes an entity store and a terrain store", () => {
    const world = new World();

    expect(world.entities).toBeInstanceOf(EntityStore);
    expect(world.terrain).toBeInstanceOf(TerrainStore);
  });

  it("returns the same stores on every access", () => {
    const world = new World();

    expect(world.entities).toBe(world.entities);
    expect(world.terrain).toBe(world.terrain);
  });

  it("does not share stores between worlds", () => {
    expect(new World().entities).not.toBe(new World().entities);
    expect(new World().terrain).not.toBe(new World().terrain);
  });
});
