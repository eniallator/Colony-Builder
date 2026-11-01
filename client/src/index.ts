import {
  encClientMessage,
  encServerMessage,
  MAX_ZOOM,
  MIN_ZOOM,
  SOCKET_PORT,
  TPS,
  UNLOADED_SIDE_LENGTH,
  World,
  worldToRegionPos,
} from "@colony-builder/shared";
import { isInstance } from "deep-guards";
import { clamp } from "niall-utils";
import { Vector } from "vectyped";

import { messageHandler } from "./message/handler.ts";
import type { State } from "./state.ts";
import { clientSystems, type ClientSystem } from "./system.ts";
import { appMethods, fromCanvasCoords } from "./ui/index.ts";

const isArrayBuffer = isInstance(ArrayBuffer);

const ZOOM_STEPS: Partial<Record<string, number>> = {
  Equal: 1,
  NumpadAdd: 1,
  Minus: -1,
  NumpadSubtract: -1,
};

export const app = appMethods<State>({
  init: ({ canvas, mouse, keyboard }) => {
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

    keyboard.setOnDown(({ code }) => {
      const step = ZOOM_STEPS[code] ?? 0;
      state.camera.zoom = clamp(state.camera.zoom + step, MIN_ZOOM, MAX_ZOOM);
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
