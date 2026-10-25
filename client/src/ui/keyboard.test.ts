import { Vector } from "vectyped";
import { describe, expect, it, vi } from "vitest";

import { Keyboard } from "./keyboard.ts";

const press = (element: HTMLElement, code: string, init?: KeyboardEventInit) =>
  element.dispatchEvent(new KeyboardEvent("keydown", { code, ...init }));

const release = (
  element: HTMLElement,
  code: string,
  init?: KeyboardEventInit
) => element.dispatchEvent(new KeyboardEvent("keyup", { code, ...init }));

const setup = (listeners?: ConstructorParameters<typeof Keyboard>[1]) => {
  const element = document.createElement("div");
  return { element, keyboard: new Keyboard(element, listeners) };
};

describe("Keyboard", () => {
  it("tracks held keys and calls onDown / onUp", () => {
    const onDown = vi.fn();
    const onUp = vi.fn();
    const { element, keyboard } = setup({ onDown, onUp });

    press(element, "KeyW");
    expect(onDown).toHaveBeenCalledOnce();
    expect(keyboard.isDown("KeyW")).toBe(true);
    expect(keyboard.held.has("KeyW")).toBe(true);

    release(element, "KeyW");
    expect(onUp).toHaveBeenCalledOnce();
    expect(keyboard.isDown("KeyW")).toBe(false);
  });

  it("sends repeats to onRepeat instead of onDown", () => {
    const onDown = vi.fn();
    const onRepeat = vi.fn();
    const { element, keyboard } = setup({ onDown });
    keyboard.setOnRepeat(onRepeat);

    press(element, "Space");
    press(element, "Space", { repeat: true });
    press(element, "Space", { repeat: true });

    expect(onDown).toHaveBeenCalledOnce();
    expect(onRepeat).toHaveBeenCalledTimes(2);
  });

  it("calls listeners set after construction", () => {
    const onDown = vi.fn();
    const onUp = vi.fn();
    const { element, keyboard } = setup();
    keyboard.setOnDown(onDown);
    keyboard.setOnUp(onUp);

    press(element, "KeyA");
    release(element, "KeyA");

    expect(onDown).toHaveBeenCalledOnce();
    expect(onUp).toHaveBeenCalledOnce();
  });

  it("ignores key ups for keys that were never held", () => {
    const onUp = vi.fn();
    const { element, keyboard } = setup({ onUp });

    release(element, "KeyQ");

    expect(onUp).not.toHaveBeenCalled();
    expect(keyboard.wasReleased("KeyQ")).toBe(false);
  });

  it("reports presses and releases until the frame ends", () => {
    const { element, keyboard } = setup();

    press(element, "KeyE");
    expect(keyboard.wasPressed("KeyE")).toBe(true);
    expect(keyboard.pressed.has("KeyE")).toBe(true);

    keyboard.endFrame();
    expect(keyboard.wasPressed("KeyE")).toBe(false);
    expect(keyboard.isDown("KeyE")).toBe(true);

    release(element, "KeyE");
    expect(keyboard.wasReleased("KeyE")).toBe(true);
    expect(keyboard.released.has("KeyE")).toBe(true);

    keyboard.endFrame();
    expect(keyboard.wasReleased("KeyE")).toBe(false);
  });

  it("answers anyDown and allDown", () => {
    const { element, keyboard } = setup();

    press(element, "KeyA");

    expect(keyboard.anyDown("KeyA", "KeyB")).toBe(true);
    expect(keyboard.anyDown("KeyB", "KeyC")).toBe(false);
    expect(keyboard.allDown("KeyA", "KeyB")).toBe(false);

    press(element, "KeyB");
    expect(keyboard.allDown("KeyA", "KeyB")).toBe(true);
  });

  it("computes an axis that cancels when both sides are held", () => {
    const { element, keyboard } = setup();
    const axis = () => keyboard.axis(["KeyA"], ["KeyD"]);

    expect(axis()).toBe(0);
    press(element, "KeyD");
    expect(axis()).toBe(1);
    press(element, "KeyA");
    expect(axis()).toBe(0);
    release(element, "KeyD");
    expect(axis()).toBe(-1);
  });

  it("computes a direction from WASD and the arrow keys", () => {
    const { element, keyboard } = setup();

    expect(keyboard.direction().toArray()).toEqual([0, 0]);

    press(element, "KeyD");
    expect(keyboard.direction().toArray()).toEqual([1, 0]);

    press(element, "ArrowRight");
    expect(keyboard.direction().toArray()).toEqual([1, 0]);

    press(element, "KeyW");
    const diagonal = keyboard.direction();
    expect(diagonal.getMagnitude()).toBeCloseTo(1);
    expect(diagonal.x()).toBeGreaterThan(0);
    expect(diagonal.y()).toBeLessThan(0);

    release(element, "ArrowRight");
    press(element, "KeyA");
    expect(keyboard.direction().toArray()).toEqual([0, -1]);
  });

  it("computes a direction from custom keys in any dimension", () => {
    const { element, keyboard } = setup();
    const keys = {
      KeyJ: Vector.create(0, 0, 1),
      KeyK: Vector.create(0, 0, -1),
      KeyL: Vector.create(1, 0, 0),
    };

    expect(keyboard.direction(keys).toArray()).toEqual([0, 0, 0]);

    press(element, "KeyJ");
    press(element, "KeyD");
    expect(keyboard.direction(keys).toArray()).toEqual([0, 0, 1]);

    press(element, "KeyL");
    expect(keyboard.direction(keys).getMagnitude()).toBeCloseTo(1);
  });

  it("tracks the modifier keys from the latest event", () => {
    const { element, keyboard } = setup();

    press(element, "ShiftLeft", { shiftKey: true });
    expect(keyboard.modifiers).toEqual({
      shift: true,
      ctrl: false,
      alt: false,
      meta: false,
    });

    release(element, "ShiftLeft");
    expect(keyboard.modifiers.shift).toBe(false);
  });

  it("releases everything when the window loses focus", () => {
    const { element, keyboard } = setup();

    press(element, "KeyW", { ctrlKey: true });
    window.dispatchEvent(new Event("blur"));

    expect(keyboard.isDown("KeyW")).toBe(false);
    expect(keyboard.wasReleased("KeyW")).toBe(true);
    expect(keyboard.modifiers.ctrl).toBe(false);
  });
});
