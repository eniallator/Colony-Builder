import {
  isArrayOf,
  isExact,
  isExactObjectOf,
  isOneOf,
  isOptional,
  isTupleOf,
  isUnionOf,
  type Guard,
} from "deep-guards";
import { mapFind } from "niall-utils";
import {
  attempt,
  raise,
  type NonEmptyArray,
  type ReadonlyNonEmptyArray,
} from "niall-utils/core";
import { mapObject } from "niall-utils/data";

import {
  chooseUIntCod,
  codArrayOf,
  codExact,
  codObjectOf,
  codOneOf,
  codOptional,
  codTupleOf,
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
  decode: enc => {
    const cursor = {
      view: new DataView(enc.buffer, enc.byteOffset, enc.byteLength),
      pos: 0,
    };
    const decoded = attempt((): unknown => codec.read(cursor));
    return cursor.pos === enc.byteLength && guard(decoded)
      ? decoded
      : undefined;
  },
});

export const encExact = <
  const T extends string | number | boolean | null,
  Args extends readonly unknown[] = [T],
>(
  value: T,
  create?: (...args: Args) => T
): Encodable<T, Args> => encodable(isExact(value), codExact(value), create);

export const encOneOf = <
  const T extends ReadonlyNonEmptyArray<string | number | boolean | null>,
>(
  ...values: T
): Encodable<T[number], [T[number]]> =>
  encodable(isOneOf(...values), codOneOf(...values));

export const encOptional = <
  const T,
  Args extends readonly unknown[] = [T | undefined],
>(
  inner: Encodable<T>,
  create?: (...args: Args) => T | undefined
): Encodable<T | undefined, Args> =>
  encodable(isOptional(inner.guard), codOptional(inner.codec), create);

export const encArrayOf = <const T, Args extends readonly unknown[] = [T[]]>(
  inner: Encodable<T>,
  create?: (...args: Args) => T[]
): Encodable<T[], Args> =>
  encodable(isArrayOf(inner.guard), codArrayOf(inner.codec), create);

export const encTupleOf = <const T extends ReadonlyNonEmptyArray<unknown>>(
  ...inners: { [K in keyof T]: Encodable<T[K]> }
): Encodable<T, [T]> =>
  encodable(
    isTupleOf(
      ...(inners.map(enc => enc.guard) as NonEmptyArray<Guard<unknown>>)
    ) as unknown as Guard<T>,
    codTupleOf<T>(
      ...(inners.map(({ codec }) => codec) as { [K in keyof T]: Codec<T[K]> })
    )
  );

export const encObjectOf = <
  const T extends object,
  Args extends readonly unknown[] = [T],
>(
  shape: { [K in keyof T]-?: Encodable<T[K]> },
  create?: (...args: Args) => T
): Encodable<T, Args> =>
  encodable(
    isExactObjectOf(
      mapObject<typeof shape, Record<string, Guard<unknown>>>(
        shape,
        ([key, { guard }]) => [String(key), guard]
      )
    ) as Guard<T>,
    codObjectOf<T>(
      mapObject<typeof shape, { [K in keyof T]: Codec<T[K]> }>(
        shape,
        ([key, { codec }]) => [key, codec]
      )
    ),
    create
  );

export const encUnionOf = <const T extends ReadonlyNonEmptyArray<unknown>>(
  ...encs: { [K in keyof T]: Encodable<T[K]> }
): Encodable<T[number], [T[number]]> => {
  const cod = chooseUIntCod(encs.length - 1);
  const matchEncodable = (value: T[number]) =>
    mapFind(encs, (encodable, index) =>
      encodable.guard(value) ? { index, encodable } : null
    ) ?? raise(new TypeError("Value matches no union variant"));

  return encodable(
    isUnionOf(
      ...(encs.map(enc => enc.guard) as NonEmptyArray<Guard<unknown>>)
    ) as Guard<T[number]>,
    {
      size: value =>
        cod.size(encs.length) +
        matchEncodable(value).encodable.codec.size(value),
      write: (cursor, value) => {
        const { index, encodable } = matchEncodable(value);
        cod.write(cursor, index);
        encodable.codec.write(cursor, value);
      },
      read: cursor =>
        encs[cod.read(cursor)]?.codec.read(cursor) ??
        raise(new RangeError("Unknown union tag")),
    }
  );
};
