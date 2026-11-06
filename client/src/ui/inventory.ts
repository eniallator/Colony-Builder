import {
  itemDataRegistry,
  type Inventory,
  type Item,
  type ItemId,
} from "@colony-builder/shared";
import { addListener, getElement, toElement } from "niall-utils/ui";

export const createInventoryRow = (id: ItemId, { count }: Item) => {
  const { label, color, icon } = itemDataRegistry[id];
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
