import { MAX_DT } from "@colony-builder/shared";

import type { Game } from "./game.ts";

export const createTicker = (game: Game, now: () => number): (() => void) => {
  let last = now();

  return () => {
    const current = now();
    game.tick(Math.min((current - last) / 1000, MAX_DT));
    last = current;
  };
};
