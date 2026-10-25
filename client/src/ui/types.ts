import type { Keyboard } from "./keyboard.ts";
import type { Mouse } from "./mouse.ts";

export interface Time {
  lastFrame: number;
  delta: number;
  start: number;
  now: number;
}

export interface AppContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mouse: Mouse;
  keyboard: Keyboard;
  time: Time;
}

export interface StatefulAppContext<
  S extends NonNullable<unknown> | null,
> extends AppContext {
  getState: () => S;
  setState: (state: S) => void;
}

export interface AppMethods<S extends NonNullable<unknown> | null> {
  init: S extends null
    ? (this: AppMethods<S>, appContext: AppContext) => void
    : (this: AppMethods<S>, appContext: AppContext) => S;
  animationFrame?: (
    this: AppMethods<S>,
    appContext: StatefulAppContext<S>
  ) => void;
  onResize?: (
    this: AppMethods<S>,
    evt: UIEvent,
    appContext: StatefulAppContext<S>
  ) => void;
}

export const appMethods = <const S extends NonNullable<unknown> | null = null>(
  methods: AppMethods<S>
): AppMethods<S> => methods;
