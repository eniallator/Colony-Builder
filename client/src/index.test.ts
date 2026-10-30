import {
  clientMessage,
  DEFAULT_PORT,
  destinationMessage,
  EntityStore,
  initMessage,
  serverMessage,
  snapshotMessage,
  TPS,
  unsafeEntityId,
  type EntitySnapshot,
} from "@colony-builder/shared";
import { raise, toElement } from "niall-utils";
import { Vector } from "vectyped";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import { app } from "./index.ts";
import type { State } from "./state.ts";
import type { ClientSystem } from "./system.ts";
import {
  Keyboard,
  Mouse,
  type AppContext,
  type StatefulAppContext,
} from "./ui/index.ts";

const { systems } = vi.hoisted((): { systems: Mock<ClientSystem>[] } => ({
  systems: [vi.fn(), vi.fn()],
}));

vi.mock("./system.ts", () => ({ clientSystems: systems }));

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];

  binaryType = "blob";
  readonly send = vi.fn();

  readonly url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
}

const lastSocket = () =>
  FakeWebSocket.instances.at(-1) ?? raise(new Error("No WebSocket was opened"));

const createAppContext = (): AppContext => {
  const canvas = toElement("<canvas></canvas>");
  canvas.width = 100;
  canvas.height = 50;

  return {
    canvas,
    ctx: canvas.getContext("2d") ?? raise(new Error("No 2d context")),
    mouse: new Mouse(canvas),
    keyboard: new Keyboard(canvas),
    time: { now: 1, start: 0, lastFrame: 0.99, delta: 0.01 },
  };
};

const message = (data: unknown) => new MessageEvent("message", { data });

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("app.init", () => {
  it("starts with an empty world and a centred camera", () => {
    const state = app.init(createAppContext());

    expect(state.store.query("position")).toEqual([]);
    expect(state.camera.center.toArray()).toEqual([0, 0]);
    expect(state.camera.zoom).toBe(0);
    expect(state.playerId).toBeUndefined();
  });

  it("connects to the server on the page's host", () => {
    app.init(createAppContext());

    expect(lastSocket().url).toBe(`ws://${location.hostname}:${DEFAULT_PORT}`);
    expect(lastSocket().binaryType).toBe("arraybuffer");
  });

  it("uses a secure socket on https pages", () => {
    vi.stubGlobal("location", { protocol: "https:", hostname: "example.com" });

    app.init(createAppContext());

    expect(lastSocket().url).toBe(`wss://example.com:${DEFAULT_PORT}`);
  });

  describe("server messages", () => {
    it("stores the player id from an init message", () => {
      const state = app.init(createAppContext());

      lastSocket().dispatchEvent(
        message(
          serverMessage.encode(initMessage.create(unsafeEntityId(4))).buffer
        )
      );

      expect(state.playerId).toBe(4);
    });

    it("applies snapshot messages to the world", () => {
      const state = app.init(createAppContext());
      const entity: EntitySnapshot = {
        id: unsafeEntityId(2),
        type: "item",
        position: Vector.create(3, 4),
        destination: undefined,
        speed: undefined,
        conveyable: true,
      };

      lastSocket().dispatchEvent(
        message(
          serverMessage.encode(snapshotMessage.create({ entities: [entity] }))
            .buffer
        )
      );

      expect(state.store.get(entity.id, "position").toArray()).toEqual([3, 4]);
    });

    it("ignores messages that are not binary", () => {
      const state = app.init(createAppContext());

      lastSocket().dispatchEvent(message("hello"));

      expect(state.playerId).toBeUndefined();
    });

    it("ignores binary data that is not a valid message", () => {
      const state = app.init(createAppContext());

      lastSocket().dispatchEvent(message(Uint8Array.of(9, 9, 9).buffer));

      expect(state.playerId).toBeUndefined();
      expect(state.store.query("position")).toEqual([]);
    });
  });

  describe("mouse", () => {
    it("sends the clicked world position as the destination", () => {
      const ctx = createAppContext();
      app.init(ctx);

      ctx.canvas.onmousedown?.(
        new MouseEvent("mousedown", { clientX: 60, clientY: 30 })
      );

      expect(lastSocket().send).toHaveBeenCalledExactlyOnceWith(
        clientMessage.encode(destinationMessage.create(10, 5))
      );
    });

    it("accounts for the camera", () => {
      const ctx = createAppContext();
      const state = app.init(ctx);
      state.camera.center = Vector.create(100, 100);
      state.camera.zoom = 1;

      ctx.canvas.onmousedown?.(
        new MouseEvent("mousedown", { clientX: 60, clientY: 30 })
      );

      expect(lastSocket().send).toHaveBeenCalledExactlyOnceWith(
        clientMessage.encode(destinationMessage.create(105, 102.5))
      );
    });
  });
});

describe("app.animationFrame", () => {
  const frame = (state: State, timeOverrides?: Partial<AppContext["time"]>) => {
    const base = createAppContext();
    const ctx: StatefulAppContext<State> = {
      ...base,
      time: { ...base.time, ...timeOverrides },
      getState: () => state,
      setState: vi.fn(),
    };
    app.animationFrame?.(ctx);
    return ctx;
  };

  const createState = (): State => ({
    camera: { center: Vector.zero(2), zoom: 0 },
    store: new EntityStore(),
    playerId: unsafeEntityId(1),
  });

  const firstCtx = (system: Mock<ClientSystem> | undefined) =>
    system?.mock.calls[0]?.[0] ?? raise(new Error("System was not called"));

  it("runs every client system once, in order", () => {
    const order: number[] = [];
    systems.forEach((system, i) => {
      system.mockImplementation(() => {
        order.push(i);
      });
    });

    frame(createState());

    expect(order).toEqual([0, 1]);
  });

  it("gives the systems the state and the app context", () => {
    const state = createState();

    const ctx = frame(state);

    const systemCtx = firstCtx(systems[0]);
    expect(systemCtx.store).toBe(state.store);
    expect(systemCtx.camera).toBe(state.camera);
    expect(systemCtx.playerId).toBe(state.playerId);
    expect(systemCtx.canvas).toBe(ctx.canvas);
    expect(systemCtx.ctx).toBe(ctx.ctx);
    expect(systemCtx.time).toBe(ctx.time);
  });

  it("shares one context between all systems", () => {
    frame(createState());

    expect(firstCtx(systems[1])).toBe(firstCtx(systems[0]));
  });

  it("steps by the frame delta", () => {
    frame(createState(), { delta: 0.01 });

    expect(firstCtx(systems[0]).dt).toBe(0.01);
  });

  it("caps the step at two ticks", () => {
    frame(createState(), { delta: 5 });

    expect(firstCtx(systems[0]).dt).toBe(2 / TPS);
  });
});
