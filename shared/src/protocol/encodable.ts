import {
  isAnyArray,
  isAnyRecord,
  isArrayOf,
  isOneOf,
  isOptional,
  type Guard,
} from "deep-guards";
import { typedToEntries } from "niall-utils";
import { attempt, raise, type ReadonlyNonEmptyArray } from "niall-utils/core";

import { u8, u32, type Codec } from "./codec.ts";

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

/** Occupies no bytes; used for fields whose value is implied (e.g. a message `type`). */
export const constant = <const T extends string | number | boolean | null>(
  value: T
) =>
  encodable<T>((candidate): candidate is T => candidate === value, {
    size: () => 0,
    write: () => undefined,
    read: () => value,
  });

/** An enum-style union of primitives, encoded as a u8 index into `values` (so at most 256). */
export const oneOf = <
  const T extends ReadonlyNonEmptyArray<string | number | boolean | null>,
>(
  ...values: T
) =>
  encodable<T[number]>(isOneOf(...values), {
    size: () => u8.size(0),
    write: (cursor, value) => {
      u8.write(cursor, values.indexOf(value));
    },
    read: cursor => {
      const value = values[u8.read(cursor)];
      return value === undefined
        ? raise(new RangeError("Unknown enum index"))
        : value;
    },
  });

export const tupled = <const T extends readonly unknown[]>(
  ...encodables: { [K in keyof T]: Encodable<T[K]> }
) =>
  encodable<T>(
    (value): value is T =>
      isAnyArray(value) &&
      value.length === encodables.length &&
      encodables.every(({ guard }, i) => guard(value[i])),
    {
      size: values =>
        encodables.reduce(
          (acc, { codec }, i) => acc + codec.size(values[i]),
          0
        ),
      write: (cursor, values) => {
        encodables.forEach(({ codec }, i) => {
          codec.write(cursor, values[i]);
        });
      },
      read: cursor =>
        encodables.map(({ codec }) => codec.read(cursor)) as unknown as T,
    }
  );

export const optional = <const T>({ guard, codec }: Encodable<T>) =>
  encodable<T | undefined>(isOptional(guard), {
    size: value => 1 + (value === undefined ? 0 : codec.size(value)),
    write: (cursor, value) => {
      u8.write(cursor, value === undefined ? 0 : 1);
      if (value !== undefined) codec.write(cursor, value);
    },
    read: cursor => (u8.read(cursor) === 0 ? undefined : codec.read(cursor)),
  });

export const arrayOf = <const T>({ guard, codec }: Encodable<T>) =>
  encodable<T[]>(isArrayOf(guard), {
    size: values => values.reduce((sum, v) => sum + codec.size(v), u32.size(0)),
    write: (cursor, values) => {
      u32.write(cursor, values.length);
      for (const value of values) codec.write(cursor, value);
    },
    read: cursor => {
      const length = u32.read(cursor);
      // Every item takes at least a byte, so this rejects absurd lengths before looping.
      if (length > cursor.view.byteLength - cursor.pos) {
        throw new RangeError("Array length exceeds remaining bytes");
      }
      return Array.from({ length }, () => codec.read(cursor));
    },
  });

/** Fields are written in the shape's key order, which both sides share. */
export const object = <
  const T extends object,
  const Args extends readonly unknown[] = [T],
>(
  shape: { [K in keyof T]: Encodable<T[K]> },
  create?: (...args: Args) => T
) => {
  const fields = typedToEntries(shape);

  return encodable<T, Args>(
    (value): value is T =>
      isAnyRecord(value) &&
      Object.keys(value).every(key => Object.hasOwn(shape, key)) &&
      fields.every(([key, { guard }]) => guard(value[key])),
    {
      size: value =>
        fields.reduce(
          (sum, [key, { codec }]) => sum + codec.size(value[key]),
          0
        ),
      write: (cursor, value) => {
        for (const [key, { codec }] of fields) codec.write(cursor, value[key]);
      },
      read: cursor => {
        const result: Partial<T> = {};
        for (const [key, { codec }] of fields) {
          const value = codec.read(cursor);
          if (value !== undefined) result[key] = value;
        }
        return result as T;
      },
    },
    create
  );
};

export const union = <const T extends ReadonlyNonEmptyArray<unknown>>(
  ...encodables: { [K in keyof T]: Encodable<T[K]> }
): Encodable<T[number]> => {
  const indexOf = (value: T[number]) => {
    const index = encodables.findIndex(({ guard }) => guard(value));
    return index === -1
      ? raise(new TypeError("Value matches no union variant"))
      : index;
  };

  /** Prefixes each value with the index of the first variant whose guard accepts it. */
  return encodable(
    (value): value is T[number] => encodables.some(({ guard }) => guard(value)),
    {
      size: value => 1 + (encodables[indexOf(value)]?.codec.size(value) ?? 0),
      write: (cursor, value) => {
        const index = indexOf(value);
        u8.write(cursor, index);
        encodables[index]?.codec.write(cursor, value);
      },
      read: cursor => {
        const variant = encodables[u8.read(cursor)];
        return variant === undefined
          ? raise(new RangeError("Unknown union tag"))
          : variant.codec.read(cursor);
      },
    }
  );
};
