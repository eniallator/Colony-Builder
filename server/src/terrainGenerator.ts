import type { TerrainGenerator } from "@colony-builder/shared";
import { tuple } from "niall-utils/core";
import { positiveMod } from "niall-utils/math";

const CONVEYORS = tuple(
  "conveyor_up",
  "conveyor_down",
  "conveyor_left",
  "conveyor_right"
);

export const terrainGenerator: TerrainGenerator = (x, y) =>
  CONVEYORS[positiveMod(x + 2 * y, 4)] ?? CONVEYORS[0];
