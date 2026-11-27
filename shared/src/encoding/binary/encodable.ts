import {
  isArrayOf,
  isBoolean,
  isExact,
  isExactObjectOf,
  isInteger,
  isNumber,
  isOneOf,
  isOptional,
  isRecordOf,
  isTupleOf,
  type Guard,
} from "deep-guards";
import {
  attempt,
  type NonEmptyArray,
  type ReadonlyNonEmptyArray,
  type Tagged,
  type UnionToTuple,
  type Untag,
} from "niall-utils/core";
import { mapObject, typedToEntries } from "niall-utils/data";
import { Vector } from "vectyped";

import type { Encodable } from "../format.ts";
import {
  chooseUIntCod,
  codArrayOf,
  codBoolean,
  codExact,
  codMapOf,
  codNumber,
  codObjectOf,
  codOneOf,
  codOptional,
  codRecordOf,
  codSetOf,
  codTransform,
  codTupleOf,
  codUnionOf,
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

type Primitive = string | number | bigint | boolean | symbol | null | undefined;

type DeepWritable<T> =
  T extends Vector<infer _N extends number>
    ? T
    : // Tagged primitives (e.g. RegionId) are `primitive & object`, so they
      // must be kept whole before the object branch maps them.
      T extends Primitive
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

export const isIntegerIn =
  (min: number, max: number): Guard<number> =>
  (value): value is number =>
    isInteger(value) && value >= min && value <= max;
export const isSignedInt = (bits: number) =>
  isIntegerIn(-(2 ** (bits - 1)), 2 ** (bits - 1) - 1);
export const isUnsignedInt = (bits: number) => isIntegerIn(0, 2 ** bits - 1);
export const isFiniteNumber: Guard<number> = (value): value is number =>
  isNumber(value) && Number.isFinite(value);

const numberGuards: Record<NumberCodec, Guard<number>> = {
  i8: isSignedInt(8),
  i16: isSignedInt(16),
  i32: isSignedInt(32),
  u8: isUnsignedInt(8),
  u16: isUnsignedInt(16),
  u32: isUnsignedInt(32),
  f16: isFiniteNumber,
  f32: isFiniteNumber,
  f64: isFiniteNumber,
};

export const encNumber: {
  (tpe: NumberCodec): BinaryEncodable<number>;
  (tpe: "uChoose", value: number): BinaryEncodable<number>;
} = (tpe: NumberCodec | "uChoose", value?: number): BinaryEncodable<number> =>
  tpe === "uChoose"
    ? binaryEncodable(
        isIntegerIn(0, value as number),
        chooseUIntCod(value as number)
      )
    : binaryEncodable(numberGuards[tpe], codNumber(tpe));

export const encTransform = <
  const B extends CodecValue,
  const A extends CodecValue,
>(
  enc: BinaryEncodable<B>,
  guard: Guard<A>,
  decode: (stored: B) => A,
  encode: (value: A) => B
): BinaryEncodable<A> =>
  binaryEncodable(guard, codTransform(enc.codec, decode, encode));

export const encTagged = <T extends Tagged<CodecValue, string>>(
  enc: BinaryEncodable<Untag<T>>
): BinaryEncodable<T> => enc as unknown as BinaryEncodable<T>;

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

export const encVec2 = encTransform(
  encTupleOf(encNumber("f32"), encNumber("f32")),
  (value): value is Vector<2> =>
    value instanceof Vector && value.isSize(2) && value.every(Number.isFinite),
  ([x, y]) => Vector.create(x, y),
  vec => vec.toArray()
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
>(shape: { [K in keyof T]-?: BinaryEncodable<T[K]> }): BinaryEncodable<T> =>
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

export const encUnionOf = <const T extends readonly CodecValue[]>(
  ...encs: { [K in keyof T]: BinaryEncodable<T[K]> }
): BinaryEncodable<T[number]> =>
  binaryEncodable(
    (value): value is T[number] => encs.some(({ guard }) => guard(value)),
    codUnionOf(
      encs.map(({ codec }) => codec),
      value => encs.findIndex(({ guard }) => guard(value))
    )
  );

type RegistryValues<
  Reg extends Record<string, BinaryEncodable>,
  Types = UnionToTuple<keyof Reg>,
> = Types extends [infer Tpe extends keyof Reg, ...infer Rest]
  ? { type: Tpe; data: EncodableType<Reg[Tpe]> } | RegistryValues<Reg, Rest>
  : never;

export const encRegistryValues = <
  const Reg extends Record<string, BinaryEncodable>,
>(
  registry: Reg
): BinaryEncodable<RegistryValues<Reg>> =>
  encUnionOf(
    ...(typedToEntries(registry).map(([type, data]) =>
      encObjectOf({ type: encExact(type as string), data })
    ) as NonEmptyArray<BinaryEncodable>)
  ) as BinaryEncodable<RegistryValues<Reg>>;
