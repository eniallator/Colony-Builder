import {
  allEntityTypes,
  createPlayer,
  REGION_SIDE_LENGTH,
  regionPosToId,
  tiles,
  tileToId,
  unsafeEntityId,
  World,
  worldPosToRegionIds,
  type ClientMessage,
  type StructureData,
} from "@colony-builder/shared";
import { raise } from "niall-utils/core";
import { toElement } from "niall-utils/ui";
import { Vector } from "vectyped";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { ClientSystem } from "../../system.ts";
import type { ClickableTarget, ClickDetails } from "../../ui/clickable.ts";
import { Keyboard } from "../../ui/keyboard.ts";
import { Mouse } from "../../ui/mouse.ts";
import { createStateful } from "../../ui/types.ts";
import { getAtlas, type Atlas, type AtlasSprite } from "../atlas.ts";
import { footPosOf, renderHUD } from "./render-hud.ts";

vi.mock("../atlas.ts", () => ({ getAtlas: vi.fn() }));

type StructureTarget = Extract<ClickableTarget, { domain: "structure" }>;

const CANVAS_SIZE = [100, 50] as const;

/** The space between a structure and its popover; matches `render-hud.ts`. */
const POPOVER_GAP = 8;

// The structure the popovers are about, and another of a different type.
const structure: StructureData = { type: "tree", data: true };
const otherStructure: StructureData = { type: "cactus", data: true };

const [entityType] = allEntityTypes;
const [groundTile] = tiles;

/** The structure is two tiles tall and rests on its 30th pixel row (of 32). */
const structureSprite = {
  mode: "variants",
  cells: [[0, 0]],
  colour: "#0a0",
  ground: 30,
  rows: 2,
  frames: [],
} satisfies AtlasSprite;

const atlas: Atlas = {
  tileSize: 16,
  sheet: { width: 16, height: 32 } as ImageBitmap,
  sprites: new Map([[structure.type, structureSprite]]),
};

// Where structures stand is covered by the popover placement tests below.
describe("footPosOf", () => {
  it("is an entity's position", () => {
    const world = new World();
    const position = Vector.create(3, 4);
    const id = createPlayer(world, position);

    expect(
      footPosOf(world, { domain: "entity", type: entityType, id })
    ).toEqual(position);
  });

  it("throws for a target of a kind it does not know", () => {
    expect(() =>
      // @ts-expect-error the domain is not one of the clickable targets
      footPosOf(new World(), { domain: "unknown" })
    ).toThrow("Value not exhausted");
  });
});

describe("renderHUD", () => {
  const canvas = toElement("<canvas></canvas>");
  canvas.width = CANVAS_SIZE[0];
  canvas.height = CANVAS_SIZE[1];

  const showPopover = vi.fn();
  const send = vi.fn<(message: ClientMessage) => void>();
  const log = vi.spyOn(console, "log");
  const clickDetails = createStateful<ClickDetails | null>(null);
  const sizeSpies: { mockRestore: () => void }[] = [];

  let world: World;
  let camera: { center: Vector<2>; zoom: number };
  let target: StructureTarget;
  let targetPos: Vector<2>;

  beforeAll(() => {
    // jsdom has no Popover API.
    Object.defineProperty(HTMLElement.prototype, "showPopover", {
      value: showPopover,
      configurable: true,
    });
  });

  beforeEach(() => {
    document.body.replaceChildren();
    showPopover.mockReset();
    send.mockReset();
    vi.mocked(getAtlas).mockReset();
    log.mockReset();
    log.mockImplementation(() => undefined);

    world = new World();
    world.structures.addStructureAt(30, 40, structure);
    const [regionId, subRegionId] = worldPosToRegionIds(30, 40);
    target = {
      domain: "structure",
      type: structure.type,
      regionId,
      subRegionId,
    };
    targetPos = Vector.create(
      ...(world.structures.optGetStructure(regionId, subRegionId)?.worldPos ??
        raise(new Error("Structure was not added")))
    );

    // Centred on the structure, so it is in the middle of the canvas.
    camera = { center: targetPos.copy(), zoom: 0 };
    clickDetails.setValue(null);
  });

  afterEach(() => {
    for (const spy of sizeSpies.splice(0)) spy.mockRestore();
    // Clears any popover left on screen.
    clickDetails.setValue(null);
    run();
  });

  const run = () => {
    const system: ClientSystem = renderHUD;
    system({
      world,
      canvas,
      ctx: canvas.getContext("2d") ?? raise(new Error("No 2d context")),
      camera,
      time: { now: 1, start: 0, lastFrame: 0.99, delta: 0.01 },
      dt: 0.01,
      mouse: new Mouse(canvas),
      keyboard: new Keyboard(),
      clickDetails,
      send,
    });
  };

  /** jsdom does no layout, so every element is 0x0 unless told otherwise. */
  const stubPopoverSize = (width: number, height: number) => {
    sizeSpies.push(
      vi
        .spyOn(HTMLElement.prototype, "offsetWidth", "get")
        .mockReturnValue(width),
      vi
        .spyOn(HTMLElement.prototype, "offsetHeight", "get")
        .mockReturnValue(height)
    );
  };

  const popovers = () =>
    document.body.querySelectorAll<HTMLElement>(".click-popover");
  const popover = () => popovers()[0] ?? raise(new Error("No popover shown"));
  const buttons = () => [...popover().querySelectorAll("button")];

  const click = (clicked: ClickableTarget | null) => {
    clickDetails.setValue({ target: clicked, worldPos: Vector.zero(2) });
    run();
  };

  it("throws for a target of a kind it does not know", () => {
    expect(() => {
      // @ts-expect-error the domain is not one of the clickable targets
      click({ domain: "unknown" });
    }).toThrow("Value not exhausted");
  });

  it("does nothing without click details", () => {
    run();

    expect(popovers()).toHaveLength(0);
    expect(log).not.toHaveBeenCalled();
    expect(clickDetails.value).toBeNull();
  });

  it("runs an entity's callback straight away and then clears the click", () => {
    const id = unsafeEntityId(42);

    click({ domain: "entity", type: entityType, id });

    expect(log).toHaveBeenCalledExactlyOnceWith(entityType, id);
    expect(clickDetails.value).toBeNull();
    expect(popovers()).toHaveLength(0);
  });

  it("dismisses an open popover when the click hit nothing", () => {
    click(target);
    expect(popovers()).toHaveLength(1);

    click(null);

    expect(popovers()).toHaveLength(0);
    expect(clickDetails.value?.target).toBeNull();
  });

  describe("a click on terrain", () => {
    const orePos = Vector.create(5, 5);

    beforeEach(() => {
      world.terrain.add(
        regionPosToId(0, 0),
        Array.from({ length: REGION_SIDE_LENGTH ** 2 }, () =>
          tileToId(groundTile)
        )
      );
      world.terrain.addTile(5, 5, tileToId("iron_deposit"));
      camera.center = orePos.copy();
    });

    const clickOre = () => {
      clickDetails.setValue({ target: null, worldPos: orePos });
      run();
    };

    it.each([
      ["iron_deposit", "Iron Deposit"],
      ["copper_deposit", "Copper Deposit"],
    ] as const)(
      "offers to gather from %s, titled by its name",
      (deposit, title) => {
        world.terrain.addTile(5, 5, tileToId(deposit));

        clickOre();

        expect(
          popover().querySelector(".click-popover-title")?.textContent
        ).toBe(title);
        expect(buttons().map(button => button.textContent)).toEqual(["Gather"]);
        expect(send).not.toHaveBeenCalled();
      }
    );

    it("sends a gatherTile message for the clicked position on Gather, then clears the click", () => {
      clickOre();

      buttons()[0]?.click();

      expect(send).toHaveBeenCalledExactlyOnceWith({
        type: "gatherTile",
        position: orePos,
      });
      expect(clickDetails.value).toBeNull();
      expect(popovers()).toHaveLength(0);
    });

    it("offers nothing on ground that cannot be mined", () => {
      world.terrain.addTile(5, 5, tileToId(groundTile));

      clickOre();

      expect(popovers()).toHaveLength(0);
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("a structure's select", () => {
    it("opens a popover of its options, titled by its type, and keeps the click", () => {
      click(target);

      expect(popovers()).toHaveLength(1);
      expect(showPopover).toHaveBeenCalledOnce();
      expect(popover().querySelector(".click-popover-title")?.textContent).toBe(
        structure.type
      );
      expect(buttons().map(button => button.textContent)).toEqual(["Gather"]);
      expect(clickDetails.value?.target).toBe(target);
    });

    it("puts the popover at the structure's position on screen", () => {
      click(target);

      // The camera is centred on the structure, so it is mid-canvas; the
      // popover hangs just below it.
      expect(popover().style.left).toBe(`${CANVAS_SIZE[0] / 2}px`);
      expect(popover().style.top).toBe(`${CANVAS_SIZE[1] / 2 + POPOVER_GAP}px`);
    });

    describe("placement", () => {
      it("is centred below the structure when there is room", () => {
        stubPopoverSize(40, 10);

        click(target);

        expect(popover().style.left).toBe(`${CANVAS_SIZE[0] / 2 - 20}px`);
        expect(popover().style.top).toBe(
          `${CANVAS_SIZE[1] / 2 + POPOVER_GAP}px`
        );
      });

      it("flips above the structure near the bottom of the canvas", () => {
        stubPopoverSize(40, 10);
        // Moves the structure down to y = 45, where 10px more does not fit.
        camera.center = targetPos.copy().sub([0, 20]);

        click(target);

        expect(popover().style.top).toBe(`${45 - POPOVER_GAP - 10}px`);
      });

      it("stays inside the canvas at the right edge", () => {
        stubPopoverSize(40, 10);
        camera.center = targetPos.copy().sub([45, 0]);

        click(target);

        expect(popover().style.left).toBe(`${CANVAS_SIZE[0] - 40}px`);
      });

      it("stays inside the canvas at the left edge", () => {
        stubPopoverSize(40, 10);
        camera.center = targetPos.copy().add([45, 0]);

        click(target);

        expect(popover().style.left).toBe("0px");
      });
    });

    describe("visibility", () => {
      // At 8px per tile the structure is 16px tall, and its top is 15px above
      // its base (the point it stands on).
      beforeEach(() => {
        camera.zoom = 3;
      });

      it("stays up while its top is on the canvas, though its base is off it", () => {
        vi.mocked(getAtlas).mockReturnValue(atlas);
        stubPopoverSize(40, 10);
        // Base at y = 60, below the 50px canvas; top at y = 45, on it.
        camera.center = targetPos.copy().sub([0, 35 / 8]);

        click(target);

        expect(popovers()).toHaveLength(1);
        // Kept inside the canvas, even though the base is not.
        expect(popover().style.top).toBe(`${CANVAS_SIZE[1] - 10}px`);
      });

      it("is dismissed once none of it is on the canvas", () => {
        vi.mocked(getAtlas).mockReturnValue(atlas);
        // Base at y = 80, top at y = 65.
        camera.center = targetPos.copy().sub([0, 55 / 8]);

        click(target);

        expect(popovers()).toHaveLength(0);
        expect(clickDetails.value).toBeNull();
      });

      it("goes by its base until the atlas has loaded", () => {
        camera.center = targetPos.copy().sub([0, 35 / 8]);

        click(target);

        expect(popovers()).toHaveLength(0);
        expect(clickDetails.value).toBeNull();
      });
    });

    it("sends a gatherStructure message for the picked option and then clears the click", () => {
      click(target);

      buttons()[0]?.click();

      expect(send).toHaveBeenCalledExactlyOnceWith({
        type: "gatherStructure",
        regionId: target.regionId,
        subRegionId: target.subRegionId,
      });
      expect(clickDetails.value).toBeNull();
      expect(popovers()).toHaveLength(0);
    });

    it("follows the structure as it moves on screen", () => {
      click(target);

      camera.center = targetPos.copy().sub([5, 0]);
      run();

      expect(popover().style.left).toBe(`${CANVAS_SIZE[0] / 2 + 5}px`);
      expect(popovers()).toHaveLength(1);
      expect(showPopover).toHaveBeenCalledOnce();
    });

    it("dismisses when the structure moves off the screen", () => {
      click(target);

      camera.center = targetPos.copy().add([1000, 0]);
      run();

      expect(popovers()).toHaveLength(0);
      expect(clickDetails.value).toBeNull();
    });

    it("dismisses when the structure no longer exists", () => {
      const [regionId, subRegionId] = worldPosToRegionIds(-500, -500);

      click({ ...target, regionId, subRegionId });

      expect(popovers()).toHaveLength(0);
      expect(clickDetails.value).toBeNull();
    });

    it("dismisses on a pointer press outside the popover", () => {
      click(target);

      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));

      expect(popovers()).toHaveLength(0);
      expect(clickDetails.value).toBeNull();
    });

    it("stays open on a pointer press inside the popover", () => {
      click(target);

      popover().dispatchEvent(new Event("pointerdown", { bubbles: true }));

      expect(popovers()).toHaveLength(1);
      expect(clickDetails.value?.target).toBe(target);
    });

    it("dismisses on Escape", () => {
      click(target);

      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Escape", bubbles: true })
      );

      expect(popovers()).toHaveLength(0);
      expect(clickDetails.value).toBeNull();
    });

    it("ignores other keys", () => {
      click(target);

      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyA", bubbles: true })
      );

      expect(popovers()).toHaveLength(1);
    });

    it("is replaced by the popover of a newly clicked target", () => {
      click(target);
      const first = popover();

      click({ ...target, type: otherStructure.type });

      expect(popovers()).toHaveLength(1);
      expect(popover()).not.toBe(first);
      expect(first.isConnected).toBe(false);
      expect(showPopover).toHaveBeenCalledTimes(2);
    });

    it("keeps one popover while the same target stays clicked", () => {
      click(target);
      run();
      run();

      expect(popovers()).toHaveLength(1);
      expect(showPopover).toHaveBeenCalledOnce();
    });
  });
});
