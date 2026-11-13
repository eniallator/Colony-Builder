import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("serves the game on the worker's own scope", async () => {
  const postMessage = vi
    .spyOn(self, "postMessage")
    .mockImplementation(() => undefined);

  await import("./index.ts");

  expect(postMessage).toHaveBeenCalledOnce();
  expect(postMessage.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
});
