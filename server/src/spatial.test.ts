import {
  createItem,
  createPlayer,
  LOADED_SIDE_LENGTH,
  REGION_SIDE_LENGTH,
  regionPosToId,
  World,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import { entitiesAround, indexEntities } from "./spatial.ts";
import type { State } from "./state.ts";

const half = LOADED_SIDE_LENGTH / 2;

const createState = (): State => ({
  world: new World(),
  players: new Map(),
  entityRegions: new Map(),
});

/** A world position in the middle of the given region. */
const centreOf = (regionX: number, regionY: number) =>
  Vector.create(
    (regionX + 0.5) * REGION_SIDE_LENGTH,
    (regionY + 0.5) * REGION_SIDE_LENGTH
  );

const index = (state: State) => {
  indexEntities({ world: state.world, dt: 0, state });
};

describe("indexEntities", () => {
  it("groups entities by the region they are in", () => {
    const state = createState();
    const a = createPlayer(state.world, centreOf(0, 0));
    const b = createItem(state.world, centreOf(0, 0));
    const c = createItem(state.world, centreOf(1, -1));

    index(state);

    expect(state.entityRegions).toEqual(
      new Map([
        [regionPosToId(0, 0), [a, b]],
        [regionPosToId(1, -1), [c]],
      ])
    );
  });

  it("puts negative positions in the region below zero", () => {
    const state = createState();
    const id = createItem(state.world, Vector.create(-0.5, -0.5));

    index(state);

    expect(state.entityRegions).toEqual(
      new Map([[regionPosToId(-1, -1), [id]]])
    );
  });

  it("skips entities without a position", () => {
    const state = createState();
    state.world.entities.spawn({ speed: 1 });

    index(state);

    expect(state.entityRegions).toEqual(new Map());
  });

  it("is empty for an empty world", () => {
    const state = createState();

    index(state);

    expect(state.entityRegions).toEqual(new Map());
  });

  it("replaces the previous index, following moved and removed entities", () => {
    const state = createState();
    const mover = createPlayer(state.world, centreOf(0, 0));
    const leaver = createItem(state.world, centreOf(0, 0));
    index(state);

    state.world.entities.get(mover, "position").setHead(centreOf(3, 2));
    state.world.entities.despawn(leaver);
    index(state);

    expect(state.entityRegions).toEqual(
      new Map([[regionPosToId(3, 2), [mover]]])
    );
  });
});

describe("entitiesAround", () => {
  const stateWith = (...regions: [x: number, y: number][]) => {
    const state = createState();
    const ids = regions.map(([x, y]) =>
      createItem(state.world, centreOf(x, y))
    );
    index(state);
    return { state, ids };
  };

  it("includes entities in the same region", () => {
    const { state, ids } = stateWith([0, 0]);

    expect(entitiesAround(state, ...centreOf(0, 0).toArray())).toEqual(ids);
  });

  it("includes the lower edge of the square and excludes the upper edge", () => {
    const { state, ids } = stateWith(
      [-half, 0],
      [half - 1, 0],
      [0, -half],
      [0, half - 1],
      [half, 0],
      [-half - 1, 0],
      [0, half],
      [0, -half - 1]
    );

    expect(entitiesAround(state, ...centreOf(0, 0).toArray())).toEqual(
      expect.arrayContaining(ids.slice(0, 4))
    );
    expect(entitiesAround(state, ...centreOf(0, 0).toArray())).toHaveLength(4);
  });

  it("is centred on the region of the given position", () => {
    const { state, ids } = stateWith([0, 0], [5, 5], [5 + half, 5]);

    expect(entitiesAround(state, ...centreOf(5, 5).toArray())).toEqual(
      expect.arrayContaining([ids[0], ids[1]])
    );
    expect(entitiesAround(state, ...centreOf(5, 5).toArray())).not.toContain(
      ids[2]
    );
  });

  it("returns every entity of a region", () => {
    const state = createState();
    const a = createItem(state.world, centreOf(2, 2));
    const b = createItem(state.world, centreOf(2, 2));
    index(state);

    expect(entitiesAround(state, ...centreOf(0, 0).toArray())).toEqual([a, b]);
  });

  it("is empty before the index has been built", () => {
    expect(entitiesAround(createState(), 0, 0)).toEqual([]);
  });
});
