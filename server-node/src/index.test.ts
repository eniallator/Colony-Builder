import { EventEmitter } from "node:events";
import {
  encClientMessage,
  encServerMessage,
  MAX_DT,
  PLAYER_SPEED,
  SOCKET_PORT,
  TPS,
} from "@colony-builder/shared";
import { raise } from "niall-utils/core";
import { mapFilter, mapFind } from "niall-utils/functional";
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

const received = (socket: FakeSocket) =>
  socket.send.mock.calls.map(([data]) => encServerMessage.decode(data));

const playerIdOf = (socket: FakeSocket) =>
  mapFind(received(socket), message =>
    message?.type === "init" ? message.id : null
  ) ?? raise(new Error("No init message was sent"));

const latestEntities = (socket: FakeSocket) =>
  mapFilter(received(socket), message =>
    message?.type === "entities" ? message.snapshot : null
  ).at(-1) ?? raise(new Error("No snapshot was sent"));

const playerX = (socket: FakeSocket) =>
  latestEntities(socket).get(playerIdOf(socket))?.position.x() ??
  raise(new Error("Player not in snapshot"));

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

  it("removes a player when their socket closes", async () => {
    const server = await load();
    const leaver = connect(server);
    const stayer = connect(server);
    const leaverId = playerIdOf(leaver);

    leaver.emit("close");
    tick();

    expect(latestEntities(stayer).has(leaverId)).toBe(false);
    expect(leaver.send).toHaveBeenCalledOnce();
  });

  it("skips sockets that are not open", async () => {
    const socket = connect(await load());
    socket.readyState = 3;

    tick();

    expect(socket.send).toHaveBeenCalledOnce();
  });
});

describe("ticking", () => {
  it("steps the game every tick", async () => {
    const socket = connect(await load());

    vi.advanceTimersByTime(TICK_MS - 1);
    expect(received(socket)).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(received(socket).map(message => message?.type)).toEqual([
      "init",
      "terrain",
      "entities",
    ]);
  });

  it("caps a long gap between ticks at MAX_DT of movement", async () => {
    const socket = connect(await load());
    socket.emit("message", moveBytes([1000, 0]));

    vi.setSystemTime(Date.now() + 10_000);
    tick();

    expect(playerX(socket)).toBeCloseTo(MAX_DT * PLAYER_SPEED);
  });
});

describe("client messages", () => {
  it("passes a message to the game", async () => {
    const socket = connect(await load());

    socket.emit("message", moveBytes([100, 0]));
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
});
