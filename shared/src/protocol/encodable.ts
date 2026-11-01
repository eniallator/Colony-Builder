import {
  isArrayOf,
  isExact,
  isExactObjectOf,
  isOneOf,
  isOptional,
  isRecordOf,
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
  codFixedArrayOf,
  codFixedRLEArray,
  codMapOf,
  codObjectOf,
  codOneOf,
  codOptional,
  codRecordOf,
  codRLEArray,
  codTupleOf,
  type Codec,
  type CodecValue,
  type Precision,
} from "./codec.ts";

export interface Encodable<
  // oxlint-disable-next-line typescript/no-explicit-any
  T extends CodecValue = any,
  // oxlint-disable-next-line typescript/no-explicit-any
  Args extends readonly unknown[] = any,
> {
  guard: Guard<T>;
  codec: Codec<T>;
  create: (...args: Args) => T;
  encode: (value: T) => Uint8Array<ArrayBuffer>;
  decode: (encoded: Uint8Array) => T | undefined;
}

export type EncodableType<E extends Encodable> =
  E extends Encodable<infer T> ? T : never;

export const encodable = <
  const T extends CodecValue,
  Args extends readonly unknown[] = [T],
>(
  guard: Guard<T>,
  codec: Codec<T>,
  create?: (...args: Args) => NoInfer<T>
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
  const T extends string | number | boolean,
  Args extends readonly unknown[] = [T],
>(
  value: T,
  create?: (...args: Args) => NoInfer<T>
): Encodable<T, Args> => encodable(isExact(value), codExact(value), create);

export const encOneOf = <
  const T extends ReadonlyNonEmptyArray<string | number | boolean>,
>(
  values: T,
  precision?: Precision
): Encodable<T[number], [T[number]]> =>
  encodable(isOneOf(...values), codOneOf(values, precision));

export const encOptional = <
  const T extends CodecValue,
  Args extends readonly unknown[] = [T | undefined],
>(
  inner: Encodable<T>,
  create?: (...args: Args) => NoInfer<T | undefined>
): Encodable<T | undefined, Args> =>
  encodable(isOptional(inner.guard), codOptional(inner.codec), create);

export const encArrayOf = <
  const T extends CodecValue,
  Args extends readonly unknown[] = [T[]],
>(
  inner: Encodable<T>,
  runPrecision?: Precision,
  create?: (...args: Args) => NoInfer<T[]>
): Encodable<T[], Args> =>
  encodable(
    isArrayOf(inner.guard),
    runPrecision != null
      ? codRLEArray(inner.codec, "u32", runPrecision)
      : codArrayOf(inner.codec),
    create
  );

export const encFixedArrayOf = <
  const T extends CodecValue,
  Args extends readonly unknown[] = [T[]],
>(
  inner: Encodable<T>,
  length: number,
  runPrecision?: Precision,
  create?: (...args: Args) => NoInfer<T[]>
): Encodable<T[], Args> => {
  const isItems = isArrayOf(inner.guard);

  return encodable(
    (value): value is T[] => isItems(value) && value.length === length,
    runPrecision != null
      ? codFixedRLEArray(inner.codec, length, runPrecision)
      : codFixedArrayOf(inner.codec, length),
    create
  );
};

export const encTupleOf = <const T extends ReadonlyNonEmptyArray<CodecValue>>(
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

export const encRecordOf = <
  const K extends string | number,
  const V extends CodecValue,
  Args extends readonly unknown[] = [Record<K, V>],
>(
  encKey: Encodable<K>,
  encVal: Encodable<V>,
  create?: (...args: Args) => NoInfer<Record<K, V>>
): Encodable<Record<K, V>, Args> =>
  encodable(
    isRecordOf(encKey.guard, encVal.guard),
    codRecordOf(encKey.codec, encVal.codec),
    create
  );

export const encObjectOf = <
  const T extends { [K in keyof T]: CodecValue },
  Args extends readonly unknown[] = [T],
>(
  shape: { [K in keyof T]-?: Encodable<T[K]> },
  create?: (...args: Args) => NoInfer<T>
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

export const encMapOf = <
  const K extends string | number,
  const V extends CodecValue,
  Args extends readonly unknown[] = [Map<K, V>],
>(
  encKey: Encodable<K>,
  encVal: Encodable<V>,
  create?: (...args: Args) => NoInfer<Map<K, V>>
): Encodable<Map<K, V>, Args> =>
  encodable(
    (value): value is Map<K, V> =>
      value instanceof Map &&
      value
        .entries()
        .every(([key, val]) => encKey.guard(key) && encVal.guard(val)),
    codMapOf(encKey.codec, encVal.codec),
    create
  );

export const encUnionOf = <const T extends ReadonlyNonEmptyArray<CodecValue>>(
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
