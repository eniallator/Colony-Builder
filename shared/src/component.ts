import { tuple } from "niall-utils/core";
import type { Vector } from "vectyped";

export interface Components {
  position: Vector<2>;
  destination: Vector<2>;
  controller: { destination: Vector<2> };
  speed: number;
}

export const componentNames = tuple(
  "position",
  "destination",
  "controller",
  "speed"
);
export type ComponentName = (typeof componentNames)[number];

const _check: keyof Components extends ComponentName
  ? ComponentName extends keyof Components
    ? unknown
    : never
  : never = null;
