import { describe, expect, it, vi } from "vitest";

import { Mouse } from "./mouse.ts";

const createElementWithRect = (): HTMLDivElement => {
  const div = document.createElement("div");
  div.getBoundingClientRect = vi.fn(() => new DOMRect(0, 0, 100, 200));
  return div;
};

const createTouchEvent = (
  type: string,
  clientX: number,
  clientY: number
): TouchEvent =>
  ({ type, touches: [{ clientX, clientY }] }) as unknown as TouchEvent;

describe("Mouse", () => {
  it("should update position and relative position on mouse move", () => {
    const element = createElementWithRect();
    const onMove = vi.fn();
    const mouse = new Mouse(element, { onMove });

    element.onmousemove?.(
      new MouseEvent("mousemove", { clientX: 25, clientY: 50 })
    );

    expect(onMove).toHaveBeenCalledOnce();
    expect(mouse.down).toBe(false);
    expect(mouse.pos.x()).toBe(25);
    expect(mouse.pos.y()).toBe(50);
    expect(mouse.relativePos.x()).toBe(0.25);
    expect(mouse.relativePos.y()).toBe(0.25);
  });

  it("calls onDown and marks down true on mouse down", () => {
    const element = createElementWithRect();
    const onDown = vi.fn();
    const mouse = new Mouse(element);

    mouse.setOnDown(onDown);
    element.onmousedown?.(
      new MouseEvent("mousedown", { clientX: 75, clientY: 100 })
    );

    expect(onDown).toHaveBeenCalledOnce();
    expect(mouse.down).toBe(true);
  });

  it("calls onMove when listener is set on mouse move", () => {
    const element = createElementWithRect();
    const onMove = vi.fn();
    const mouse = new Mouse(element);

    mouse.setOnMove(onMove);
    element.onmousemove?.(
      new MouseEvent("mousemove", { clientX: 10, clientY: 20 })
    );

    expect(onMove).toHaveBeenCalledOnce();
    expect(mouse.pos.x()).toBe(10);
    expect(mouse.pos.y()).toBe(20);
  });

  it("calls onUp and marks down false on mouse up", () => {
    const element = createElementWithRect();
    const onUp = vi.fn();
    const mouse = new Mouse(element);

    mouse.setOnUp(onUp);
    element.onmousedown?.(
      new MouseEvent("mousedown", { clientX: 0, clientY: 0 })
    );
    element.onmouseup?.(new MouseEvent("mouseup", { clientX: 5, clientY: 10 }));

    expect(onUp).toHaveBeenCalledOnce();
    expect(mouse.down).toBe(false);
  });

  it("calls onDown and updates state on touchstart", () => {
    const element = createElementWithRect();
    const onDown = vi.fn();
    const mouse = new Mouse(element, { onDown });

    const touchStart = createTouchEvent("touchstart", 10, 20);
    element.ontouchstart?.(touchStart);

    expect(onDown).toHaveBeenCalledOnce();
    expect(mouse.down).toBe(true);
  });

  it("calls onMove and updates position on touchmove", () => {
    const element = createElementWithRect();
    const onMove = vi.fn();
    const mouse = new Mouse(element, { onMove });

    const touchMove = createTouchEvent("touchmove", 30, 40);
    element.ontouchmove?.(touchMove);

    expect(onMove).toHaveBeenCalledOnce();
    expect(mouse.pos.x()).toBe(30);
    expect(mouse.pos.y()).toBe(40);
  });

  it("calls onUp and marks down false on touchend", () => {
    const element = createElementWithRect();
    const onUp = vi.fn();
    const mouse = new Mouse(element, { onUp });

    const touchStart = createTouchEvent("touchstart", 10, 20);
    element.ontouchstart?.(touchStart);
    const touchEnd = createTouchEvent("touchend", 10, 20);

    element.ontouchend?.(touchEnd);

    expect(onUp).toHaveBeenCalledOnce();
    expect(mouse.down).toBe(false);
  });

  describe("clicked", () => {
    it("is false for every button before any press", () => {
      const mouse = new Mouse(createElementWithRect());

      expect(mouse.clicked("left")).toBe(false);
      expect(mouse.clicked("middle")).toBe(false);
      expect(mouse.clicked("right")).toBe(false);
    });

    it.each([
      [0, "left"],
      [1, "middle"],
      [2, "right"],
    ] as const)(
      "marks only the pressed button (%i is %s)",
      (button, expected) => {
        const element = createElementWithRect();
        const mouse = new Mouse(element);

        element.onmousedown?.(new MouseEvent("mousedown", { button }));

        expect(mouse.clicked(expected)).toBe(true);
        for (const other of ["left", "middle", "right"] as const) {
          if (other !== expected) expect(mouse.clicked(other)).toBe(false);
        }
      }
    );

    it("counts a touch start as a left click", () => {
      const element = createElementWithRect();
      const mouse = new Mouse(element);

      element.ontouchstart?.(createTouchEvent("touchstart", 10, 20));

      expect(mouse.clicked("left")).toBe(true);
    });

    it("ignores a button it does not know, but still reports it to onDown", () => {
      const element = createElementWithRect();
      const onDown = vi.fn();
      const mouse = new Mouse(element, { onDown });

      element.onmousedown?.(new MouseEvent("mousedown", { button: 3 }));

      expect(onDown).toHaveBeenCalledOnce();
      expect(onDown.mock.calls[0]?.[1]).toBeUndefined();
      expect(mouse.clicked("left")).toBe(false);
      expect(mouse.clicked("middle")).toBe(false);
      expect(mouse.clicked("right")).toBe(false);
    });

    it("stays set until the end of the frame, even after the button is released", () => {
      const element = createElementWithRect();
      const mouse = new Mouse(element);

      element.onmousedown?.(new MouseEvent("mousedown", { button: 0 }));
      element.onmouseup?.(new MouseEvent("mouseup", { button: 0 }));

      expect(mouse.clicked("left")).toBe(true);
    });

    it("is cleared for every button by endFrame", () => {
      const element = createElementWithRect();
      const mouse = new Mouse(element);
      for (const button of [0, 1, 2]) {
        element.onmousedown?.(new MouseEvent("mousedown", { button }));
      }

      mouse.endFrame();

      expect(mouse.clicked("left")).toBe(false);
      expect(mouse.clicked("middle")).toBe(false);
      expect(mouse.clicked("right")).toBe(false);
    });
  });

  it("keeps the last position when a touch event has no touches", () => {
    const element = createElementWithRect();
    const mouse = new Mouse(element);

    element.ontouchmove?.(createTouchEvent("touchmove", 30, 40));
    element.ontouchend?.(new TouchEvent("touchend"));

    expect(mouse.pos.toArray()).toEqual([30, 40]);
    expect(mouse.relativePos.toArray()).toEqual([0.3, 0.2]);
  });
});
