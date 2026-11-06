import type { Inventory } from "@colony-builder/shared";
import { getElement, toElement } from "niall-utils/ui";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  createInventoryRow,
  ITEM_RENDER_DATA,
  renderInventoryList,
  setupInventoryDialog,
} from "./inventory.ts";

const inventory: Inventory = new Map([
  ["iron_ore", { count: 1234 }],
  ["log", { count: 2 }],
]);

const texts = (list: HTMLUListElement) =>
  [...list.children].map(child =>
    child.textContent.trim().replace(/\s+/g, " ")
  );

describe("createInventoryRow", () => {
  it("shows the icon, label and localised count", () => {
    const row = createInventoryRow("iron_ore", { count: 1234 });

    expect(row.classList.contains("item")).toBe(true);
    expect(row.style.getPropertyValue("--item-color")).toBe(
      ITEM_RENDER_DATA.iron_ore.color
    );
    expect(row.querySelector(".icon svg")).not.toBeNull();
    expect(row.querySelector(".label")?.textContent).toBe("Iron Ore");
    expect(row.querySelector(".count")?.textContent).toBe(
      (1234).toLocaleString()
    );
  });
});

describe("renderInventoryList", () => {
  const list = toElement("<ul></ul>");

  it("renders a row per item", () => {
    renderInventoryList(list, "", inventory);

    expect(texts(list)).toEqual([
      `Iron Ore ${(1234).toLocaleString()}`,
      "Log 2",
    ]);
  });

  it("filters by label, ignoring case and surrounding whitespace", () => {
    renderInventoryList(list, "  LOG ", inventory);

    expect(texts(list)).toEqual(["Log 2"]);
  });

  it("says when nothing matches the search", () => {
    renderInventoryList(list, "zzz", inventory);

    expect(texts(list)).toEqual(["No matching items"]);
  });

  it("says when the inventory is empty", () => {
    renderInventoryList(list, "", new Map());

    expect(texts(list)).toEqual(["Empty"]);
  });

  it("treats a missing inventory as empty", () => {
    renderInventoryList(list, "");

    expect(texts(list)).toEqual(["Empty"]);
  });

  it("replaces the previous rows", () => {
    renderInventoryList(list, "", inventory);
    renderInventoryList(list, "log", inventory);

    expect(list.children).toHaveLength(1);
  });
});

describe("setupInventoryDialog", () => {
  let dialog: HTMLDialogElement;
  let search: HTMLInputElement;
  let list: HTMLUListElement;
  let getInventory: () => Inventory | undefined;
  let showModal: Mock<() => void>;
  let close: Mock<() => void>;

  beforeEach(() => {
    document.body.replaceChildren(
      toElement('<button id="inventory-btn"></button>'),
      toElement(
        '<dialog id="inventory-modal"><input class="search" /><ul></ul></dialog>'
      )
    );
    dialog = getElement<HTMLDialogElement>("#inventory-modal");
    search = getElement<HTMLInputElement>(".search", dialog);
    list = getElement<HTMLUListElement>("ul", dialog);
    showModal = vi.fn();
    close = vi.fn();
    dialog.showModal = showModal;
    dialog.close = close;
    getInventory = () => inventory;
    setupInventoryDialog(() => getInventory());
  });

  it("opens with a cleared search and the current inventory", () => {
    search.value = "stale";

    getElement("#inventory-btn").click();

    expect(search.value).toBe("");
    expect(texts(list)).toHaveLength(2);
    expect(showModal).toHaveBeenCalledOnce();
  });

  it("shows an empty list when there is no inventory yet", () => {
    getInventory = () => undefined;

    getElement("#inventory-btn").click();

    expect(texts(list)).toEqual(["Empty"]);
  });

  it("re-filters as the search changes", () => {
    search.value = "iron";
    search.dispatchEvent(new Event("input"));

    expect(texts(list)).toEqual([`Iron Ore ${(1234).toLocaleString()}`]);
  });

  it("closes when the backdrop is clicked", () => {
    dialog.click();

    expect(close).toHaveBeenCalledOnce();
  });

  it("stays open when the content is clicked", () => {
    search.click();

    expect(close).not.toHaveBeenCalled();
  });
});
