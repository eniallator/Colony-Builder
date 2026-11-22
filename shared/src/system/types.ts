import type { Time } from "../time.ts";
import type { World } from "../world/index.ts";

export interface SystemContext {
  world: World;
  dt: number;
  time: Time;
}

export type System<Ctx = unknown> = (ctx: SystemContext & Ctx) => void;
