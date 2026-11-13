import { raise } from "niall-utils/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectLocal } from "./local.ts";

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];

  readonly postMessage =
    vi.fn<(message: Uint8Array, transfer: ArrayBuffer[]) => void>();

  readonly url: URL;
  readonly options: WorkerOptions | undefined;

  constructor(url: URL, options?: WorkerOptions) {
    super();
    this.url = url;
    this.options = options;
    FakeWorker.instances.push(this);
  }
}

const lastWorker = () =>
  FakeWorker.instances.at(-1) ?? raise(new Error("No Worker was started"));

const message = (data: unknown) => new MessageEvent("message", { data });

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("connectLocal", () => {
  it("starts the game worker", () => {
    connectLocal();

    expect(lastWorker().url.pathname).toMatch(/\/worker\/index\.ts$/);
    expect(lastWorker().options).toEqual({ name: "game-worker" });
  });

  describe("send", () => {
    it("hands the bytes' buffer to the worker instead of copying it", () => {
      const bytes = Uint8Array.of(1, 2, 3);

      connectLocal().send(bytes);

      const [sent, transfer] =
        lastWorker().postMessage.mock.calls[0] ??
        raise(new Error("Nothing was posted"));
      expect(sent).toBe(bytes);
      expect(transfer).toHaveLength(1);
      expect(transfer[0]).toBe(bytes.buffer);
    });
  });

  describe("onMessage", () => {
    it("passes bytes from the worker to the listener", () => {
      const listener = vi.fn();
      connectLocal().onMessage(listener);
      const bytes = Uint8Array.of(4, 5);

      lastWorker().dispatchEvent(message(bytes));

      expect(listener).toHaveBeenCalledExactlyOnceWith(bytes);
    });

    it("ignores messages that are not bytes", () => {
      const listener = vi.fn();
      connectLocal().onMessage(listener);

      lastWorker().dispatchEvent(message("hello"));

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
