import {
  isArrayOf,
  isExact,
  isExactObjectOf,
  isOneOf,
  isOptional,
  type Guard,
} from "deep-guards";
import { mapFind } from "niall-utils";
import { attempt, raise, type ReadonlyNonEmptyArray } from "niall-utils/core";
import { mapObject } from "niall-utils/data";

import {
  codArrayOf,
  codExact,
  codObjectOf,
  codOneOf,
  codOptional,
  codTupleOf,
  codU8,
  type Codec,
} from "./codec.ts";

// oxlint-disable-next-line typescript/no-explicit-any
export interface Encodable<T = any, Args extends readonly unknown[] = any> {
  guard: Guard<T>;
  codec: Codec<T>;
  create: (...args: Args) => T;
  encode: (value: T) => Uint8Array<ArrayBuffer>;
  decode: (encoded: Uint8Array) => T | undefined;
}

export type EncodableType<E extends Encodable> =
  E extends Encodable<infer T> ? T : never;

export const encodable = <const T, Args extends readonly unknown[] = [T]>(
  guard: Guard<T>,
  codec: Codec<T>,
  create?: (...args: Args) => T
): Encodable<T, Args> => ({
  guard,
  codec,
  create: create ?? (((value: T) => value) as unknown as (...args: Args) => T),
  encode: value => {
    const buffer = new ArrayBuffer(codec.size(value));
    codec.write({ view: new DataView(buffer), pos: 0 }, value);
    return new Uint8Array(buffer);
  },
  decode: encoded => {
    const cursor = {
      view: new DataView(
        encoded.buffer,
        encoded.byteOffset,
        encoded.byteLength
      ),
      pos: 0,
    };
    const decoded = attempt((): unknown => codec.read(cursor));
    return cursor.pos === encoded.byteLength && guard(decoded)
      ? decoded
      : undefined;
  },
});

export const encExact = <const T extends string | number | boolean | null>(
  value: T
) => encodable<T>(isExact(value), codExact(value));

export const encOneOf = <
  const T extends ReadonlyNonEmptyArray<string | number | boolean | null>,
>(
  ...values: T
) => encodable<T[number]>(isOneOf(...values), codOneOf(...values));

export const encOptional = <const T>(inner: Encodable<T>) =>
  encodable<T | undefined>(isOptional(inner.guard), codOptional(inner.codec));

export const encArrayOf = <const T>(inner: Encodable<T>) =>
  encodable<T[]>(isArrayOf(inner.guard), codArrayOf(inner.codec));

export const encTupleOf = <const T extends readonly unknown[]>(
  ...inners: { [K in keyof T]: Encodable<T[K]> }
) =>
  encodable<T>(
    (value): value is T =>
      Array.isArray(value) &&
      value.length === inners.length &&
      inners.every((inner, i) => inner.guard(value[i])),
    codTupleOf<T>(
      ...(inners.map(({ codec }) => codec) as {
        [K in keyof T]: Codec<T[K]>;
      })
    )
  );

/** Guard and codec are both derived from the shape, so the two can't drift apart. */
export const encObjectOf = <
  const T extends object,
  Args extends readonly unknown[] = [T],
>(
  shape: { [K in keyof T]-?: Encodable<T[K]> },
  create?: (...args: Args) => T
) => {
  const isShape = isExactObjectOf(
    mapObject<typeof shape, Record<string, Guard<unknown>>>(
      shape,
      ([key, { guard }]) => [String(key), guard]
    )
  );
  return encodable<T, Args>(
    (value): value is T => isShape(value),
    codObjectOf<T>(
      mapObject<typeof shape, { [K in keyof T]: Codec<T[K]> }>(
        shape,
        ([key, { codec }]) => [key, codec]
      )
    ),
    create
  );
};

export const encUnionOf = <const T extends ReadonlyNonEmptyArray<unknown>>(
  ...encodables: { [K in keyof T]: Encodable<T[K]> }
): Encodable<T[number]> => {
  const matchEncodable = (value: T[number]) =>
    mapFind(encodables, (encodable, index) =>
      encodable.guard(value) ? { index, encodable } : null
    ) ?? raise(new TypeError("Value matches no union variant"));

  /** Prefixes each value with the index of the first variant whose guard accepts it. */
  return encodable(
    (value): value is T[number] => encodables.some(({ guard }) => guard(value)),
    {
      size: value => 1 + matchEncodable(value).encodable.codec.size(value),
      write: (cursor, value) => {
        const { index, encodable } = matchEncodable(value);
        codU8.write(cursor, index);
        encodable.codec.write(cursor, value);
      },
      read: cursor => {
        const variant = encodables[codU8.read(cursor)];
        return variant === undefined
          ? raise(new RangeError("Unknown union tag"))
          : variant.codec.read(cursor);
      },
    }
  );
};
