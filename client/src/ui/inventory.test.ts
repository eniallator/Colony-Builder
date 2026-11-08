import {
  createPlayer,
  unsafeEntityId,
  World,
  type EntityId,
  type Inventory,
} from "@colony-builder/shared";
import { raise } from "niall-utils/core";
import { getElement, toElement } from "niall-utils/ui";
import { Vector } from "vectyped";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { State } from "../state.ts";
import {
  createInventoryRow,
  ITEM_RENDER_DATA,
  renderInventoryDialog,
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

  it("removes rows that no longer match", () => {
    renderInventoryList(list, "", inventory);
    renderInventoryList(list, "log", inventory);

    expect(list.children).toHaveLength(1);
  });

  it("updates existing rows in place", () => {
    renderInventoryList(list, "", new Map([["log", { count: 2 }]]));
    const row = list.children[0];

    renderInventoryList(list, "", new Map([["log", { count: 5 }]]));

    expect(list.children[0]).toBe(row);
    expect(texts(list)).toEqual(["Log 5"]);
  });

  it("adds rows for new items without touching existing ones", () => {
    renderInventoryList(list, "", new Map([["log", { count: 2 }]]));
    const row = list.children[0];

    renderInventoryList(list, "", inventory);

    expect(list.children[1]).toBe(row);
    expect(texts(list)).toEqual([
      `Iron Ore ${(1234).toLocaleString()}`,
      "Log 2",
    ]);
  });

  it("replaces the placeholder once items arrive", () => {
    renderInventoryList(list, "", new Map());
    renderInventoryList(list, "", inventory);

    expect(list.querySelector(".empty")).toBeNull();
    expect(list.children).toHaveLength(2);
  });
});

describe("renderInventoryDialog", () => {
  const canvas = toElement("<canvas></canvas>");

  const run = (inventoryId?: EntityId, world = new World()) => {
    renderInventoryDialog({
      inventoryId,
      world,
      canvas,
      ctx: canvas.getContext("2d") ?? raise(new Error("No 2d context")),
      camera: { center: Vector.zero(2), zoom: 0 },
      time: { now: 1, start: 0, lastFrame: 0.99, delta: 0.01 },
      dt: 0.01,
    });
  };

  let dialog: HTMLDialogElement;

  beforeEach(() => {
    document.body.replaceChildren(
      toElement(
        '<dialog id="inventory-modal"><input class="search" /><ul></ul></dialog>'
      )
    );
    dialog = getElement<HTMLDialogElement>("#inventory-modal");
  });

  it("does nothing while the dialog is closed", () => {
    run();

    expect(getElement("ul", dialog).children).toHaveLength(0);
  });

  it("shows the inspected entity's live inventory while open", () => {
    const world = new World();
    const id = createPlayer(world);
    dialog.open = true;

    run(id, world);
    world.entities.optGet(id, "inventory")?.set("log", { count: 3 });
    run(id, world);

    expect(texts(getElement("ul", dialog))).toEqual(["Log 3"]);
  });

  it("is empty when no entity is being inspected", () => {
    dialog.open = true;

    run();

    expect(texts(getElement("ul", dialog))).toEqual(["Empty"]);
  });
});

describe("setupInventoryDialog", () => {
  let dialog: HTMLDialogElement;
  let search: HTMLInputElement;
  let showModal: Mock<() => void>;
  let close: Mock<() => void>;
  let state: Pick<State, "playerId" | "inventoryId">;

  beforeEach(() => {
    state = { playerId: unsafeEntityId(1) };
    document.body.replaceChildren(
      toElement('<button id="inventory-btn"></button>'),
      toElement(
        '<dialog id="inventory-modal"><input class="search" /><ul></ul></dialog>'
      )
    );
    dialog = getElement<HTMLDialogElement>("#inventory-modal");
    search = getElement<HTMLInputElement>(".search", dialog);
    showModal = vi.fn();
    close = vi.fn();
    dialog.showModal = showModal;
    dialog.close = close;
    setupInventoryDialog(state);
  });

  it("opens with a cleared search, inspecting the player", () => {
    search.value = "stale";

    getElement("#inventory-btn").click();

    expect(search.value).toBe("");
    expect(state.inventoryId).toBe(state.playerId);
    expect(showModal).toHaveBeenCalledOnce();
  });

  it("stops inspecting an entity once closed", () => {
    getElement("#inventory-btn").click();

    dialog.dispatchEvent(new Event("close"));

    expect(state.inventoryId).toBeUndefined();
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
