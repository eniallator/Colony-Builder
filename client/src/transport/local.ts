import { isInstance } from "deep-guards";

import type { ClientTransport } from "./types.ts";

const isBytes = isInstance(Uint8Array);

export const connectLocal = (): ClientTransport => {
  const worker = new Worker(new URL("../../worker/index.ts", import.meta.url), {
    name: "game-worker",
  });

  return {
    send: bytes => {
      worker.postMessage(bytes, [bytes.buffer]);
    },
    onMessage: listener => {
      worker.addEventListener("message", ({ data }) => {
        if (isBytes(data)) listener(data);
      });
    },
  };
};
