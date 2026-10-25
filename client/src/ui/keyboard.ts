import { addListener, mapFilter, raise } from "niall-utils";
import { Vector } from "vectyped";

type KeyCallback = (this: Keyboard, evt: KeyboardEvent) => void;

interface KeyboardListeners {
  onDown?: KeyCallback;
  onRepeat?: KeyCallback;
  onUp?: KeyCallback;
}

export interface Modifiers {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

/**
 * Maps `KeyboardEvent.code`s to the direction they push in, as an `N`
 * dimensional vector. These are only ever used as operands, never mutated.
 * `DirectionKeys<number>` is any number of dimensions, which is what lets
 * `Keyboard.direction` infer `N` from the keys it is given.
 */
export type DirectionKeys<N extends number> = Readonly<
  Record<string, Vector<N>>
>;

/** The default keys for `Keyboard.direction`, in canvas space (up is -y) */
export const WASD_AND_ARROWS = {
  KeyA: Vector.LEFT,
  ArrowLeft: Vector.LEFT,
  KeyD: Vector.RIGHT,
  ArrowRight: Vector.RIGHT,
  KeyW: Vector.UP,
  ArrowUp: Vector.UP,
  KeyS: Vector.DOWN,
  ArrowDown: Vector.DOWN,
} satisfies DirectionKeys<2>;

const NO_MODIFIERS: Readonly<Modifiers> = {
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
};

const modifiersOf = (evt: KeyboardEvent): Modifiers => ({
  shift: evt.shiftKey,
  ctrl: evt.ctrlKey,
  alt: evt.altKey,
  meta: evt.metaKey,
});

/**
 * Keys are identified by `KeyboardEvent.code` (e.g. "KeyW", "Space",
 * "ArrowUp"), which is the physical key and so independent of keyboard layout.
 */
export class Keyboard {
  private readonly listeners: KeyboardListeners;
  private readonly _held = new Set<string>();
  private readonly _pressed = new Set<string>();
  private readonly _released = new Set<string>();
  private _modifiers: Readonly<Modifiers> = NO_MODIFIERS;

  /**
   * Tracks keyboard events that reach a given DOM element. Key events bubble,
   * so the default of the body sees every key press that isn't swallowed.
   * @param {HTMLElement} element Element to track
   */
  constructor(
    element: HTMLElement = document.body,
    listeners?: KeyboardListeners
  ) {
    this.listeners = listeners ?? {};

    addListener(element, "keydown", evt => {
      this._modifiers = modifiersOf(evt);

      if (this._held.has(evt.code)) {
        this.listeners.onRepeat?.call(this, evt);
      } else {
        this._held.add(evt.code);
        this._pressed.add(evt.code);
        this.listeners.onDown?.call(this, evt);
      }
    });

    addListener(element, "keyup", evt => {
      this._modifiers = modifiersOf(evt);

      if (this._held.delete(evt.code)) {
        this._released.add(evt.code);
        this.listeners.onUp?.call(this, evt);
      }
    });

    // The browser never sends the key up events for keys let go of while
    // another window had focus, so treat losing focus as releasing everything.
    window.addEventListener("blur", () => {
      for (const code of this._held) this._released.add(code);
      this._held.clear();
      this._modifiers = NO_MODIFIERS;
    });
  }

  /**
   * Triggered when a key goes down. Not triggered again while the key is held,
   * see setOnRepeat for that
   *
   * @param {KeyCallback} onDown
   */
  setOnDown(onDown: KeyCallback) {
    this.listeners.onDown = onDown;
  }

  /**
   * Triggered by the operating system's key repeat while a key is held down
   *
   * @param {KeyCallback} onRepeat
   */
  setOnRepeat(onRepeat: KeyCallback) {
    this.listeners.onRepeat = onRepeat;
  }

  /**
   * Triggered when a held key is let go of
   *
   * @param {KeyCallback} onUp
   */
  setOnUp(onUp: KeyCallback) {
    this.listeners.onUp = onUp;
  }

  /**
   * Clears the pressed and released sets. Call this once at the end of every
   * frame (init.ts does) so they only ever describe the frame just drawn.
   */
  endFrame() {
    this._pressed.clear();
    this._released.clear();
  }

  isDown(code: string): boolean {
    return this._held.has(code);
  }

  /** Whether at least one of the given keys is held */
  anyDown(...codes: string[]): boolean {
    return codes.some(code => this._held.has(code));
  }

  /** Whether every one of the given keys is held */
  allDown(...codes: string[]): boolean {
    return codes.every(code => this._held.has(code));
  }

  /** Whether the key went down since the last frame ended */
  wasPressed(code: string): boolean {
    return this._pressed.has(code);
  }

  /** Whether the key was let go of since the last frame ended */
  wasReleased(code: string): boolean {
    return this._released.has(code);
  }

  /**
   * Which way the held keys are pushing along one axis
   *
   * @returns {number} -1 for only the negative keys, 1 for only the positive
   * keys, or 0 when neither or both are held
   */
  axis(negative: string[], positive: string[]): number {
    return (
      Number(this.anyDown(...positive)) - Number(this.anyDown(...negative))
    );
  }

  /**
   * Which way the held keys are pushing, using WASD and the arrow keys in
   * canvas space (up is negative y)
   *
   * @returns {Vector<2>} A new vector, at most one long so diagonals aren't
   * faster than straight lines
   */
  direction(): Vector<2>;
  /**
   * @param {DirKeys} keys Which keys push which way. The number of dimensions
   * of the result is taken from these, so there must be at least one key
   * @returns A new vector, at most one long
   */
  // oxlint-disable-next-line typescript/no-explicit-any
  direction<const DirKeys extends DirectionKeys<any>>(
    keys: DirKeys
  ): DirKeys[keyof DirKeys];
  direction(
    // oxlint-disable-next-line typescript/no-explicit-any
    keys: DirectionKeys<any> = WASD_AND_ARROWS
  ): Vector<number> | Vector<2> {
    const [
      first = raise(new Error("Keyboard.direction needs at least one key")),
    ] = Object.values(keys);

    const sum = mapFilter([...this._held], code => keys[code])
      .reduce((total, dir) => total.add(dir), Vector.zero(first.size()))
      .clamp(-1, 1);

    return sum.getMagnitude() > 1 ? sum.normalise() : sum;
  }

  get held(): ReadonlySet<string> {
    return this._held;
  }

  get pressed(): ReadonlySet<string> {
    return this._pressed;
  }

  get released(): ReadonlySet<string> {
    return this._released;
  }

  get modifiers(): Readonly<Modifiers> {
    return this._modifiers;
  }
}
