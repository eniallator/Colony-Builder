import {
  encClientMessage,
  encServerMessage,
  SOCKET_PORT,
  TPS,
  UNLOADED_SIDE_LENGTH,
  World,
  worldToRegionPos,
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
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${protocol}://${location.hostname}:${SOCKET_PORT}`
    );

    const state: State = {
      camera: { center: Vector.zero(2), zoom: 2 },
      world: new World(),
      send: message => {
        socket.send(encClientMessage.encode(message));
      },
    };

    socket.binaryType = "arraybuffer";

    socket.addEventListener("message", ({ data }) => {
      const message = isArrayBuffer(data)
        ? encServerMessage.decode(new Uint8Array(data))
        : undefined;

      if (message != null) messageHandler(state, message);
    });

    mouse.setOnDown(() => {
      const mouseWorldPos = fromCanvasCoords(canvas, state.camera, mouse.pos);
      state.send({ type: "move", position: mouseWorldPos });
    });

    return state;
  },

  animationFrame: ({ getState, canvas, ctx, time }) => {
    const { playerId, world, camera, send } = getState();
    const dt = Math.min(time.delta, 2 / TPS);

    const systemCtx: Parameters<ClientSystem>[0] = {
      camera,
      playerId,
      time,
      canvas,
      ctx,
      world,
      dt,
    };

    const playerPos =
      playerId != null
        ? world.entities.optGet(playerId, "position")
        : undefined;
    if (playerPos != null) {
      const unloaded = world.terrain.unloadOutside(
        ...worldToRegionPos(...playerPos.toArray()),
        UNLOADED_SIDE_LENGTH
      );
      if (unloaded.length > 0) send({ type: "unload", ids: unloaded });
    }

    for (const system of clientSystems) system(systemCtx);
  },
});
