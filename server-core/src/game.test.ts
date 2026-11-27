import {
  encClientMessage,
  encServerMessage,
  LOADED_SIDE_LENGTH,
  PLAYER_SPEED,
  REGION_SIDE_LENGTH,
  regionIdToPos,
  regionPosToId,
  subRegionPosToId,
  TASK_DURATION,
  tiles,
  tileToId,
  TPS,
  unsafeEntityId,
  type EntityId,
  type RegionId,
  type WorldGenerator,
} from "@colony-builder/shared";
import { raise } from "niall-utils/core";
import { mapFilter, mapFind } from "niall-utils/functional";
import { Vector } from "vectyped";
import { describe, expect, it, vi, type Mock } from "vitest";

import {
  createGame,
  type Connection,
  type Game,
  type PlayerSession,
} from "./game.ts";

interface Client {
  sent: Mock<Connection["send"]>;
  session: PlayerSession;
}

const DT = 1 / TPS;

/** One flat tile and no structures. Most tests are not about the terrain, and the real generator is slow. */
const flatGenerator: WorldGenerator = () => ({
  tiles: Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () =>
    tileToId(tiles[0])
  ),
  structures: new Map(),
});

const createTestGame = () => createGame(flatGenerator);

const tick = (game: Game) => {
  game.tick(DT);
};

const connect = (game: Game): Client => {
  const sent = vi.fn<Connection["send"]>();
  return { sent, session: game.connect({ send: sent }) };
};

const requestDestination = (client: Client, position: [number, number]) => {
  client.session.receive(
    encClientMessage.encode({
      type: "move",
      position: Vector.create(...position),
    })
  );
};

const requestUnload = (client: Client, ids: RegionId[]) => {
  client.session.receive(encClientMessage.encode({ type: "unload", ids }));
};

const requestUnloadEntities = (client: Client, ids: EntityId[]) => {
  client.session.receive(
    encClientMessage.encode({ type: "unloadEntities", ids })
  );
};

const received = ({ sent }: Client) =>
  sent.mock.calls.map(([bytes]) => encServerMessage.decode(bytes));

const playerIdOf = (client: Client) =>
  mapFind(received(client), message =>
    message?.type === "init" ? message.id : null
  ) ?? raise(new Error("No init message was sent"));

const snapshots = (client: Client) =>
  mapFilter(received(client), message =>
    message?.type === "entities" ? message.snapshot : null
  );

const despawnedIds = (client: Client) =>
  received(client).flatMap(message =>
    message?.type === "entities" ? [...message.despawned] : []
  );

const terrainSnapshots = (client: Client) =>
  mapFilter(received(client), message =>
    message?.type === "load" ? message.snapshot : null
  );

const messageTypes = (client: Client) =>
  received(client).map(message => message?.type);

const latestEntities = (client: Client) =>
  snapshots(client).at(-1) ?? raise(new Error("No snapshot was sent"));

const ticksToTravel = (distance: number) =>
  Math.ceil((distance * TPS) / PLAYER_SPEED);

describe("connections", () => {
  it("tells a new player their id", () => {
    const client = connect(createTestGame());

    expect(received(client)).toEqual([
      {
        type: "init",
        id: playerIdOf(client),
        time: { start: 0, lastFrame: 0, now: 0, delta: 0 },
      },
    ]);
  });

  it("tells a player who connects later how far the game has got", () => {
    const game = createTestGame();
    tick(game);
    tick(game);

    const [init] = received(connect(game));

    expect(init?.type === "init" && init.time.now).toBeCloseTo(2 * DT);
  });

  it("gives each player a different id", () => {
    const game = createTestGame();

    expect(playerIdOf(connect(game))).not.toBe(playerIdOf(connect(game)));
  });

  it("removes a player when they disconnect", () => {
    const game = createTestGame();
    const leaver = connect(game);
    const stayer = connect(game);
    const leaverId = playerIdOf(leaver);

    leaver.session.disconnect();
    tick(game);

    expect(latestEntities(stayer).has(leaverId)).toBe(false);
    expect(leaver.sent).toHaveBeenCalledOnce();
  });

  it("tells the other players the player has gone when they disconnect", () => {
    const game = createTestGame();
    const leaver = connect(game);
    const stayer = connect(game);
    tick(game);

    leaver.session.disconnect();
    tick(game);

    expect(despawnedIds(stayer)).toEqual([playerIdOf(leaver)]);
  });

  it("does not tell a player about the despawn of an entity it never had", () => {
    const game = createTestGame();
    const leaver = connect(game);
    const stayer = connect(game);

    leaver.session.disconnect();
    tick(game);

    expect(despawnedIds(stayer)).toEqual([]);
  });
});

describe("snapshots", () => {
  it("is not sent before the first tick", () => {
    const client = connect(createTestGame());

    expect(snapshots(client)).toHaveLength(0);
  });

  it("is sent to every connected player on the first tick", () => {
    const game = createTestGame();
    const [a, b] = [connect(game), connect(game)];

    tick(game);

    expect(snapshots(a)).toHaveLength(1);
    expect(snapshots(b)).toHaveLength(1);
  });

  it("is not sent again while nothing changes", () => {
    const game = createTestGame();
    const client = connect(game);

    for (let i = 0; i < 5; i++) tick(game);

    expect(snapshots(client)).toHaveLength(1);
  });

  it("is sent every tick an entity is changing", () => {
    const game = createTestGame();
    const client = connect(game);
    requestDestination(client, [100, 0]);

    for (let i = 0; i < 3; i++) tick(game);

    expect(snapshots(client)).toHaveLength(3);
  });

  it("only includes the entities that changed", () => {
    const game = createTestGame();
    const [mover, idle] = [connect(game), connect(game)];
    tick(game);

    requestDestination(mover, [100, 0]);
    tick(game);

    expect([...latestEntities(mover).keys()]).toEqual([playerIdOf(mover)]);
    expect(snapshots(idle)).toHaveLength(2);
    expect([...latestEntities(idle).keys()]).toEqual([playerIdOf(mover)]);
  });

  it("sends a change to every player who has the entity", () => {
    const game = createTestGame();
    const [mover, watcher] = [connect(game), connect(game)];
    tick(game);

    requestDestination(mover, [100, 0]);
    tick(game);

    const position = latestEntities(watcher).get(playerIdOf(mover))?.position;
    expect(position?.x()).toBeGreaterThan(0);
  });

  it("resends the entities the client says it unloaded", () => {
    const game = createTestGame();
    const [client, other] = [connect(game), connect(game)];
    tick(game);

    requestUnloadEntities(client, [playerIdOf(other)]);
    tick(game);

    expect([...latestEntities(client).keys()]).toEqual([playerIdOf(other)]);
  });

  it("ignores an unload for entities it never sent", () => {
    const game = createTestGame();
    const client = connect(game);
    tick(game);

    requestUnloadEntities(client, [unsafeEntityId(99_999)]);
    tick(game);

    expect(snapshots(client)).toHaveLength(1);
  });

  it("only resends to the player who unloaded", () => {
    const game = createTestGame();
    const [unloader, other] = [connect(game), connect(game)];
    tick(game);

    requestUnloadEntities(unloader, [playerIdOf(other)]);
    tick(game);

    expect(snapshots(unloader)).toHaveLength(2);
    expect(snapshots(other)).toHaveLength(1);
  });

  it("includes every player", () => {
    const game = createTestGame();
    const [a, b] = [connect(game), connect(game)];

    tick(game);

    const players = [...latestEntities(a)].filter(
      ([, { type }]) => type === "player"
    );
    expect(players.map(([id]) => id)).toEqual([playerIdOf(a), playerIdOf(b)]);
  });

  it("only includes the entities near each player", () => {
    const game = createTestGame();
    const [stayer, traveller] = [connect(game), connect(game)];
    requestDestination(traveller, [10_000, 0]);

    // Walk far enough to leave the loaded square of regions around the stayer.
    const outside = (LOADED_SIDE_LENGTH / 2 + 1) * REGION_SIDE_LENGTH;
    for (let i = 0; i < ticksToTravel(outside); i++) tick(game);
    const newcomer = connect(game);
    tick(game);

    const nearNewcomer = [...latestEntities(newcomer).keys()];
    expect(nearNewcomer).toContain(playerIdOf(stayer));
    expect(nearNewcomer).toContain(playerIdOf(newcomer));
    expect(nearNewcomer).not.toContain(playerIdOf(traveller));
    expect([...latestEntities(traveller).keys()]).toEqual([
      playerIdOf(traveller),
    ]);
  });
});

describe("terrain", () => {
  const half = LOADED_SIDE_LENGTH / 2;

  it("is not sent before the first tick", () => {
    const client = connect(createTestGame());

    expect(terrainSnapshots(client)).toHaveLength(0);
  });

  it("generates varied terrain with the real world generator by default", () => {
    const game = createGame();
    const client = connect(game);

    tick(game);

    const [first] = terrainSnapshots(client);
    const distinctTiles = new Set(
      [...(first?.values() ?? [])].flatMap(region => region.tiles)
    );
    expect(distinctTiles.size).toBeGreaterThan(1);
  });

  it("sends the regions around a new player on the first tick", () => {
    const game = createTestGame();
    const client = connect(game);

    tick(game);

    const [first] = terrainSnapshots(client);
    expect(first?.size).toBe(LOADED_SIDE_LENGTH ** 2);
    expect(first?.has(regionPosToId(-half, -half))).toBe(true);
    expect(first?.has(regionPosToId(half - 1, half - 1))).toBe(true);
    expect(first?.has(regionPosToId(half, 0))).toBe(false);
  });

  it("is sent after the init message and before the entities", () => {
    const game = createTestGame();
    const client = connect(game);

    tick(game);

    expect(messageTypes(client)).toEqual(["init", "load", "entities"]);
  });

  it("does not resend regions the player already has", () => {
    const game = createTestGame();
    const client = connect(game);

    tick(game);
    tick(game);

    expect(terrainSnapshots(client)).toHaveLength(1);
  });

  it("sends each player their own regions", () => {
    const game = createTestGame();
    const early = connect(game);
    tick(game);
    const late = connect(game);
    tick(game);

    expect(terrainSnapshots(early)).toHaveLength(1);
    expect(terrainSnapshots(late)).toHaveLength(1);
    expect(terrainSnapshots(late)[0]?.size).toBe(LOADED_SIDE_LENGTH ** 2);
  });

  it("sends only the newly in-range regions when the player crosses into a new region", () => {
    const game = createTestGame();
    const client = connect(game);
    requestDestination(client, [100, 0]);

    // Walk just far enough to step into region 1.
    for (let i = 0; i < ticksToTravel(REGION_SIDE_LENGTH); i++) tick(game);

    const snapshotsSent = terrainSnapshots(client);
    expect(snapshotsSent).toHaveLength(2);
    expect(snapshotsSent[1]?.size).toBe(LOADED_SIDE_LENGTH);
    expect(
      [...(snapshotsSent[1]?.keys() ?? [])].every(
        id => regionIdToPos(id)[0] === half
      )
    ).toBe(true);
  });

  it("resends regions the client says it unloaded", () => {
    const game = createTestGame();
    const client = connect(game);
    tick(game);

    requestUnload(client, [regionPosToId(0, 0), regionPosToId(1, 1)]);
    tick(game);

    const snapshotsSent = terrainSnapshots(client);
    expect(snapshotsSent).toHaveLength(2);
    expect([...(snapshotsSent[1]?.keys() ?? [])]).toEqual([
      regionPosToId(0, 0),
      regionPosToId(1, 1),
    ]);
  });

  it("ignores an unload for regions it never sent", () => {
    const game = createTestGame();
    const client = connect(game);
    tick(game);

    requestUnload(client, [regionPosToId(99, 99)]);
    tick(game);

    expect(terrainSnapshots(client)).toHaveLength(1);
  });

  it("only resends to the player who unloaded", () => {
    const game = createTestGame();
    const [unloader, other] = [connect(game), connect(game)];
    tick(game);

    requestUnload(unloader, [regionPosToId(0, 0)]);
    tick(game);

    expect(terrainSnapshots(unloader)).toHaveLength(2);
    expect(terrainSnapshots(other)).toHaveLength(1);
  });
});

describe("changed regions", () => {
  const origin = regionPosToId(0, 0);
  const [baseTile, changedTile] = tiles;
  const treeSub = subRegionPosToId(0, 0);

  /** Flat terrain with a tree in the corner of every region. */
  const treeGenerator: WorldGenerator = id => ({
    ...flatGenerator(id),
    structures: new Map([[treeSub, { type: "tree", data: true }]]),
  });

  const requestPlace = (client: Client, position: [number, number]) => {
    client.session.receive(
      encClientMessage.encode({
        type: "place",
        position: Vector.create(...position),
        tile: tileToId(changedTile),
      })
    );
  };

  const requestGather = (client: Client) => {
    client.session.receive(
      encClientMessage.encode({
        type: "gatherStructure",
        regionId: origin,
        subRegionId: treeSub,
      })
    );
  };

  // Time to walk to the tree and start the timer, plus the timer itself.
  const startTicks = 5;
  const gatherTicks = startTicks + Math.ceil(TASK_DURATION * TPS) + 2;

  /** Every region sent after the first load, in the order they were sent. */
  const resent = (client: Client) =>
    terrainSnapshots(client)
      .slice(1)
      .flatMap(snapshot => [...snapshot.entries()]);

  const tileIndex = (x: number, y: number) => y * REGION_SIDE_LENGTH + x;

  it("resends a region to a player who has it when a tile is placed in it", () => {
    const game = createTestGame();
    const client = connect(game);
    tick(game);

    requestPlace(client, [3.5, 5.5]);
    tick(game);

    const sent = resent(client);
    expect(sent.map(([id]) => id)).toEqual([origin]);
    expect(sent[0]?.[1].tiles[tileIndex(3, 5)]).toBe(tileToId(changedTile));
    expect(sent[0]?.[1].tiles[tileIndex(5, 3)]).toBe(tileToId(baseTile));
  });

  it("resends the region on the same tick as the change", () => {
    const game = createTestGame();
    const client = connect(game);
    tick(game);

    const before = received(client).length;

    requestPlace(client, [3.5, 5.5]);
    tick(game);

    expect(messageTypes(client).slice(before)).toEqual(["load"]);
  });

  it("resends only the region that changed", () => {
    const game = createTestGame();
    const client = connect(game);
    tick(game);

    requestPlace(client, [REGION_SIDE_LENGTH + 0.5, 0.5]);
    tick(game);

    expect(resent(client).map(([id]) => id)).toEqual([regionPosToId(1, 0)]);
  });

  it("resends a region once when it changed several times in a tick", () => {
    const game = createTestGame();
    const client = connect(game);
    tick(game);

    requestPlace(client, [1.5, 1.5]);
    requestPlace(client, [2.5, 2.5]);
    requestPlace(client, [3.5, 3.5]);
    tick(game);

    expect(resent(client)).toHaveLength(1);
  });

  it("resends each region that changed in a tick", () => {
    const game = createTestGame();
    const client = connect(game);
    tick(game);

    requestPlace(client, [0.5, 0.5]);
    requestPlace(client, [-0.5, -0.5]);
    tick(game);

    expect(new Set(resent(client).map(([id]) => id))).toEqual(
      new Set([origin, regionPosToId(-1, -1)])
    );
  });

  it("does not resend a changed region again on the next tick", () => {
    const game = createTestGame();
    const client = connect(game);
    tick(game);

    requestPlace(client, [3.5, 5.5]);
    tick(game);
    tick(game);
    tick(game);

    expect(resent(client)).toHaveLength(1);
  });

  it("resends the changed region to every player who has it", () => {
    const game = createTestGame();
    const [placer, watcher] = [connect(game), connect(game)];
    tick(game);

    requestPlace(placer, [3.5, 5.5]);
    tick(game);

    expect(resent(placer).map(([id]) => id)).toEqual([origin]);
    expect(resent(watcher).map(([id]) => id)).toEqual([origin]);
  });

  it("does not resend to a player who is too far away to have it", () => {
    const game = createTestGame();
    const [stayer, traveller] = [connect(game), connect(game)];
    requestDestination(traveller, [100_000, 0]);
    const outside = (LOADED_SIDE_LENGTH / 2 + 1) * REGION_SIDE_LENGTH;
    for (let i = 0; i < ticksToTravel(outside); i++) tick(game);
    const loadsBefore = terrainSnapshots(traveller).length;

    requestPlace(stayer, [3.5, 5.5]);
    tick(game);

    expect(resent(stayer).map(([id]) => id)).toEqual([origin]);
    expect(terrainSnapshots(traveller)).toHaveLength(loadsBefore);
  });

  it("sends a player who comes back the region as it is now", () => {
    const game = createTestGame();
    const [stayer, traveller] = [connect(game), connect(game)];
    requestDestination(traveller, [100_000, 0]);
    const outside = (LOADED_SIDE_LENGTH / 2 + 1) * REGION_SIDE_LENGTH;
    for (let i = 0; i < ticksToTravel(outside); i++) tick(game);
    requestPlace(stayer, [3.5, 5.5]);
    tick(game);

    requestDestination(traveller, [0, 0]);
    for (let i = 0; i < ticksToTravel(outside); i++) tick(game);

    const latestOrigin = terrainSnapshots(traveller)
      .map(snapshot => snapshot.get(origin))
      .findLast(region => region != null);
    expect(latestOrigin?.tiles[tileIndex(3, 5)]).toBe(tileToId(changedTile));
  });

  it("resends the region without a structure once it is gathered", () => {
    const game = createGame(treeGenerator);
    const client = connect(game);
    tick(game);
    expect(terrainSnapshots(client)[0]?.get(origin)?.structures.size).toBe(1);

    requestGather(client);
    for (let i = 0; i < gatherTicks; i++) tick(game);

    const sent = resent(client);
    expect(sent.map(([id]) => id)).toEqual([origin]);
    expect(sent[0]?.[1].structures.size).toBe(0);
  });

  it("sends the end time of a gather task once the player starts it", () => {
    const game = createGame(treeGenerator);
    const client = connect(game);
    tick(game);

    requestGather(client);
    for (let i = 0; i < startTicks; i++) tick(game);

    const task = latestEntities(client).get(playerIdOf(client))?.taskList
      ?.tasks[0];
    const endsAt = task?.type === "gatherStructure" ? task.endsAt : undefined;
    expect(endsAt).toBeGreaterThan(TASK_DURATION);
    expect(endsAt).toBeLessThanOrEqual(TASK_DURATION + startTicks * DT);
  });

  it("does not resend the player while it is gathering", () => {
    const game = createGame(treeGenerator);
    const client = connect(game);
    tick(game);
    requestGather(client);
    for (let i = 0; i < startTicks; i++) tick(game);
    const sentBefore = snapshots(client).length;

    for (let i = 0; i < Math.floor((TASK_DURATION * TPS) / 2); i++) tick(game);

    expect(snapshots(client)).toHaveLength(sentBefore);
  });

  it("resends a region once when it was unloaded and changed in the same tick", () => {
    const game = createTestGame();
    const client = connect(game);
    tick(game);

    requestUnload(client, [origin]);
    requestPlace(client, [3.5, 5.5]);
    tick(game);

    expect(resent(client).map(([id]) => id)).toEqual([origin]);
  });
});

describe("client messages", () => {
  const playerX = (client: Client) => {
    const player = latestEntities(client).get(playerIdOf(client));
    return player?.position.x() ?? raise(new Error("Player not in snapshot"));
  };

  it("moves the player towards the requested destination", () => {
    const game = createTestGame();
    const client = connect(game);

    requestDestination(client, [100, 0]);
    tick(game);

    expect(playerX(client)).toBeCloseTo(PLAYER_SPEED / TPS);
  });

  it("ignores messages it cannot decode", () => {
    const game = createTestGame();
    const client = connect(game);

    client.session.receive(Uint8Array.of(9, 9, 9));
    tick(game);

    expect(playerX(client)).toBe(0);
  });

  it("only moves the player who sent the message", () => {
    const game = createTestGame();
    const [mover, idle] = [connect(game), connect(game)];

    requestDestination(mover, [100, 0]);
    tick(game);

    expect(playerX(mover)).toBeGreaterThan(0);
    expect(playerX(idle)).toBe(0);
  });
});
