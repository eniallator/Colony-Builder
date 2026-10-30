import { EventEmitter } from "node:events";
import {
  clientMessage,
  DEFAULT_PORT,
  destinationMessage,
  PLAYER_SPEED,
  serverMessage,
  TPS,
} from "@colony-builder/shared";
import { mapFilter, mapFind, partition, raise } from "niall-utils";
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

const requestDestination = (socket: FakeSocket, position: [number, number]) =>
  socket.emit(
    "message",
    clientMessage.encode(destinationMessage.create(...position))
  );

const received = (socket: FakeSocket) =>
  socket.send.mock.calls.map(([data]) => serverMessage.decode(data));

const playerIdOf = (socket: FakeSocket) =>
  mapFind(received(socket), message =>
    message?.type === "init" ? message.id : null
  ) ?? raise(new Error("No init message was sent"));

const snapshots = (socket: FakeSocket) =>
  mapFilter(received(socket), message =>
    message?.type === "snapshot" ? message.snapshot.entities : null
  );

const latestEntities = (socket: FakeSocket) =>
  snapshots(socket).at(-1) ?? raise(new Error("No snapshot was sent"));

const tick = () => {
  vi.advanceTimersByTime(TICK_MS);
};

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

    expect(server.options.port).toBe(DEFAULT_PORT);
  });

  it("listens on the PORT environment variable when set", async () => {
    vi.stubEnv("PORT", "1234");

    const server = await load();

    expect(server.options.port).toBe(1234);
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

    expect(latestEntities(stayer).map(({ id }) => id)).not.toContain(leaverId);
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
      latestEntities(a),
      ({ type }) => type === "player"
    );
    expect(players.map(({ id }) => id)).toEqual([playerIdOf(a), playerIdOf(b)]);
    expect(others.map(({ type }) => type)).toEqual(["item"]);
  });

  it("skips sockets that are not open", async () => {
    const socket = connect(await load());
    socket.readyState = 3;

    tick();

    expect(snapshots(socket)).toHaveLength(0);
  });
});

describe("client messages", () => {
  const playerX = (socket: FakeSocket) => {
    const id = playerIdOf(socket);
    const player = latestEntities(socket).find(entity => entity.id === id);
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
    const bytes = clientMessage.encode(destinationMessage.create(100, 0));

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
