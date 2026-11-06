import {
  itemDataRegistry,
  type Inventory,
  type Item,
  type ItemId,
} from "@colony-builder/shared";
import { addListener, getElement, toElement } from "niall-utils/ui";

export const ITEM_RENDER_DATA = {
  iron_ore: {
    color: "#8fa3b8",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 15l3.5-8L13 3l6 4.5 2 7.5-5.5 6H8z"/></svg>',
  },
  log: {
    color: "#b07840",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
  },
} as const satisfies Record<ItemId, { icon: string; color: string }>;

export const createInventoryRow = (id: ItemId, { count }: Item) => {
  const { label } = itemDataRegistry[id];
  const { color, icon } = ITEM_RENDER_DATA[id];
  return toElement(
    `<li class="item" style="--item-color: ${color}">
      <span class="icon">${icon}</span>
      <span class="label">${label}</span>
      <span class="count">${count.toLocaleString()}</span>
    </li>`
  );
};

export const renderInventoryList = (
  list: HTMLUListElement,
  search: string,
  inventory: Inventory = new Map()
) => {
  const rows = [
    ...inventory
      .entries()
      .filter(([id]) =>
        itemDataRegistry[id].label
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
      .map(([id, item]) => createInventoryRow(id, item)),
  ];

  list.replaceChildren(
    ...(rows.length > 0
      ? rows
      : [
          toElement(
            `<li class="empty">${inventory.size > 0 ? "No matching items" : "Empty"}</li>`
          ),
        ])
  );
};

export const setupInventoryDialog = (
  getInventory: () => Inventory | undefined
) => {
  const dialog = getElement<HTMLDialogElement>("#inventory-modal");
  const search = getElement<HTMLInputElement>(".search", dialog);
  const list = getElement<HTMLUListElement>("ul", dialog);

  addListener(getElement("#inventory-btn"), "click", () => {
    search.value = "";
    renderInventoryList(list, search.value, getInventory());
    dialog.showModal();
  });
  addListener(search, "input", () => {
    renderInventoryList(list, search.value, getInventory());
  });
  addListener(dialog, "click", evt => {
    if (evt.target === dialog) dialog.close();
  });
};
