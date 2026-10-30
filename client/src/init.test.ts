import { EntityStore } from "@colony-builder/shared";
import { getElement, raise, toElement } from "niall-utils";
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

import type { State } from "./state.ts";
import type { AppContext, StatefulAppContext } from "./ui/index.ts";

interface MockApp {
  init: Mock<(ctx: AppContext) => State>;
  animationFrame?: Mock<(ctx: StatefulAppContext<State>) => void>;
  onResize?: Mock<(evt: UIEvent, ctx: StatefulAppContext<State>) => void>;
}

const { app, requestAnimationFrame } = vi.hoisted(
  (): {
    app: MockApp;
    requestAnimationFrame: Mock<(cb: () => void) => number>;
  } => ({
    app: { init: vi.fn(), animationFrame: vi.fn(), onResize: vi.fn() },
    requestAnimationFrame: vi.fn(() => 0),
  })
);

vi.mock("./index.ts", () => ({ app }));

const NOW_MS = 1_000_000;

const createState = (): State => ({
  camera: { center: Vector.zero(2), zoom: 0 },
  store: new EntityStore(),
});

const load = async () => {
  await import("./init.ts");
};

const nextFrame = () => {
  requestAnimationFrame.mock.calls[0]?.[0]();
};

const initCtx = () =>
  app.init.mock.calls[0]?.[0] ?? raise(new Error("app.init was not called"));

const frameCtx = () =>
  app.animationFrame?.mock.calls[0]?.[0] ??
  raise(new Error("app.animationFrame was not called"));

const addTitle = (innerText: string) => {
  const title = toElement("<title></title>");
  Object.defineProperty(title, "innerText", { value: innerText });
  document.head.append(title);
};

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW_MS);
  vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);

  document.head.innerHTML = "";
  document.body.innerHTML = `
    <main>
      <canvas></canvas>
      <button id="download-btn"></button>
      <button id="fullscreen-btn"></button>
      <button id="config-dropdown-btn"></button>
      <dialog id="config-modal"><div id="inner"></div></dialog>
    </main>`;

  app.init.mockReset().mockReturnValue(createState());
  app.animationFrame = vi.fn();
  app.onResize = vi.fn();
  requestAnimationFrame.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("canvas", () => {
  it("is sized to its bounding rect", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 300, 150)
    );

    await load();

    const canvas = getElement<HTMLCanvasElement>("canvas");
    expect([canvas.width, canvas.height]).toEqual([300, 150]);
  });

  it("is resized with the window", async () => {
    await load();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 640, 480)
    );

    const evt = new UIEvent("resize");
    window.onresize?.(evt);

    const canvas = getElement<HTMLCanvasElement>("canvas");
    expect([canvas.width, canvas.height]).toEqual([640, 480]);
    expect(app.onResize).toHaveBeenCalledExactlyOnceWith(evt, frameCtx());
  });

  it("resizes without an onResize handler", async () => {
    delete app.onResize;
    await load();

    expect(() => {
      window.onresize?.(new UIEvent("resize"));
    }).not.toThrow();
  });

  it("throws when there is no 2d context", async () => {
    getElement<HTMLCanvasElement>("canvas").getContext = () => null;

    await expect(load()).rejects.toThrow(
      "Could not get a 2D rendering context"
    );
  });
});

describe("app context", () => {
  it("initialises the app with the canvas, context and clock", async () => {
    await load();

    const ctx = initCtx();
    const canvas = getElement<HTMLCanvasElement>("canvas");
    expect(app.init).toHaveBeenCalledOnce();
    expect(ctx.canvas).toBe(canvas);
    expect(ctx.ctx).toBe(canvas.getContext("2d"));
    expect(ctx.time).toEqual({
      now: NOW_MS / 1000,
      start: NOW_MS / 1000,
      lastFrame: NOW_MS / 1000,
      delta: 0,
    });
  });

  it("exposes the app state through getState / setState", async () => {
    const state = createState();
    app.init.mockReturnValue(state);
    await load();

    const ctx = frameCtx();
    expect(ctx.getState()).toBe(state);

    const next = createState();
    ctx.setState(next);
    expect(ctx.getState()).toBe(next);
  });
});

describe("animation loop", () => {
  it("runs a frame immediately and schedules the next one", async () => {
    await load();

    expect(app.animationFrame).toHaveBeenCalledOnce();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
  });

  it("updates the clock on every frame", async () => {
    await load();

    vi.setSystemTime(NOW_MS + 500);
    nextFrame();

    const { time } = frameCtx();
    expect(app.animationFrame).toHaveBeenCalledTimes(2);
    expect(time.lastFrame).toBe(NOW_MS / 1000);
    expect(time.now).toBe(NOW_MS / 1000 + 0.5);
    expect(time.delta).toBe(0.5);
  });

  it("clears the keyboard's per-frame state at the end of a frame", async () => {
    await load();
    const { keyboard } = initCtx();

    document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
    expect(keyboard.wasPressed("KeyA")).toBe(true);

    nextFrame();

    expect(keyboard.wasPressed("KeyA")).toBe(false);
  });

  it("does not loop when the app has no animationFrame", async () => {
    delete app.animationFrame;

    await load();

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});

describe("download button", () => {
  const download = () => {
    let clicked: { download: string; href: string | null } | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked = {
        download: this.download,
        href: this.getAttribute("href"),
      };
    });
    getElement("#download-btn").click();
    return clicked;
  };

  it("downloads the canvas as download.png without a title", async () => {
    await load();

    const anchor = download();

    expect(anchor?.download).toBe("download.png");
    expect(anchor?.href).toBe(
      getElement<HTMLCanvasElement>("canvas").toDataURL()
    );
  });

  it("names the download after the page title", async () => {
    addTitle(" My Game ");
    await load();

    expect(download()?.download).toBe("my-game.png");
  });

  it("falls back to download.png for an empty title", async () => {
    addTitle("  ");
    await load();

    expect(download()?.download).toBe("download.png");
  });

  it("removes the temporary anchor afterwards", async () => {
    await load();
    download();

    expect(document.querySelector("a")).toBeNull();
  });
});

describe("fullscreen button", () => {
  it("requests fullscreen on the main element", async () => {
    await load();
    const requestFullscreen = vi.fn(() => Promise.resolve());
    getElement("main").requestFullscreen = requestFullscreen;

    getElement("#fullscreen-btn").click();

    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it("exits fullscreen when already fullscreen", async () => {
    await load();
    const exitFullscreen = vi.fn(() => Promise.resolve());
    document.exitFullscreen = exitFullscreen;
    Object.defineProperty(document, "fullscreenElement", {
      value: getElement("main"),
      configurable: true,
    });

    getElement("#fullscreen-btn").click();

    expect(exitFullscreen).toHaveBeenCalledOnce();
    Reflect.deleteProperty(document, "fullscreenElement");
  });
});

describe("config modal", () => {
  it("opens from the dropdown button", async () => {
    await load();
    const showModal = vi.fn();
    getElement<HTMLDialogElement>("#config-modal").showModal = showModal;

    getElement("#config-dropdown-btn").click();

    expect(showModal).toHaveBeenCalledOnce();
  });

  it("closes when the backdrop is clicked", async () => {
    await load();
    const close = vi.fn();
    getElement<HTMLDialogElement>("#config-modal").close = close;

    getElement("#config-modal").click();

    expect(close).toHaveBeenCalledOnce();
  });

  it("stays open when its contents are clicked", async () => {
    await load();
    const close = vi.fn();
    getElement<HTMLDialogElement>("#config-modal").close = close;

    getElement("#inner").click();

    expect(close).not.toHaveBeenCalled();
  });
});
