import { EventEmitter } from "node:events";
import {
  encClientMessage,
  encServerMessage,
  LOADED_SIDE_LENGTH,
  PLAYER_SPEED,
  REGION_SIDE_LENGTH,
  regionIdToPos,
  regionPosToId,
  SOCKET_PORT,
  TPS,
  type RegionId,
} from "@colony-builder/shared";
import { mapFilter, mapFind, partition, raise } from "niall-utils";
import { Vector } from "vectyped";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeServer extends EventEmitter {
  options: { port?: number };
}

const { servers } = vi.hoisted((): { servers: FakeServer[] } => ({
  servers: [],
}));

vi.mock("ws", async () => {
  const { EventEmitter } = await import("node:events");

  class WebSocketServer extends EventEmitter {
    readonly options: { port?: number };

    constructor(options: { port?: number }) {
      super();
      this.options = options;
      servers.push(this);
    }
  }

  return { WebSocketServer };
});

class FakeSocket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  readonly send = vi.fn<(data: Uint8Array) => void>();
}

const TICK_MS = 1000 / TPS;

const load = async () => {
  await import("./index.ts");
  return servers.at(-1) ?? raise(new Error("No server was created"));
};

const connect = (server: FakeServer) => {
  const socket = new FakeSocket();
  server.emit("connection", socket);
  return socket;
};

const moveBytes = (position: [number, number]) =>
  encClientMessage.encode({
    type: "move",
    position: Vector.create(...position),
  });

const requestDestination = (socket: FakeSocket, position: [number, number]) =>
  socket.emit("message", moveBytes(position));

const requestUnload = (socket: FakeSocket, ids: RegionId[]) =>
  socket.emit("message", encClientMessage.encode({ type: "unload", ids }));

const received = (socket: FakeSocket) =>
  socket.send.mock.calls.map(([data]) => encServerMessage.decode(data));

const playerIdOf = (socket: FakeSocket) =>
  mapFind(received(socket), message =>
    message?.type === "init" ? message.id : null
  ) ?? raise(new Error("No init message was sent"));

const snapshots = (socket: FakeSocket) =>
  mapFilter(received(socket), message =>
    message?.type === "entities" ? message.snapshot : null
  );

const terrainSnapshots = (socket: FakeSocket) =>
  mapFilter(received(socket), message =>
    message?.type === "terrain" ? message.snapshot : null
  );

const messageTypes = (socket: FakeSocket) =>
  received(socket).map(message => message?.type);

const latestEntities = (socket: FakeSocket) =>
  snapshots(socket).at(-1) ?? raise(new Error("No snapshot was sent"));

const tick = () => {
  vi.advanceTimersByTime(TICK_MS);
};

const ticksToTravel = (distance: number) =>
  Math.ceil((distance * TPS) / PLAYER_SPEED);

beforeEach(() => {
  servers.length = 0;
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("server", () => {
  it("listens on the default port", async () => {
    const server = await load();

    expect(server.options.port).toBe(SOCKET_PORT);
  });
});

describe("connections", () => {
  it("tells a new player their id", async () => {
    const socket = connect(await load());

    expect(received(socket)).toEqual([
      { type: "init", id: playerIdOf(socket) },
    ]);
  });

  it("gives each player a different id", async () => {
    const server = await load();

    expect(playerIdOf(connect(server))).not.toBe(playerIdOf(connect(server)));
  });

  it("removes a player when they disconnect", async () => {
    const server = await load();
    const leaver = connect(server);
    const stayer = connect(server);
    const leaverId = playerIdOf(leaver);

    leaver.emit("close");
    tick();

    expect(latestEntities(stayer).has(leaverId)).toBe(false);
    expect(leaver.send).toHaveBeenCalledOnce();
  });
});

describe("snapshots", () => {
  it("is not sent before the first tick", async () => {
    const socket = connect(await load());

    vi.advanceTimersByTime(TICK_MS - 1);

    expect(snapshots(socket)).toHaveLength(0);
  });

  it("is sent to every connected player each tick", async () => {
    const server = await load();
    const [a, b] = [connect(server), connect(server)];

    tick();
    tick();

    expect(snapshots(a)).toHaveLength(2);
    expect(snapshots(b)).toHaveLength(2);
  });

  it("includes the starting item and every player", async () => {
    const server = await load();
    const [a, b] = [connect(server), connect(server)];

    tick();

    const [players, others] = partition(
      [...latestEntities(a)],
      ([, { type }]) => type === "player"
    );
    expect(players.map(([id]) => id)).toEqual([playerIdOf(a), playerIdOf(b)]);
    expect(others.map(([, { type }]) => type)).toEqual(["item"]);
  });

  it("only includes the entities near each player", async () => {
    const server = await load();
    const [stayer, traveller] = [connect(server), connect(server)];
    requestDestination(traveller, [10_000, 0]);

    // Walk far enough to leave the loaded square of regions around the stayer.
    const outside = (LOADED_SIDE_LENGTH / 2 + 1) * REGION_SIDE_LENGTH;
    for (let i = 0; i < ticksToTravel(outside); i++) tick();

    const nearStayer = [...latestEntities(stayer).keys()];
    const nearTraveller = [...latestEntities(traveller).keys()];
    expect(nearStayer).toContain(playerIdOf(stayer));
    expect(nearStayer).not.toContain(playerIdOf(traveller));
    expect(nearTraveller).toEqual([playerIdOf(traveller)]);
    // The starting item is still beside the stayer.
    expect(nearStayer).toHaveLength(2);
  });

  it("skips sockets that are not open", async () => {
    const socket = connect(await load());
    socket.readyState = 3;

    tick();

    expect(snapshots(socket)).toHaveLength(0);
  });
});

describe("terrain", () => {
  const half = LOADED_SIDE_LENGTH / 2;

  it("is not sent before the first tick", async () => {
    const socket = connect(await load());

    vi.advanceTimersByTime(TICK_MS - 1);

    expect(terrainSnapshots(socket)).toHaveLength(0);
  });

  it("sends the regions around a new player on the first tick", async () => {
    const socket = connect(await load());

    tick();

    const [first] = terrainSnapshots(socket);
    expect(first?.size).toBe(LOADED_SIDE_LENGTH ** 2);
    expect(first?.has(regionPosToId(-half, -half))).toBe(true);
    expect(first?.has(regionPosToId(half - 1, half - 1))).toBe(true);
    expect(first?.has(regionPosToId(half, 0))).toBe(false);
  });

  it("is sent after the init message and before the entities", async () => {
    const socket = connect(await load());

    tick();

    expect(messageTypes(socket)).toEqual(["init", "terrain", "entities"]);
  });

  it("does not resend regions the player already has", async () => {
    const socket = connect(await load());

    tick();
    tick();

    expect(terrainSnapshots(socket)).toHaveLength(1);
    expect(snapshots(socket)).toHaveLength(2);
  });

  it("sends each player their own regions", async () => {
    const server = await load();
    const early = connect(server);
    tick();
    const late = connect(server);
    tick();

    expect(terrainSnapshots(early)).toHaveLength(1);
    expect(terrainSnapshots(late)).toHaveLength(1);
    expect(terrainSnapshots(late)[0]?.size).toBe(LOADED_SIDE_LENGTH ** 2);
  });

  it("sends only the newly in-range regions when the player crosses into a new region", async () => {
    const socket = connect(await load());
    requestDestination(socket, [100, 0]);

    // Walk just far enough to step into region 1.
    for (let i = 0; i < ticksToTravel(REGION_SIDE_LENGTH); i++) tick();

    const snapshotsSent = terrainSnapshots(socket);
    expect(snapshotsSent).toHaveLength(2);
    expect(snapshotsSent[1]?.size).toBe(LOADED_SIDE_LENGTH);
    expect(
      [...(snapshotsSent[1]?.keys() ?? [])].every(
        id => regionIdToPos(id)[0] === half
      )
    ).toBe(true);
  });

  it("resends regions the client says it unloaded", async () => {
    const socket = connect(await load());
    tick();

    requestUnload(socket, [regionPosToId(0, 0), regionPosToId(1, 1)]);
    tick();

    const snapshotsSent = terrainSnapshots(socket);
    expect(snapshotsSent).toHaveLength(2);
    expect([...(snapshotsSent[1]?.keys() ?? [])]).toEqual([
      regionPosToId(0, 0),
      regionPosToId(1, 1),
    ]);
  });

  it("ignores an unload for regions it never sent", async () => {
    const socket = connect(await load());
    tick();

    requestUnload(socket, [regionPosToId(99, 99)]);
    tick();

    expect(terrainSnapshots(socket)).toHaveLength(1);
  });

  it("only resends to the player who unloaded", async () => {
    const server = await load();
    const [unloader, other] = [connect(server), connect(server)];
    tick();

    requestUnload(unloader, [regionPosToId(0, 0)]);
    tick();

    expect(terrainSnapshots(unloader)).toHaveLength(2);
    expect(terrainSnapshots(other)).toHaveLength(1);
  });
});

describe("client messages", () => {
  const playerX = (socket: FakeSocket) => {
    const player = latestEntities(socket).get(playerIdOf(socket));
    return player?.position.x() ?? raise(new Error("Player not in snapshot"));
  };

  it("moves the player towards the requested destination", async () => {
    const socket = connect(await load());

    requestDestination(socket, [100, 0]);
    tick();

    expect(playerX(socket)).toBeCloseTo(PLAYER_SPEED / TPS);
  });

  it("accepts a message split across buffers", async () => {
    const socket = connect(await load());
    const bytes = moveBytes([100, 0]);

    socket.emit("message", [
      Buffer.from(bytes.subarray(0, 3)),
      Buffer.from(bytes.subarray(3)),
    ]);
    tick();

    expect(playerX(socket)).toBeGreaterThan(0);
  });

  it("ignores messages it cannot decode", async () => {
    const socket = connect(await load());

    socket.emit("message", Uint8Array.of(9, 9, 9));
    tick();

    expect(playerX(socket)).toBe(0);
  });

  it("only moves the player who sent the message", async () => {
    const server = await load();
    const [mover, idle] = [connect(server), connect(server)];

    requestDestination(mover, [100, 0]);
    tick();

    expect(playerX(mover)).toBeGreaterThan(0);
    expect(playerX(idle)).toBe(0);
  });

  it("caps a long gap between ticks at two ticks of movement", async () => {
    const socket = connect(await load());
    requestDestination(socket, [1000, 0]);

    vi.setSystemTime(Date.now() + 10_000);
    tick();

    expect(playerX(socket)).toBeCloseTo((2 * PLAYER_SPEED) / TPS);
  });
});
