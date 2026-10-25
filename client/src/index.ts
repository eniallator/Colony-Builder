import {
  createDestinationMessage,
  DEFAULT_PORT,
  formatClientMessage,
  isServerMessage,
  parseJson,
  TPS,
  World,
} from "@colony-builder/shared";
import { isString } from "deep-guards";
import { Vector } from "vectyped";

import { messageHandler } from "./message/handler.ts";
import type { State } from "./state.ts";
import { clientSystems, type ClientSystemContext } from "./system.ts";
import { appMethods, fromCanvasCoords } from "./ui/index.ts";

export const app = appMethods<State>({
  init: ({ canvas, mouse }) => {
    const state: State = {
      camera: { center: Vector.zero(2), zoom: 0 },
      world: new World(),
    };

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${protocol}://${location.hostname}:${DEFAULT_PORT}`
    );

    socket.addEventListener("message", ({ data }) => {
      const message = isString(data)
        ? parseJson(data, isServerMessage)
        : undefined;

      if (message != null) messageHandler(state, message);
    });

    mouse.setOnDown(() => {
      const mouseWorldPos = fromCanvasCoords(canvas, state.camera, mouse.pos);
      socket.send(
        formatClientMessage(createDestinationMessage(mouseWorldPos.toArray()))
      );
    });

    return state;
  },

  animationFrame: ({ getState, canvas, ctx, time }) => {
    const { playerId, world, camera } = getState();
    const dt = Math.min(time.delta, 2 / TPS);

    const systemCtx: ClientSystemContext = {
      camera,
      playerId,
      time,
      canvas,
      ctx,
      world,
      dt,
    };

    for (const system of clientSystems) system(systemCtx);
  },
});
