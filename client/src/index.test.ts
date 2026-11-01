import {
  createPlayer,
  encClientMessage,
  encServerMessage,
  REGION_SIDE_LENGTH,
  regionPosToId,
  SOCKET_PORT,
  TPS,
  UNLOADED_SIDE_LENGTH,
  unsafeEntityId,
  World,
  type ClientMessage,
  type ComponentSnapshot,
  type EntityId,
  type RegionTiles,
  type ServerMessage,
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

const serverMessage = (serverMsg: ServerMessage) =>
  message(encServerMessage.encode(serverMsg).buffer);

const grass: RegionTiles = {
  tiles: Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () => "grass"),
};

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("app.init", () => {
  it("starts with an empty world and a zoomed in, centred camera", () => {
    const state = app.init(createAppContext());

    expect(state.world.entities.query("position")).toEqual([]);
    expect([...state.world.terrain.ids]).toEqual([]);
    expect(state.camera.center.toArray()).toEqual([0, 0]);
    expect(state.camera.zoom).toBe(2);
    expect(state.playerId).toBeUndefined();
  });

  it("connects to the server on the page's host", () => {
    app.init(createAppContext());

    expect(lastSocket().url).toBe(`ws://${location.hostname}:${SOCKET_PORT}`);
    expect(lastSocket().binaryType).toBe("arraybuffer");
  });

  it("uses a secure socket on https pages", () => {
    vi.stubGlobal("location", { protocol: "https:", hostname: "example.com" });

    app.init(createAppContext());

    expect(lastSocket().url).toBe(`wss://example.com:${SOCKET_PORT}`);
  });

  describe("send", () => {
    it("encodes client messages onto the socket", () => {
      const state = app.init(createAppContext());
      const unload: ClientMessage = {
        type: "unload",
        ids: [regionPosToId(3, -4)],
      };

      state.send(unload);

      expect(lastSocket().send).toHaveBeenCalledExactlyOnceWith(
        encClientMessage.encode(unload)
      );
    });
  });

  describe("server messages", () => {
    it("stores the player id from an init message", () => {
      const state = app.init(createAppContext());

      lastSocket().dispatchEvent(
        serverMessage({ type: "init", id: unsafeEntityId(4) })
      );

      expect(state.playerId).toBe(4);
    });

    it("applies entities messages to the world", () => {
      const state = app.init(createAppContext());
      const id = unsafeEntityId(2);
      const entity: ComponentSnapshot = {
        type: "item",
        position: Vector.create(3, 4),
        destination: undefined,
        speed: undefined,
        conveyable: true,
      };

      lastSocket().dispatchEvent(
        serverMessage({ type: "entities", snapshot: new Map([[id, entity]]) })
      );

      expect(state.world.entities.get(id, "position").toArray()).toEqual([
        3, 4,
      ]);
    });

    it("applies terrain messages to the world", () => {
      const state = app.init(createAppContext());

      lastSocket().dispatchEvent(
        serverMessage({
          type: "terrain",
          snapshot: new Map([[regionPosToId(1, 2), grass]]),
        })
      );

      expect(state.world.terrain.get(regionPosToId(1, 2))).toEqual(grass);
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
      expect(state.world.entities.query("position")).toEqual([]);
      expect([...state.world.terrain.ids]).toEqual([]);
    });
  });

  describe("mouse", () => {
    it("sends the clicked world position as the destination", () => {
      const ctx = createAppContext();
      app.init(ctx);

      ctx.canvas.onmousedown?.(
        new MouseEvent("mousedown", { clientX: 60, clientY: 30 })
      );

      // The click is (10, 5) from the canvas centre, scaled down by 2 ** zoom.
      expect(lastSocket().send).toHaveBeenCalledExactlyOnceWith(
        encClientMessage.encode({
          type: "move",
          position: Vector.create(2.5, 1.25),
        })
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
        encClientMessage.encode({
          type: "move",
          position: Vector.create(105, 102.5),
        })
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

  const createState = (playerPosition?: Vector<2>): State => {
    const world = new World();

    return {
      camera: { center: Vector.zero(2), zoom: 0 },
      world,
      playerId: createPlayer(world, playerPosition),
      send: vi.fn(),
    };
  };

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
    expect(systemCtx.world).toBe(state.world);
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

  describe("when the player has no position yet", () => {
    const far = regionPosToId(UNLOADED_SIDE_LENGTH, 0);

    const stateWithout = (playerId?: EntityId): State => {
      const world = new World();
      world.terrain.add(far, grass);

      return {
        camera: { center: Vector.zero(2), zoom: 0 },
        world,
        playerId,
        send: vi.fn(),
      };
    };

    it("keeps all terrain without a player id", () => {
      const state = stateWithout();

      frame(state);

      expect(state.world.terrain.optGet(far)).toBe(grass);
      expect(state.send).not.toHaveBeenCalled();
    });

    it("keeps all terrain while the player entity has not arrived", () => {
      const state = stateWithout(unsafeEntityId(1));

      frame(state);

      expect(state.world.terrain.optGet(far)).toBe(grass);
      expect(state.send).not.toHaveBeenCalled();
    });

    it("still runs the systems", () => {
      frame(stateWithout());

      expect(systems[0]).toHaveBeenCalledOnce();
      expect(systems[1]).toHaveBeenCalledOnce();
    });
  });

  describe("unloading terrain", () => {
    const half = UNLOADED_SIDE_LENGTH / 2;

    it("drops regions outside the unload square and tells the server", () => {
      const state = createState();
      const far = regionPosToId(half, 0);
      state.world.terrain.add(regionPosToId(0, 0), grass);
      state.world.terrain.add(far, grass);

      frame(state);

      expect([...state.world.terrain.ids]).toEqual(["0,0"]);
      expect(state.send).toHaveBeenCalledExactlyOnceWith({
        type: "unload",
        ids: [far],
      });
    });

    it("keeps regions on the inclusive lower and exclusive upper edge", () => {
      const state = createState();
      state.world.terrain.add(regionPosToId(-half, 0), grass);
      state.world.terrain.add(regionPosToId(half - 1, 0), grass);

      frame(state);

      expect([...state.world.terrain.ids]).toEqual([
        regionPosToId(-half, 0),
        regionPosToId(half - 1, 0),
      ]);
      expect(state.send).not.toHaveBeenCalled();
    });

    it("sends nothing when there is nothing to unload", () => {
      const state = createState();
      state.world.terrain.add(regionPosToId(0, 0), grass);

      frame(state);

      expect(state.send).not.toHaveBeenCalled();
    });

    it("is centred on the region the player is in", () => {
      const state = createState(Vector.create(5.5 * REGION_SIDE_LENGTH, 0));
      const behind = regionPosToId(5 - half - 1, 0);
      state.world.terrain.add(regionPosToId(0, 0), grass);
      state.world.terrain.add(behind, grass);

      frame(state);

      expect([...state.world.terrain.ids]).toEqual(["0,0"]);
      expect(state.send).toHaveBeenCalledExactlyOnceWith({
        type: "unload",
        ids: [behind],
      });
    });

    it("unloads in one message, in store order", () => {
      const state = createState();
      const [a, b] = [regionPosToId(half, 0), regionPosToId(0, -half - 1)];
      state.world.terrain.add(a, grass);
      state.world.terrain.add(b, grass);

      frame(state);

      expect(state.send).toHaveBeenCalledExactlyOnceWith({
        type: "unload",
        ids: [a, b],
      });
    });

    it("happens before the systems run", () => {
      const state = createState();
      const far = regionPosToId(half, 0);
      state.world.terrain.add(far, grass);
      const seenByFirstSystem: boolean[] = [];
      systems[0]?.mockImplementation(({ world }) => {
        seenByFirstSystem.push(world.terrain.optGet(far) != null);
      });

      frame(state);

      expect(seenByFirstSystem).toEqual([false]);
    });
  });
});
