import {
  isArrayOf,
  isBoolean,
  isExact,
  isExactObjectOf,
  isNumber,
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
  type UnionToTuple,
} from "niall-utils/core";
import { mapObject, typedToEntries } from "niall-utils/data";
import { mapFind } from "niall-utils/functional";
import { Vector } from "vectyped";

import type { Encodable } from "../format.ts";
import {
  chooseUIntCod,
  codArrayOf,
  codBoolean,
  codExact,
  codF32,
  codMap,
  codMapOf,
  codNumber,
  codObjectOf,
  codOneOf,
  codOptional,
  codRecordOf,
  codSetOf,
  codTupleOf,
  type ArrayOptions,
  type BinaryCodec,
  type BinaryFormat,
  type CodecValue,
  type NumberCodec,
  type Precision,
} from "./codec.ts";

// oxlint-disable-next-line typescript/no-explicit-any
export type BinaryEncodable<T extends CodecValue = any> = Encodable<
  T,
  BinaryFormat,
  BinaryCodec<T>
>;

export type EncodableType<E extends BinaryEncodable> =
  E extends BinaryEncodable<infer T> ? T : never;

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

export type EncodableWritableType<E extends BinaryEncodable> = DeepWritable<
  EncodableType<E>
>;

export const binaryEncodable = <const T extends CodecValue>(
  guard: Guard<T>,
  codec: BinaryCodec<T>
): BinaryEncodable<T> => ({
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

export const encBoolean = binaryEncodable(isBoolean, codBoolean);

export const encNumber: {
  (tpe: NumberCodec): BinaryEncodable<number>;
  (tpe: "uChoose", value: number): BinaryEncodable<number>;
} = (tpe: NumberCodec | "uChoose", value?: number): BinaryEncodable<number> =>
  binaryEncodable(
    isNumber,
    tpe === "uChoose" ? chooseUIntCod(value as number) : codNumber(tpe)
  );

const isVec =
  <const N extends number>(size: N): Guard<Vector<N>> =>
  (value): value is Vector<N> =>
    value instanceof Vector &&
    value.isSize(size) &&
    value.every(Number.isFinite);

export const encVec2 = binaryEncodable<Vector<2>>(
  isVec(2),
  codMap(
    codTupleOf(codF32, codF32),
    vec => vec.toArray(),
    ([x, y]) => Vector.create(x, y)
  )
);

export const encExact = <const T extends string | number | boolean>(
  value: T
): BinaryEncodable<T> => binaryEncodable(isExact(value), codExact(value));

export const encOptional = <const T extends CodecValue>(
  inner: BinaryEncodable<T>
): BinaryEncodable<T | undefined> =>
  binaryEncodable(isOptional(inner.guard), codOptional(inner.codec));

export const encOneOf = <
  const T extends ReadonlyNonEmptyArray<string | number | boolean>,
>(
  values: T,
  precision?: Precision
): BinaryEncodable<T[number]> =>
  binaryEncodable(isOneOf(...values), codOneOf(values, precision));

export const encTupleOf = <const T extends ReadonlyNonEmptyArray<CodecValue>>(
  ...inners: { [K in keyof T]: BinaryEncodable<T[K]> }
): BinaryEncodable<T> =>
  binaryEncodable(
    isTupleOf(
      ...(inners.map(enc => enc.guard) as NonEmptyArray<Guard<unknown>>)
    ) as unknown as Guard<T>,
    codTupleOf<T>(
      ...(inners.map(({ codec }) => codec) as {
        [K in keyof T]: BinaryCodec<T[K]>;
      })
    )
  );

export const encSetOf = <const T extends CodecValue>(
  inner: BinaryEncodable<T>,
  lengthPrecision?: Precision
): BinaryEncodable<Set<T>> =>
  binaryEncodable(
    (value): value is Set<T> =>
      value instanceof Set && value.values().every(item => inner.guard(item)),
    codSetOf(inner.codec, lengthPrecision)
  );

export const encArrayOf = <const T extends CodecValue>(
  inner: BinaryEncodable<T>,
  opts?: ArrayOptions
): BinaryEncodable<T[]> => {
  const isItems = isArrayOf(inner.guard);

  return binaryEncodable(
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
  encKey: BinaryEncodable<K>,
  encVal: BinaryEncodable<V>
): BinaryEncodable<Record<K, V>> =>
  binaryEncodable(
    isRecordOf(encKey.guard, encVal.guard),
    codRecordOf(encKey.codec, encVal.codec)
  );

export const encObjectOf = <
  const T extends { [K in keyof T]: CodecValue },
>(shape: {
  [K in keyof T]-?: BinaryEncodable<T[K]>;
}): BinaryEncodable<T> =>
  binaryEncodable(
    isExactObjectOf(
      mapObject<typeof shape, Record<string, Guard<unknown>>>(
        shape,
        ([key, { guard }]) => [String(key), guard]
      )
    ) as Guard<T>,
    codObjectOf(
      mapObject<typeof shape, { [K in keyof T]: BinaryCodec<T[K]> }>(
        shape,
        ([key, { codec }]) => [key, codec]
      )
    )
  );

export const encMapOf = <
  const K extends CodecValue,
  const V extends CodecValue,
>(
  encKey: BinaryEncodable<K>,
  encVal: BinaryEncodable<V>
): BinaryEncodable<Map<K, V>> =>
  binaryEncodable(
    (value): value is Map<K, V> =>
      value instanceof Map &&
      value
        .entries()
        .every(([key, val]) => encKey.guard(key) && encVal.guard(val)),
    codMapOf(encKey.codec, encVal.codec)
  );

export const encUnionOf = <const T extends ReadonlyNonEmptyArray<CodecValue>>(
  ...encs: { [K in keyof T]: BinaryEncodable<T[K]> }
): BinaryEncodable<T[number]> => {
  const cod = chooseUIntCod(encs.length - 1);
  const matchEncodable = (value: T[number]) =>
    mapFind(encs, (encodable, index) =>
      encodable.guard(value) ? { index, encodable } : null
    ) ?? raise(new TypeError("Value matches no union variant"));

  return binaryEncodable(
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

type RegistryValues<
  Reg extends Record<string, BinaryEncodable>,
  Ids = UnionToTuple<keyof Reg>,
> = Ids extends [infer Id extends keyof Reg, ...infer Rest]
  ? { id: Id; data: EncodableType<Reg[Id]> } | RegistryValues<Reg, Rest>
  : never;

export const encRegistryValues = <
  const Reg extends Record<string, BinaryEncodable>,
>(
  registry: Reg
): BinaryEncodable<RegistryValues<Reg>> =>
  encUnionOf(
    ...(typedToEntries(registry).map(([id, data]) =>
      encObjectOf({ id: encExact(id as string), data })
    ) as NonEmptyArray<BinaryEncodable>)
  ) as BinaryEncodable<RegistryValues<Reg>>;
