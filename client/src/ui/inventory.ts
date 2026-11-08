import {
  itemDataRegistry,
  type Inventory,
  type Item,
  type ItemId,
} from "@colony-builder/shared";
import { addListener, getElement, toElement } from "niall-utils/ui";

import type { State } from "../state.ts";
import type { ClientSystem } from "../system.ts";

export const ITEM_RENDER_DATA = {
  iron_ore: {
    color: "#8fa3b8",
    icon: '<svg fill="#8fa3b8" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 15l3.5-8L13 3l6 4.5 2 7.5-5.5 6H8z"/></svg>',
  },
  log: {
    color: "#b07840",
    icon: '<svg fill="#b07840" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
  },
} as const satisfies Record<ItemId, { icon: string; color: string }>;

export const createInventoryRow = (id: ItemId, { count }: Item) => {
  const { label } = itemDataRegistry[id];
  const { color, icon } = ITEM_RENDER_DATA[id];
  return toElement(
    `<li class="item" data-item="${id}" style="--item-color: ${color}">
      <span class="icon">${icon}</span>
      <span class="label">${label}</span>
      <span class="count">${count.toLocaleString()}</span>
    </li>`
  );
};

const updateInventoryRow = (row: HTMLElement, { count }: Item) => {
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

    updateInventoryRow(row, item);
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
