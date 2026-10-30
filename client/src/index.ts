import {
  encClientMessage,
  encDestinationMessage,
  encServerMessage,
  EntityStore,
  SOCKET_PORT,
  TPS,
} from "@colony-builder/shared";
import { isInstance } from "deep-guards";
import { Vector } from "vectyped";

import { messageHandler } from "./message/handler.ts";
import type { State } from "./state.ts";
import { clientSystems, type ClientSystem } from "./system.ts";
import { appMethods, fromCanvasCoords } from "./ui/index.ts";

const isArrayBuffer = isInstance(ArrayBuffer);

export const app = appMethods<State>({
  init: ({ canvas, mouse }) => {
    const state: State = {
      camera: { center: Vector.zero(2), zoom: 0 },
      store: new EntityStore(),
    };

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${protocol}://${location.hostname}:${SOCKET_PORT}`
    );

    socket.binaryType = "arraybuffer";

    socket.addEventListener("message", ({ data }) => {
      const message = isArrayBuffer(data)
        ? encServerMessage.decode(new Uint8Array(data))
        : undefined;

      if (message != null) messageHandler(state, message);
    });

    mouse.setOnDown(() => {
      const mouseWorldPos = fromCanvasCoords(canvas, state.camera, mouse.pos);
      socket.send(
        encClientMessage.encode(
          encDestinationMessage.create(...mouseWorldPos.toArray())
        )
      );
    });

    return state;
  },

  animationFrame: ({ getState, canvas, ctx, time }) => {
    const { playerId, store, camera } = getState();
    const dt = Math.min(time.delta, 2 / TPS);

    const systemCtx: Parameters<ClientSystem>[0] = {
      camera,
      playerId,
      time,
      canvas,
      ctx,
      store,
      dt,
    };

    for (const system of clientSystems) system(systemCtx);
  },
});
