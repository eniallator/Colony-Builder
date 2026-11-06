import type { Inventory } from "./types.ts";

export const mergeInventories = (
  from: Inventory,
  to: Inventory
): Inventory | null => {
  for (const [id, item] of from) {
    const existing = to.get(id);

    if (existing != null) existing.count += item.count;
    else to.set(id, item);
  }

  return null;
};
