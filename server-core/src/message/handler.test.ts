import {
  createPlayer,
  REGION_SIDE_LENGTH,
  regionPosToId,
  tiles,
  tileToId,
  unsafeEntityId,
  World,
  worldPosToRegionIds,
  type EntityId,
  type RegionId,
  type Time,
} from "@colony-builder/shared";
import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import type { State } from "../state.ts";
import { messageHandler } from "./handler.ts";

const origin = regionPosToId(0, 0);
const east = regionPosToId(1, 0);
const north = regionPosToId(0, -1);

const stateWith = (
  world: World,
  ...players: [EntityId, RegionId[]][]
): State => ({
  world,
  time: { start: 0, lastFrame: 0, now: 0, delta: 0 } satisfies Time,
  players: new Map(
    players.map(([id, regions]) => [
      id,
      {
        send: vi.fn(),
        loadedRegions: new Set(regions),
        loadedEntities: new Set(),
      },
    ])
  ),
});

describe("messageHandler", () => {
  describe("move", () => {
    it("sets the destination of the player", () => {
      const world = new World();
      const player = createPlayer(world);

      messageHandler(stateWith(world, [player, []]), player, {
        type: "move",
        position: Vector.create(3, 4),
      });

      expect(world.entities.get(player, "destination").toArray()).toEqual([
        3, 4,
      ]);
    });

    it("only affects the given player", () => {
      const world = new World();
      const player = createPlayer(world);
      const other = createPlayer(world);

      messageHandler(stateWith(world, [player, []], [other, []]), player, {
        type: "move",
        position: Vector.create(3, 4),
      });

      expect(world.entities.optGet(other, "destination")).toBeUndefined();
    });
  });

  describe("unload", () => {
    const loadedOf = (state: State, id: EntityId) => [
      ...(state.players.get(id)?.loadedRegions ?? []),
    ];

    it("forgets the unloaded regions of the player", () => {
      const world = new World();
      const player = createPlayer(world);
      const state = stateWith(world, [player, [origin, east, north]]);

      messageHandler(state, player, { type: "unload", ids: [origin, north] });

      expect(loadedOf(state, player)).toEqual([east]);
    });

    it("ignores ids the player has not loaded", () => {
      const world = new World();
      const player = createPlayer(world);
      const state = stateWith(world, [player, [origin]]);

      messageHandler(state, player, { type: "unload", ids: [east] });

      expect(loadedOf(state, player)).toEqual([origin]);
    });

    it("leaves everything loaded for an empty unload", () => {
      const world = new World();
      const player = createPlayer(world);
      const state = stateWith(world, [player, [origin, east]]);

      messageHandler(state, player, { type: "unload", ids: [] });

      expect(loadedOf(state, player)).toEqual([origin, east]);
    });

    it("only affects the given player", () => {
      const world = new World();
      const player = createPlayer(world);
      const other = createPlayer(world);
      const state = stateWith(
        world,
        [player, [origin, east]],
        [other, [origin, east]]
      );

      messageHandler(state, player, { type: "unload", ids: [origin] });

      expect(loadedOf(state, player)).toEqual([east]);
      expect(loadedOf(state, other)).toEqual([origin, east]);
    });

    it("throws for a player that is not connected", () => {
      const world = new World();
      const player = createPlayer(world);

      expect(() => {
        messageHandler(stateWith(world), player, { type: "unload", ids: [] });
      }).toThrow(`Player ${player} not found`);
    });
  });

  describe("unloadEntities", () => {
    const first = unsafeEntityId(1);
    const second = unsafeEntityId(2);
    const third = unsafeEntityId(3);

    // A connected player that the server has already sent `entities` to.
    const stateWithLoaded = (
      world: World,
      ...players: [EntityId, EntityId[]][]
    ): State => {
      const state = stateWith(world);
      for (const [id, entities] of players) {
        state.players.set(id, {
          send: vi.fn(),
          loadedRegions: new Set(),
          loadedEntities: new Set(entities),
        });
      }
      return state;
    };

    const loadedEntitiesOf = (state: State, id: EntityId) => [
      ...(state.players.get(id)?.loadedEntities ?? []),
    ];

    it("forgets the unloaded entities of the player", () => {
      const world = new World();
      const player = createPlayer(world);
      const state = stateWithLoaded(world, [player, [first, second, third]]);

      messageHandler(state, player, {
        type: "unloadEntities",
        ids: [first, third],
      });

      expect(loadedEntitiesOf(state, player)).toEqual([second]);
    });

    it("ignores ids the player has not loaded", () => {
      const world = new World();
      const player = createPlayer(world);
      const state = stateWithLoaded(world, [player, [first]]);

      messageHandler(state, player, { type: "unloadEntities", ids: [second] });

      expect(loadedEntitiesOf(state, player)).toEqual([first]);
    });

    it("only affects the given player", () => {
      const world = new World();
      const player = createPlayer(world);
      const other = createPlayer(world);
      const state = stateWithLoaded(
        world,
        [player, [first, second]],
        [other, [first, second]]
      );

      messageHandler(state, player, { type: "unloadEntities", ids: [first] });

      expect(loadedEntitiesOf(state, player)).toEqual([second]);
      expect(loadedEntitiesOf(state, other)).toEqual([first, second]);
    });

    it("throws for a player that is not connected", () => {
      const world = new World();
      const player = createPlayer(world);

      expect(() => {
        messageHandler(stateWith(world), player, {
          type: "unloadEntities",
          ids: [],
        });
      }).toThrow(`Player ${player} not found`);
    });
  });

  describe("place", () => {
    const [existing, placed] = tiles;

    const worldWithOrigin = () => {
      const world = new World();
      world.terrain.add(
        origin,
        Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () =>
          tileToId(existing)
        )
      );
      return world;
    };

    it("places the tile in the world", () => {
      const world = worldWithOrigin();
      const player = createPlayer(world);

      messageHandler(stateWith(world, [player, []]), player, {
        type: "place",
        position: Vector.create(3, 4),
        tile: tileToId(placed),
      });

      expect(world.terrain.optTileAt(3, 4)).toBe(placed);
      expect(world.terrain.optTileAt(4, 4)).toBe(existing);
    });

    it("marks only the changed region dirty", () => {
      const world = worldWithOrigin();
      world.terrain.add(east, world.terrain.get(origin).slice());
      world.flushAllDirtyRegions();
      const player = createPlayer(world);

      messageHandler(stateWith(world, [player, []]), player, {
        type: "place",
        position: Vector.create(3, 4),
        tile: tileToId(placed),
      });

      expect(world.flushAllDirtyRegions()).toEqual([origin]);
    });

    it("marks nothing dirty when the tile is already there", () => {
      const world = worldWithOrigin();
      world.flushAllDirtyRegions();
      const player = createPlayer(world);

      messageHandler(stateWith(world, [player, []]), player, {
        type: "place",
        position: Vector.create(3, 4),
        tile: tileToId(existing),
      });

      expect(world.flushAllDirtyRegions()).toEqual([]);
    });

    it("leaves what players have loaded to the dirty regions", () => {
      const world = worldWithOrigin();
      const player = createPlayer(world);
      const state = stateWith(world, [player, [origin, east, north]]);

      messageHandler(state, player, {
        type: "place",
        position: Vector.create(3, 4),
        tile: tileToId(placed),
      });

      expect([...(state.players.get(player)?.loadedRegions ?? [])]).toEqual([
        origin,
        east,
        north,
      ]);
    });

    it("throws when the region of the tile does not exist", () => {
      const world = new World();
      const player = createPlayer(world);

      expect(() => {
        messageHandler(stateWith(world, [player, []]), player, {
          type: "place",
          position: Vector.create(3, 4),
          tile: tileToId(placed),
        });
      }).toThrow("No region exists for world pos 3,4");
    });
  });

  describe("gatherTile", () => {
    it("queues a gather task for the tile on the player's task list", () => {
      const world = new World();
      const player = createPlayer(world);

      messageHandler(stateWith(world, [player, []]), player, {
        type: "gatherTile",
        position: Vector.create(3, 4),
      });

      expect(world.entities.get(player, "taskList").tasks).toEqual([
        { type: "gatherTile", target: Vector.create(3, 4), endsAt: undefined },
      ]);
    });

    it("marks the player dirty, so the new task is sent", () => {
      const world = new World();
      const player = createPlayer(world);
      world.entities.flushDirtyEntities();

      messageHandler(stateWith(world, [player, []]), player, {
        type: "gatherTile",
        position: Vector.create(3, 4),
      });

      expect(world.entities.flushDirtyEntities()).toEqual([player]);
    });

    it("queues it after the tasks already there", () => {
      const world = new World();
      const player = createPlayer(world);
      const state = stateWith(world, [player, []]);

      messageHandler(state, player, {
        type: "gatherTile",
        position: Vector.create(1, 1),
      });
      messageHandler(state, player, {
        type: "gatherTile",
        position: Vector.create(2, 2),
      });

      expect(
        world.entities.get(player, "taskList").tasks.map(task => task.type)
      ).toEqual(["gatherTile", "gatherTile"]);
    });

    it("only affects the given player", () => {
      const world = new World();
      const player = createPlayer(world);
      const other = createPlayer(world);

      messageHandler(stateWith(world, [player, []], [other, []]), player, {
        type: "gatherTile",
        position: Vector.create(3, 4),
      });

      expect(world.entities.get(other, "taskList").tasks).toEqual([]);
    });
  });

  describe("gatherStructure", () => {
    const [regionId, subRegionId] = worldPosToRegionIds(30, 40);

    it("queues a gather task for the structure on the player's task list", () => {
      const world = new World();
      const player = createPlayer(world);

      messageHandler(stateWith(world, [player, []]), player, {
        type: "gatherStructure",
        regionId,
        subRegionId,
      });

      expect(world.entities.get(player, "taskList").tasks).toEqual([
        { type: "gatherStructure", regionId, subRegionId, endsAt: undefined },
      ]);
    });

    it("only affects the given player", () => {
      const world = new World();
      const player = createPlayer(world);
      const other = createPlayer(world);

      messageHandler(stateWith(world, [player, []], [other, []]), player, {
        type: "gatherStructure",
        regionId,
        subRegionId,
      });

      expect(world.entities.get(other, "taskList").tasks).toEqual([]);
    });
  });

  it("throws on a message it does not know", () => {
    const world = new World();
    const player = createPlayer(world);

    expect(() => {
      // @ts-expect-error the message type is not part of the protocol
      messageHandler(stateWith(world), player, { type: "unknown" });
    }).toThrow("Value not exhausted");
  });
});
