import { tuple } from "niall-utils/core";
import { Vector } from "vectyped";

const mouseButtons = tuple("left", "middle", "right");
export type MouseButton = (typeof mouseButtons)[number];

type MouseCallback = (this: Mouse, evt: MouseEvent | TouchEvent) => void;
type MouseDownCallback = (
  this: Mouse,
  evt: MouseEvent | TouchEvent,
  button: MouseButton | undefined
) => void;

interface MouseListeners {
  onDown?: MouseDownCallback;
  onMove?: MouseCallback;
  onUp?: MouseCallback;
}

const isMouseEvent = (evt: MouseEvent | TouchEvent): evt is MouseEvent =>
  evt.type.startsWith("mouse");

export class Mouse {
  private readonly listeners: MouseListeners;
  private readonly _pos: Vector<2> = Vector.zero(2);
  private readonly _relativePos: Vector<2> = Vector.zero(2);
  private readonly _clicked: Record<MouseButton, boolean> = {
    left: false,
    middle: false,
    right: false,
  };
  private _down: boolean = false;

  /**
   * Tracks mouse events for a given DOM element
   * @param {HTMLElement} element Element to track
   */
  constructor(element: HTMLElement, listeners?: MouseListeners) {
    this.listeners = listeners ?? {};

    const onChange = (cb: MouseCallback) => (evt: MouseEvent | TouchEvent) => {
      const evtPos = isMouseEvent(evt) ? evt : evt.touches[0];
      if (evtPos != null) this._pos.setHead(evtPos.clientX, evtPos.clientY);

      const { width, height } = element.getBoundingClientRect();
      this._relativePos.setHead(this._pos.x() / width, this._pos.y() / height);

      cb.call(this, evt);
    };

    element.onmousemove = element.ontouchmove = onChange(evt => {
      this.listeners.onMove?.call(this, evt);
    });
    element.onmousedown = element.ontouchstart = onChange(evt => {
      const button: MouseButton | undefined = isMouseEvent(evt)
        ? mouseButtons[evt.button]
        : "left";
      if (button != null) this._clicked[button] = true;

      this._down = true;
      this.listeners.onDown?.call(this, evt, button);
    });
    element.onmouseup = element.ontouchend = onChange(evt => {
      this._down = false;
      this.listeners.onUp?.call(this, evt);
    });
  }

  endFrame() {
    for (const button of mouseButtons) this._clicked[button] = false;
  }

  /**
   * Triggered when the mouse down or touch down event is fired on the element
   *
   * @param {MouseCallback} onDown
   */
  setOnDown(onDown: MouseDownCallback) {
    this.listeners.onDown = onDown;
  }

  /**
   * Triggered when the mouse move or touch move event is fired on the element
   *
   * @param {MouseCallback} onMove
   */
  setOnMove(onMove: MouseCallback) {
    this.listeners.onMove = onMove;
  }

  /**
   * Triggered when the mouse down or touch down event is fired on the element
   *
   * @param {MouseCallback} onUp
   */
  setOnUp(onUp: MouseCallback) {
    this.listeners.onUp = onUp;
  }

  get down(): boolean {
    return this._down;
  }

  get pos(): Vector<2> {
    return this._pos;
  }

  get relativePos(): Vector<2> {
    return this._relativePos;
  }

  clicked(button: MouseButton): boolean {
    return this._clicked[button];
  }
}
