import {
  isArrayOf,
  isBoolean,
  isExact,
  isExactObjectOf,
  isOneOf,
  isOptional,
  isRecordOf,
  isTupleOf,
  isUnionOf,
  type Guard,
} from "deep-guards";
import {
  attempt,
  raise,
  type NonEmptyArray,
  type ReadonlyNonEmptyArray,
} from "niall-utils/core";
import { mapObject } from "niall-utils/data";
import { mapFind } from "niall-utils/functional";
import { Vector } from "vectyped";

import {
  chooseUIntCod,
  codArrayOf,
  codBoolean,
  codExact,
  codF32,
  codMap,
  codMapOf,
  codObjectOf,
  codOneOf,
  codOptional,
  codRecordOf,
  codSetOf,
  codTupleOf,
  type ArrayOptions,
  type Codec,
  type CodecValue,
  type Precision,
} from "./codec.ts";

export interface Encodable<
  // oxlint-disable-next-line typescript/no-explicit-any
  T extends CodecValue = any,
> {
  guard: Guard<T>;
  codec: Codec<T>;
  encode: (value: T) => Uint8Array<ArrayBuffer>;
  decode: (encoded: Uint8Array) => T | undefined;
}

export type EncodableType<E extends Encodable> =
  E extends Encodable<infer T> ? T : never;

type DeepWritable<T> =
  T extends Vector<infer _N extends number>
    ? T
    : T extends (...args: never[]) => unknown
      ? T
      : T extends Map<infer K, infer V>
        ? Map<DeepWritable<K>, DeepWritable<V>>
        : T extends Set<infer U>
          ? Set<DeepWritable<U>>
          : T extends object
            ? { -readonly [K in keyof T]: DeepWritable<T[K]> }
            : T;

export type EncodableWritableType<E extends Encodable> = DeepWritable<
  EncodableType<E>
>;

export const encodable = <const T extends CodecValue>(
  guard: Guard<T>,
  codec: Codec<T>
): Encodable<T> => ({
  guard,
  codec,
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

export const encBoolean = encodable(isBoolean, codBoolean);

const isVec =
  <const N extends number>(size: N): Guard<Vector<N>> =>
  (value): value is Vector<N> =>
    value instanceof Vector &&
    value.isSize(size) &&
    value.every(Number.isFinite);

export const encVec2 = encodable<Vector<2>>(
  isVec(2),
  codMap(
    codTupleOf(codF32, codF32),
    vec => vec.toArray(),
    ([x, y]) => Vector.create(x, y)
  )
);

export const encExact = <const T extends string | number | boolean>(
  value: T
): Encodable<T> => encodable(isExact(value), codExact(value));

export const encOptional = <const T extends CodecValue>(
  inner: Encodable<T>
): Encodable<T | undefined> =>
  encodable(isOptional(inner.guard), codOptional(inner.codec));

export const encOneOf = <
  const T extends ReadonlyNonEmptyArray<string | number | boolean>,
>(
  values: T,
  precision?: Precision
): Encodable<T[number]> =>
  encodable(isOneOf(...values), codOneOf(values, precision));

export const encTupleOf = <const T extends ReadonlyNonEmptyArray<CodecValue>>(
  ...inners: { [K in keyof T]: Encodable<T[K]> }
): Encodable<T> =>
  encodable(
    isTupleOf(
      ...(inners.map(enc => enc.guard) as NonEmptyArray<Guard<unknown>>)
    ) as unknown as Guard<T>,
    codTupleOf<T>(
      ...(inners.map(({ codec }) => codec) as { [K in keyof T]: Codec<T[K]> })
    )
  );

export const encSetOf = <const T extends CodecValue>(
  inner: Encodable<T>,
  lengthPrecision?: Precision
): Encodable<Set<T>> =>
  encodable(
    (value): value is Set<T> =>
      value instanceof Set && value.values().every(item => inner.guard(item)),
    codSetOf(inner.codec, lengthPrecision)
  );

export const encArrayOf = <const T extends CodecValue>(
  inner: Encodable<T>,
  opts?: ArrayOptions
): Encodable<T[]> => {
  const isItems = isArrayOf(inner.guard);

  return encodable(
    (value): value is T[] =>
      isItems(value) &&
      (opts?.fixedLength == null || value.length === opts.fixedLength),
    codArrayOf(inner.codec, opts)
  );
};

export const encRecordOf = <
  const K extends string | number,
  const V extends CodecValue,
>(
  encKey: Encodable<K>,
  encVal: Encodable<V>
): Encodable<Record<K, V>> =>
  encodable(
    isRecordOf(encKey.guard, encVal.guard),
    codRecordOf(encKey.codec, encVal.codec)
  );

export const encObjectOf = <
  const T extends { [K in keyof T]: CodecValue },
>(shape: { [K in keyof T]-?: Encodable<T[K]> }): Encodable<T> =>
  encodable(
    isExactObjectOf(
      mapObject<typeof shape, Record<string, Guard<unknown>>>(
        shape,
        ([key, { guard }]) => [String(key), guard]
      )
    ) as Guard<T>,
    codObjectOf(
      mapObject<typeof shape, { [K in keyof T]: Codec<T[K]> }>(
        shape,
        ([key, { codec }]) => [key, codec]
      )
    )
  );

export const encMapOf = <
  const K extends CodecValue,
  const V extends CodecValue,
>(
  encKey: Encodable<K>,
  encVal: Encodable<V>
): Encodable<Map<K, V>> =>
  encodable(
    (value): value is Map<K, V> =>
      value instanceof Map &&
      value
        .entries()
        .every(([key, val]) => encKey.guard(key) && encVal.guard(val)),
    codMapOf(encKey.codec, encVal.codec)
  );

export const encUnionOf = <const T extends ReadonlyNonEmptyArray<CodecValue>>(
  ...encs: { [K in keyof T]: Encodable<T[K]> }
): Encodable<T[number]> => {
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
