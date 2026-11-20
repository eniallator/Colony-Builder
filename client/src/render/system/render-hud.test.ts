import {
  createPlayer,
  unsafeEntityId,
  World,
  worldPosToRegionIds,
  type EntityId,
  type RegionId,
  type SubRegionId,
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
import {
  clickableCallback,
  clickableSelect,
  type ClickableHandlers,
  type ClickableTarget,
} from "../../ui/clickable.ts";
import { Keyboard } from "../../ui/keyboard.ts";
import { Mouse } from "../../ui/mouse.ts";
import { createStateful } from "../../ui/types.ts";
import { renderHUD } from "./render-hud.ts";

const CANVAS_SIZE = [100, 50] as const;

const OPTIONS = [
  { label: "Follow", value: "follow" },
  { label: "Stop", value: "stop" },
];

describe("renderHUD", () => {
  const canvas = toElement("<canvas></canvas>");
  canvas.width = CANVAS_SIZE[0];
  canvas.height = CANVAS_SIZE[1];

  const showPopover = vi.fn();
  const onClick = vi.fn<(id: EntityId) => void>();
  const onSelect = vi.fn<(value: string, id: EntityId) => void>();

  let world: World;
  let playerId: EntityId;
  let camera: { center: Vector<2>; zoom: number };
  const clickTarget = createStateful<ClickableTarget | null>(null);
  let clickHandlers: Partial<ClickableHandlers>;

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
    onClick.mockReset();
    onSelect.mockReset();

    world = new World();
    playerId = createPlayer(world, Vector.create(10, 10));
    camera = { center: Vector.create(10, 10), zoom: 0 };
    clickTarget.setValue(null);
    clickHandlers = {
      "entity.player": clickableSelect(OPTIONS, onSelect),
      "entity.robot": clickableCallback(onClick),
    };
  });

  afterEach(() => {
    // Clears any popover left on screen.
    clickTarget.setValue(null);
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
      clickTarget,
      clickHandlers,
    });
  };

  const popovers = () =>
    document.body.querySelectorAll<HTMLElement>(".click-popover");
  const popover = () => popovers()[0] ?? raise(new Error("No popover shown"));
  const buttons = () => [...popover().querySelectorAll("button")];

  const click = (target: ClickableTarget) => {
    clickTarget.setValue(target);
    run();
  };
  const clickPlayer = () => {
    click(["entity.player", playerId]);
  };

  it("does nothing without a click target", () => {
    run();

    expect(popovers()).toHaveLength(0);
    expect(clickTarget.value).toBeNull();
  });

  it("runs a callback straight away and then clears the target", () => {
    const robotId = unsafeEntityId(42);
    click(["entity.robot", robotId]);

    expect(onClick).toHaveBeenCalledExactlyOnceWith(robotId);
    expect(clickTarget.value).toBeNull();
    expect(popovers()).toHaveLength(0);
  });

  it("clears a target that nothing handles", () => {
    clickHandlers = {};
    clickPlayer();

    expect(clickTarget.value).toBeNull();
    expect(popovers()).toHaveLength(0);
  });

  describe("a select", () => {
    it("opens a popover of its options and keeps the target", () => {
      clickPlayer();

      expect(popovers()).toHaveLength(1);
      expect(showPopover).toHaveBeenCalledOnce();
      expect(buttons().map(button => button.textContent)).toEqual([
        "Follow",
        "Stop",
      ]);
      expect(clickTarget.value).toEqual(["entity.player", playerId]);
    });

    it("puts the popover at the target's position on screen", () => {
      clickPlayer();

      // The camera is centred on the player, so it is mid-canvas.
      expect(popover().style.left).toBe(`${CANVAS_SIZE[0] / 2}px`);
      expect(popover().style.top).toBe(`${CANVAS_SIZE[1] / 2}px`);
    });

    it("runs the handler with the picked option and then clears the target", () => {
      clickPlayer();

      buttons()[1]?.click();

      expect(onSelect).toHaveBeenCalledExactlyOnceWith("stop", playerId);
      expect(clickTarget.value).toBeNull();
      expect(popovers()).toHaveLength(0);
    });

    it("follows the target as it moves on screen", () => {
      clickPlayer();

      camera.center = Vector.create(5, 10);
      run();

      expect(popover().style.left).toBe(`${CANVAS_SIZE[0] / 2 + 5}px`);
      expect(popovers()).toHaveLength(1);
      expect(showPopover).toHaveBeenCalledOnce();
    });

    it("dismisses when the target moves off the screen", () => {
      clickPlayer();

      camera.center = Vector.create(1000, 10);
      run();

      expect(popovers()).toHaveLength(0);
      expect(clickTarget.value).toBeNull();
    });

    it("dismisses when the target no longer exists", () => {
      click(["entity.player", unsafeEntityId(999)]);

      expect(popovers()).toHaveLength(0);
      expect(clickTarget.value).toBeNull();
    });

    it("dismisses on a pointer press outside the popover", () => {
      clickPlayer();

      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));

      expect(popovers()).toHaveLength(0);
      expect(clickTarget.value).toBeNull();
    });

    it("stays open on a pointer press inside the popover", () => {
      clickPlayer();

      popover().dispatchEvent(new Event("pointerdown", { bubbles: true }));

      expect(popovers()).toHaveLength(1);
      expect(clickTarget.value).toEqual(["entity.player", playerId]);
    });

    it("dismisses on Escape", () => {
      clickPlayer();

      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Escape", bubbles: true })
      );

      expect(popovers()).toHaveLength(0);
      expect(clickTarget.value).toBeNull();
    });

    it("ignores other keys", () => {
      clickPlayer();

      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyA", bubbles: true })
      );

      expect(popovers()).toHaveLength(1);
    });

    it("is replaced by the popover of a newly clicked target", () => {
      clickPlayer();
      const first = popover();

      const other = createPlayer(world, Vector.create(20, 10));
      click(["entity.player", other]);

      expect(popovers()).toHaveLength(1);
      expect(popover()).not.toBe(first);
      expect(first.isConnected).toBe(false);
      expect(showPopover).toHaveBeenCalledTimes(2);
    });

    it("keeps one popover while the same target stays clicked", () => {
      clickPlayer();
      run();
      run();

      expect(popovers()).toHaveLength(1);
      expect(showPopover).toHaveBeenCalledOnce();
    });

    it("is found by region and sub-region id for a structure", () => {
      world.structures.addStructure(30, 40, { type: "tree", data: true });
      const [regionId, subRegionId] = worldPosToRegionIds(30, 40);
      const structurePos =
        world.structures.optGetStructure(regionId, subRegionId)?.worldPos ??
        raise(new Error("Structure was not added"));
      clickHandlers = {
        "structure.tree": clickableSelect<[RegionId, SubRegionId], string>(
          OPTIONS,
          vi.fn()
        ),
      };
      camera.center = Vector.create(...structurePos);

      click(["structure.tree", regionId, subRegionId]);

      expect(popovers()).toHaveLength(1);
      expect(popover().style.left).toBe(`${CANVAS_SIZE[0] / 2}px`);
    });
  });
});
