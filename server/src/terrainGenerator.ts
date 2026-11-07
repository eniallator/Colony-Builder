import type { TerrainGenerator } from "@colony-builder/shared";

export const terrainGenerator: TerrainGenerator = (x, y) => {
  if (x === 30 && y === -10) return "iron_deposit";
  else if (y === -5 && x <= 30 && x > 15) return "conveyor_left";
  else return "grass";
};
