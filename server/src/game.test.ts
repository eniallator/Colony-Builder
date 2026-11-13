import {
  encClientMessage,
  encServerMessage,
  LOADED_SIDE_LENGTH,
  PLAYER_SPEED,
  REGION_SIDE_LENGTH,
  regionIdToPos,
  regionPosToId,
  TPS,
  type RegionId,
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

const terrainSnapshots = (client: Client) =>
  mapFilter(received(client), message =>
    message?.type === "terrain" ? message.snapshot : null
  );

const messageTypes = (client: Client) =>
  received(client).map(message => message?.type);

const latestEntities = (client: Client) =>
  snapshots(client).at(-1) ?? raise(new Error("No snapshot was sent"));

const ticksToTravel = (distance: number) =>
  Math.ceil((distance * TPS) / PLAYER_SPEED);

describe("connections", () => {
  it("tells a new player their id", () => {
    const client = connect(createGame());

    expect(received(client)).toEqual([
      { type: "init", id: playerIdOf(client) },
    ]);
  });

  it("gives each player a different id", () => {
    const game = createGame();

    expect(playerIdOf(connect(game))).not.toBe(playerIdOf(connect(game)));
  });

  it("removes a player when they disconnect", () => {
    const game = createGame();
    const leaver = connect(game);
    const stayer = connect(game);
    const leaverId = playerIdOf(leaver);

    leaver.session.disconnect();
    tick(game);

    expect(latestEntities(stayer).has(leaverId)).toBe(false);
    expect(leaver.sent).toHaveBeenCalledOnce();
  });
});

describe("snapshots", () => {
  it("is not sent before the first tick", () => {
    const client = connect(createGame());

    expect(snapshots(client)).toHaveLength(0);
  });

  it("is sent to every connected player each tick", () => {
    const game = createGame();
    const [a, b] = [connect(game), connect(game)];

    tick(game);
    tick(game);

    expect(snapshots(a)).toHaveLength(2);
    expect(snapshots(b)).toHaveLength(2);
  });

  it("includes every player", () => {
    const game = createGame();
    const [a, b] = [connect(game), connect(game)];

    tick(game);

    const players = [...latestEntities(a)].filter(
      ([, { type }]) => type === "player"
    );
    expect(players.map(([id]) => id)).toEqual([playerIdOf(a), playerIdOf(b)]);
  });

  it("only includes the entities near each player", () => {
    const game = createGame();
    const [stayer, traveller] = [connect(game), connect(game)];
    requestDestination(traveller, [10_000, 0]);

    // Walk far enough to leave the loaded square of regions around the stayer.
    const outside = (LOADED_SIDE_LENGTH / 2 + 1) * REGION_SIDE_LENGTH;
    for (let i = 0; i < ticksToTravel(outside); i++) tick(game);

    const nearStayer = [...latestEntities(stayer).keys()];
    const nearTraveller = [...latestEntities(traveller).keys()];
    expect(nearStayer).toContain(playerIdOf(stayer));
    expect(nearStayer).not.toContain(playerIdOf(traveller));
    expect(nearTraveller).toContain(playerIdOf(traveller));
    expect(nearTraveller).not.toContain(playerIdOf(stayer));
  });
});

describe("terrain", () => {
  const half = LOADED_SIDE_LENGTH / 2;

  it("is not sent before the first tick", () => {
    const client = connect(createGame());

    expect(terrainSnapshots(client)).toHaveLength(0);
  });

  it("sends the regions around a new player on the first tick", () => {
    const game = createGame();
    const client = connect(game);

    tick(game);

    const [first] = terrainSnapshots(client);
    expect(first?.size).toBe(LOADED_SIDE_LENGTH ** 2);
    expect(first?.has(regionPosToId(-half, -half))).toBe(true);
    expect(first?.has(regionPosToId(half - 1, half - 1))).toBe(true);
    expect(first?.has(regionPosToId(half, 0))).toBe(false);
  });

  it("is sent after the init message and before the entities", () => {
    const game = createGame();
    const client = connect(game);

    tick(game);

    expect(messageTypes(client)).toEqual(["init", "terrain", "entities"]);
  });

  it("does not resend regions the player already has", () => {
    const game = createGame();
    const client = connect(game);

    tick(game);
    tick(game);

    expect(terrainSnapshots(client)).toHaveLength(1);
    expect(snapshots(client)).toHaveLength(2);
  });

  it("sends each player their own regions", () => {
    const game = createGame();
    const early = connect(game);
    tick(game);
    const late = connect(game);
    tick(game);

    expect(terrainSnapshots(early)).toHaveLength(1);
    expect(terrainSnapshots(late)).toHaveLength(1);
    expect(terrainSnapshots(late)[0]?.size).toBe(LOADED_SIDE_LENGTH ** 2);
  });

  it("sends only the newly in-range regions when the player crosses into a new region", () => {
    const game = createGame();
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
    const game = createGame();
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
    const game = createGame();
    const client = connect(game);
    tick(game);

    requestUnload(client, [regionPosToId(99, 99)]);
    tick(game);

    expect(terrainSnapshots(client)).toHaveLength(1);
  });

  it("only resends to the player who unloaded", () => {
    const game = createGame();
    const [unloader, other] = [connect(game), connect(game)];
    tick(game);

    requestUnload(unloader, [regionPosToId(0, 0)]);
    tick(game);

    expect(terrainSnapshots(unloader)).toHaveLength(2);
    expect(terrainSnapshots(other)).toHaveLength(1);
  });
});

describe("client messages", () => {
  const playerX = (client: Client) => {
    const player = latestEntities(client).get(playerIdOf(client));
    return player?.position.x() ?? raise(new Error("Player not in snapshot"));
  };

  it("moves the player towards the requested destination", () => {
    const game = createGame();
    const client = connect(game);

    requestDestination(client, [100, 0]);
    tick(game);

    expect(playerX(client)).toBeCloseTo(PLAYER_SPEED / TPS);
  });

  it("ignores messages it cannot decode", () => {
    const game = createGame();
    const client = connect(game);

    client.session.receive(Uint8Array.of(9, 9, 9));
    tick(game);

    expect(playerX(client)).toBe(0);
  });

  it("only moves the player who sent the message", () => {
    const game = createGame();
    const [mover, idle] = [connect(game), connect(game)];

    requestDestination(mover, [100, 0]);
    tick(game);

    expect(playerX(mover)).toBeGreaterThan(0);
    expect(playerX(idle)).toBe(0);
  });
});
