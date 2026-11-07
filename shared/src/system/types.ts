import type { World } from "../stores/index.ts";

export interface SystemContext {
  world: World;
  dt: number;
}

export type System<Ctx = unknown> = (ctx: SystemContext & Ctx) => void;
