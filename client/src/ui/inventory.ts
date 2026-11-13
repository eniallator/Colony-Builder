import {
  itemDataRegistry,
  TEXTURE_BASE_URL,
  type Inventory,
  type Item,
  type ItemId,
} from "@colony-builder/shared";
import { addListener, getElement, toElement } from "niall-utils/ui";

import { getAtlas } from "../render/atlas.ts";
import type { State } from "../state.ts";
import type { ClientSystem } from "../system.ts";

export const createInventoryRow = (id: ItemId, { count }: Item) => {
  const { label } = itemDataRegistry[id];
  return toElement(
    `<li class="item" data-item="${id}">
      <span class="icon"></span>
      <span class="label">${label}</span>
      <span class="count">${count.toLocaleString()}</span>
    </li>`
  );
};

/**
 * Shows the item's atlas sprite by offsetting the sheet (the icon's CSS
 * background) to its cell, and tints the row with the sprite's colour. The
 * atlas loads lazily, so this is retried on every update until it succeeds.
 */
const paintInventoryIcon = (row: HTMLElement, id: ItemId) => {
  const icon = getElement(".icon", row);
  if (icon.dataset["painted"] != null) return;

  const atlas = getAtlas();
  const sprite = atlas?.sprites.get(`item_${id}`);
  const cell = sprite?.cells.at(0);
  if (atlas == null || sprite == null || cell == null) return;

  const { tileSize, sheet } = atlas;
  icon.style.setProperty("--atlas-url", `url("${TEXTURE_BASE_URL}atlas.png")`);
  icon.style.setProperty("--cell-x", `${cell[0]}`);
  icon.style.setProperty("--cell-y", `${cell[1]}`);
  icon.style.setProperty("--sheet-cols", `${sheet.width / tileSize}`);
  icon.style.setProperty("--sheet-rows", `${sheet.height / tileSize}`);
  icon.dataset["painted"] = "";
  row.style.setProperty("--item-color", sprite.colour);
};

const updateInventoryRow = (row: HTMLElement, id: ItemId, { count }: Item) => {
  paintInventoryIcon(row, id);
  const countEl = getElement(".count", row);
  const text = count.toLocaleString();
  if (countEl.textContent !== text) countEl.textContent = text;
};

/** Reconciles the list's rows with the inventory, mirroring `EntityStore.applySnapshot`. */
export const renderInventoryList = (
  list: HTMLUListElement,
  search: string,
  inventory: Inventory = new Map()
) => {
  const query = search.trim().toLowerCase();
  const matches = [...inventory].filter(([id]) =>
    itemDataRegistry[id].label.toLowerCase().includes(query)
  );
  const seen = new Set<string>(matches.map(([id]) => id));

  for (const row of list.querySelectorAll<HTMLElement>("li.item")) {
    if (row.dataset["item"] == null || !seen.has(row.dataset["item"])) {
      row.remove();
    }
  }

  for (const [i, [id, item]] of matches.entries()) {
    const row =
      list.querySelector<HTMLElement>(`li.item[data-item="${id}"]`) ??
      createInventoryRow(id, item);

    updateInventoryRow(row, id, item);
    if (list.children[i] !== row) {
      list.insertBefore(row, list.children[i] ?? null);
    }
  }

  const empty = list.querySelector<HTMLElement>("li.empty");
  if (matches.length > 0) {
    empty?.remove();
  } else {
    const text = inventory.size > 0 ? "No matching items" : "Empty";
    if (empty == null) list.append(toElement(`<li class="empty">${text}</li>`));
    else if (empty.textContent !== text) empty.textContent = text;
  }
};

const getInventoryElements = () => {
  const dialog = getElement<HTMLDialogElement>("#inventory-modal");
  return {
    dialog,
    search: getElement<HTMLInputElement>(".search", dialog),
    list: getElement<HTMLUListElement>("ul", dialog),
  };
};

/** Keeps the open inventory dialog in sync with the inspected entity's inventory. */
export const renderInventoryDialog: ClientSystem = ({ inventoryId, world }) => {
  const { dialog, search, list } = getInventoryElements();
  if (dialog.open) {
    renderInventoryList(
      list,
      search.value,
      inventoryId != null
        ? world.entities.optGet(inventoryId, "inventory")
        : undefined
    );
  }
};

export const setupInventoryDialog = (
  state: Pick<State, "playerId" | "inventoryId">
) => {
  const { dialog, search } = getInventoryElements();

  addListener(getElement("#inventory-btn"), "click", () => {
    state.inventoryId = state.playerId;
    search.value = "";
    dialog.showModal();
  });
  addListener(dialog, "click", evt => {
    if (evt.target === dialog) dialog.close();
  });
  addListener(dialog, "close", () => {
    delete state.inventoryId;
  });
};
