import {
  createPlayer,
  REGION_SIDE_LENGTH,
  regionPosToId,
  tileToId,
  World,
  worldPosToRegionIds,
  type EntityId,
  type RegionId,
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
  players: new Map(
    players.map(([id, regions]) => [
      id,
      { send: vi.fn(), loadedRegions: new Set(regions) },
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

  describe("place", () => {
    const worldWithOrigin = () => {
      const world = new World();
      world.terrain.add(
        origin,
        Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () => tileToId("grass"))
      );
      return world;
    };

    it("places the tile in the world", () => {
      const world = worldWithOrigin();
      const player = createPlayer(world);

      messageHandler(stateWith(world, [player, []]), player, {
        type: "place",
        position: Vector.create(3, 4),
        tile: tileToId("conveyor_right"),
      });

      expect(world.terrain.optTileAt(3, 4)).toBe("conveyor_right");
      expect(world.terrain.optTileAt(4, 4)).toBe("grass");
    });

    it("makes every player reload the changed region only", () => {
      const world = worldWithOrigin();
      const player = createPlayer(world);
      const other = createPlayer(world);
      const state = stateWith(
        world,
        [player, [origin, east]],
        [other, [origin, north]]
      );

      messageHandler(state, player, {
        type: "place",
        position: Vector.create(3, 4),
        tile: tileToId("stone"),
      });

      expect([...(state.players.get(player)?.loadedRegions ?? [])]).toEqual([
        east,
      ]);
      expect([...(state.players.get(other)?.loadedRegions ?? [])]).toEqual([
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
          tile: tileToId("stone"),
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
        { type: "gatherTile", target: Vector.create(3, 4), progress: 0 },
      ]);
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
        { type: "gatherStructure", regionId, subRegionId, progress: 0 },
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
