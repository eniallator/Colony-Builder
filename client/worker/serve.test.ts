import {
  encClientMessage,
  encServerMessage,
  PLAYER_SPEED,
  TPS,
} from "@colony-builder/shared";
import { raise } from "niall-utils/core";
import { mapFilter, mapFind } from "niall-utils/functional";
import { Vector } from "vectyped";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { serveGame, type WorkerScope } from "./serve.ts";

const TICK_MS = 1000 / TPS;

const serve = () => {
  const postMessage = vi.fn<WorkerScope["postMessage"]>();
  const addEventListener = vi.fn<WorkerScope["addEventListener"]>();
  serveGame({ postMessage, addEventListener });

  const [, listener] =
    addEventListener.mock.calls[0] ??
    raise(new Error("No message listener was added"));

  return {
    postMessage,
    receive: (data: unknown) => {
      listener(new MessageEvent("message", { data }));
    },
  };
};

type Served = ReturnType<typeof serve>;

const received = ({ postMessage }: Served) =>
  postMessage.mock.calls.map(([bytes]) => encServerMessage.decode(bytes));

const messageTypes = (served: Served) =>
  received(served).map(message => message?.type);

const playerX = (served: Served) => {
  const messages = received(served);
  const id =
    mapFind(messages, message =>
      message?.type === "init" ? message.id : null
    ) ?? raise(new Error("No init message was posted"));
  const snapshot =
    mapFilter(messages, message =>
      message?.type === "entities" ? message.snapshot : null
    ).at(-1) ?? raise(new Error("No snapshot was posted"));

  return snapshot.get(id)?.position.x() ?? raise(new Error("No player"));
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("serveGame", () => {
  it("tells the page its player id straight away", () => {
    expect(messageTypes(serve())).toEqual(["init"]);
  });

  it("hands each message's buffer over instead of copying it", () => {
    const { postMessage } = serve();

    const [bytes, transfer] =
      postMessage.mock.calls[0] ?? raise(new Error("Nothing was posted"));

    expect(transfer).toHaveLength(1);
    expect(transfer[0]).toBe(bytes.buffer);
  });

  it("ticks the game on a timer", () => {
    const served = serve();

    vi.advanceTimersByTime(TICK_MS - 1);
    expect(messageTypes(served)).toEqual(["init"]);

    vi.advanceTimersByTime(1);
    expect(messageTypes(served)).toEqual(["init", "terrain", "entities"]);
  });

  it("moves the player when the page sends bytes", () => {
    const served = serve();

    served.receive(
      encClientMessage.encode({ type: "move", position: Vector.create(100, 0) })
    );
    vi.advanceTimersByTime(TICK_MS);

    expect(playerX(served)).toBeCloseTo(PLAYER_SPEED / TPS);
  });

  it("ignores messages that are not bytes", () => {
    const served = serve();

    served.receive("hello");
    vi.advanceTimersByTime(TICK_MS);

    expect(playerX(served)).toBe(0);
  });
});
