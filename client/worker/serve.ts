import { createGame, createTicker } from "@colony-builder/server-core";
import { TPS } from "@colony-builder/shared";
import { isInstance } from "deep-guards";

const isBytes = isInstance(Uint8Array);

export interface WorkerScope {
  postMessage: (
    message: Uint8Array<ArrayBuffer>,
    transfer: ArrayBuffer[]
  ) => void;
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent) => void
  ) => void;
}

/** Runs one game with the scope's page as its only client. */
export const serveGame = (scope: WorkerScope): void => {
  const game = createGame();
  const session = game.connect({
    send: bytes => {
      scope.postMessage(bytes, [bytes.buffer]);
    },
  });

  scope.addEventListener("message", ({ data }) => {
    if (isBytes(data)) session.receive(data);
  });

  setInterval(createTicker(game, Date.now), 1000 / TPS);
};
