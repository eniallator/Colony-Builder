import { raise } from "niall-utils/core";
import { addListener, getElement } from "niall-utils/ui";

import { app } from "./index.ts";
import {
  Keyboard,
  Mouse,
  type AppContext,
  type StatefulAppContext,
} from "./ui/index.ts";

const updateCanvasBounds = (canvas: HTMLCanvasElement) => {
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = width;
  canvas.height = height;
};

const canvas = getElement<HTMLCanvasElement>("canvas");
updateCanvasBounds(canvas);

addListener(getElement("#fullscreen-btn"), "click", () => {
  void (document.fullscreenElement != null
    ? document.exitFullscreen()
    : getElement("main").requestFullscreen());
});

const ctx =
  canvas.getContext("2d") ??
  raise(
    new Error(
      `Could not get a 2D rendering context for element ${JSON.stringify(canvas)}`
    )
  );

const now = Date.now() / 1000;
const appCtx: AppContext = {
  time: { now, start: now, lastFrame: now, delta: 0 },
  mouse: new Mouse(canvas),
  keyboard: new Keyboard(),
  canvas,
  ctx,
};

let state = app.init(appCtx);
const statefulCtx: StatefulAppContext<typeof state> = {
  ...appCtx,
  getState: () => state,
  setState: newState => {
    state = newState;
  },
};

window.onresize = evt => {
  updateCanvasBounds(canvas);
  app.onResize?.(evt, statefulCtx);
};

const animate = () => {
  if (app.animationFrame != null) {
    const { time } = statefulCtx;
    time.lastFrame = time.now;
    time.now = Date.now() / 1000;
    time.delta = time.now - time.lastFrame;

    app.animationFrame(statefulCtx);
    statefulCtx.keyboard.endFrame();
    requestAnimationFrame(animate);
  }
};
animate();
