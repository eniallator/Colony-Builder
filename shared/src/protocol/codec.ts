import {
  raise,
  type FillTuple,
  type ReadonlyNonEmptyArray,
  type Tagged,
  type Untag,
} from "niall-utils/core";
import { typedToEntries } from "niall-utils/data";

export interface Cursor {
  view: DataView;
  pos: number;
}

/** Fixed-layout binary codec. All multi-byte values are little-endian. */
export interface Codec<T> {
  // Method syntax keeps `T` bivariant, so an `object` codec (required keys that may be
  // `undefined`) is assignable to a guard's type (optional keys).
  size(value: T): number;
  write(cursor: Cursor, value: T): void;
  read(cursor: Cursor): T;
}

// oxlint-disable-next-line typescript/no-explicit-any
export type CodecType<C extends Codec<any>> =
  C extends Codec<infer T> ? T : never;

export const codMap = <const A, const B>(
  codec: Codec<B>,
  encode: (value: A) => B,
  decode: (value: B) => A
): Codec<A> => ({
  size: value => codec.size(encode(value)),
  write: (cursor, value) => {
    codec.write(cursor, encode(value));
  },
  read: cursor => decode(codec.read(cursor)),
});

export const codTagged = <T extends Tagged<unknown, string>>(
  codec: Codec<Untag<T>>
): Codec<T> => codec as Codec<T>;

const LITTLE_ENDIAN = true;

const fixedCodec = (
  bytes: number,
  write: (view: DataView, pos: number, value: number) => void,
  read: (view: DataView, pos: number) => number
): Codec<number> => ({
  size: () => bytes,
  write: (cursor, value) => {
    write(cursor.view, cursor.pos, value);
    cursor.pos += bytes;
  },
  read: cursor => {
    const value = read(cursor.view, cursor.pos);
    cursor.pos += bytes;
    return value;
  },
});

export const codI8 = fixedCodec(
  1,
  (view, pos, value) => {
    view.setInt8(pos, value);
  },
  (view, pos) => view.getInt8(pos)
);

export const codI16 = fixedCodec(
  2,
  (view, pos, value) => {
    view.setInt16(pos, value, LITTLE_ENDIAN);
  },
  (view, pos) => view.getInt16(pos, LITTLE_ENDIAN)
);

export const codI32 = fixedCodec(
  4,
  (view, pos, value) => {
    view.setInt32(pos, value, LITTLE_ENDIAN);
  },
  (view, pos) => view.getInt32(pos, LITTLE_ENDIAN)
);

export const codU8 = fixedCodec(
  1,
  (view, pos, value) => {
    view.setUint8(pos, value);
  },
  (view, pos) => view.getUint8(pos)
);

export const codU16 = fixedCodec(
  2,
  (view, pos, value) => {
    view.setUint16(pos, value, LITTLE_ENDIAN);
  },
  (view, pos) => view.getUint16(pos, LITTLE_ENDIAN)
);

export const codU32 = fixedCodec(
  4,
  (view, pos, value) => {
    view.setUint32(pos, value, LITTLE_ENDIAN);
  },
  (view, pos) => view.getUint32(pos, LITTLE_ENDIAN)
);

export const codF16 = fixedCodec(
  2,
  (view, pos, value) => {
    view.setFloat16(pos, value, LITTLE_ENDIAN);
  },
  (view, pos) => view.getFloat16(pos, LITTLE_ENDIAN)
);

export const codF32 = fixedCodec(
  4,
  (view, pos, value) => {
    view.setFloat32(pos, value, LITTLE_ENDIAN);
  },
  (view, pos) => view.getFloat32(pos, LITTLE_ENDIAN)
);

const U8_MAX = 2 ** 8;
const U16_MAX = 2 ** 16;
export const chooseUIntCod = (value: number): Codec<number> =>
  value < U8_MAX ? codU8 : value < U16_MAX ? codU16 : codU32;

export const codBoolean = codMap<boolean, number>(codU8, Number, v => !!v);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/** A u32 byte length followed by the UTF-8 bytes. */
export const codString: Codec<string> = {
  size: value => codU32.size(0) + textEncoder.encode(value).length,
  write: (cursor, value) => {
    const bytes = textEncoder.encode(value);
    codU32.write(cursor, bytes.length);
    new Uint8Array(cursor.view.buffer, cursor.view.byteOffset + cursor.pos).set(
      bytes
    );
    cursor.pos += bytes.length;
  },
  read: cursor => {
    const length = codU32.read(cursor);
    if (length > cursor.view.byteLength - cursor.pos) {
      throw new RangeError("String length exceeds remaining bytes");
    }
    const bytes = new Uint8Array(
      cursor.view.buffer,
      cursor.view.byteOffset + cursor.pos,
      length
    );
    cursor.pos += length;
    return textDecoder.decode(bytes);
  },
};

export const codExact = <const T extends string | number | boolean | null>(
  value: T
): Codec<T> => ({
  size: () => 0,
  write: () => undefined,
  read: () => value,
});

export const codOptional = <const T>(
  codec: Codec<T>
): Codec<T | undefined> => ({
  size: value => 1 + (value === undefined ? 0 : codec.size(value)),
  write: (cursor, value) => {
    codU8.write(cursor, value === undefined ? 0 : 1);
    if (value !== undefined) codec.write(cursor, value);
  },
  read: cursor => (codU8.read(cursor) === 0 ? undefined : codec.read(cursor)),
});

export const codOneOf = <
  const T extends ReadonlyNonEmptyArray<string | number | boolean | null>,
>(
  ...values: T
): Codec<T[number]> => {
  const cod = chooseUIntCod(values.length);

  return {
    size: () => cod.size(0),
    write: (cursor, value) => {
      cod.write(cursor, values.indexOf(value));
    },
    read: cursor => {
      const value = values[cod.read(cursor)];
      return value === undefined
        ? raise(new RangeError("Unknown enum index"))
        : value;
    },
  };
};

export const codTupleOf = <const T extends readonly unknown[]>(
  ...codecs: { [K in keyof T]: Codec<T[K]> }
): Codec<T> => ({
  size: values =>
    codecs.reduce((acc, codec, i) => acc + codec.size(values[i]), 0),
  write: (cursor, values) => {
    codecs.forEach((codec, i) => {
      codec.write(cursor, values[i]);
    });
  },
  read: cursor => codecs.map(codec => codec.read(cursor)) as unknown as T,
});

export const codFixedArrayOf = <const T, const N extends number>(
  codec: Codec<T>,
  length: N
): Codec<FillTuple<T, N>> => ({
  size: values => (values as T[]).reduce((sum, v) => sum + codec.size(v), 0),
  write: (cursor, values) => {
    if ((values as T[]).length !== length) {
      throw new Error(
        `Expected length ${length}, got ${(values as T[]).length}`
      );
    }

    for (let i = 0; i < length; i++) {
      codec.write(cursor, (values as T[])[i] as T);
    }
  },
  read: cursor => {
    return length > cursor.view.byteLength - cursor.pos
      ? raise(new RangeError("Array length exceeds remaining bytes"))
      : (Array.from({ length }, () => codec.read(cursor)) as FillTuple<T, N>);
  },
});

export const codArrayOf = <const T>(codec: Codec<T>): Codec<T[]> => ({
  size: values =>
    values.reduce((sum, v) => sum + codec.size(v), codU32.size(0)),
  write: (cursor, values) => {
    codU32.write(cursor, values.length);
    for (const value of values) codec.write(cursor, value);
  },
  read: cursor => {
    const length = codU32.read(cursor);
    return length > cursor.view.byteLength - cursor.pos
      ? raise(new RangeError("Array length exceeds remaining bytes"))
      : Array.from({ length }, () => codec.read(cursor));
  },
});

export const codRecordOf = <const K extends string | number, const V>(
  codKey: Codec<K>,
  codVal: Codec<V>
): Codec<Record<K, V>> => ({
  size: value =>
    typedToEntries(value).reduce(
      (acc, [key, val]) => acc + codKey.size(key) + codVal.size(val),
      codU32.size(0)
    ),
  write: (cursor, value) => {
    const entries = typedToEntries(value);
    codU32.write(cursor, entries.length);
    entries.forEach(([key, val]) => {
      codKey.write(cursor, key);
      codVal.write(cursor, val);
    });
  },
  read: cursor => {
    const rec: Partial<Record<K, V>> = {};
    const length = codU32.read(cursor);
    for (let i = 0; i < length; i++) {
      rec[codKey.read(cursor)] = codVal.read(cursor);
    }
    return rec as Record<K, V>;
  },
});

export const codObjectOf = <const T extends object>(shape: {
  [K in keyof T]: Codec<T[K]>;
}): Codec<T> => {
  const fields = typedToEntries(shape);

  return {
    size: value =>
      fields.reduce((sum, [key, codec]) => sum + codec.size(value[key]), 0),
    write: (cursor, value) => {
      for (const [key, codec] of fields) codec.write(cursor, value[key]);
    },
    read: cursor => {
      const result: Partial<T> = {};
      for (const [key, codec] of fields) {
        const value = codec.read(cursor);
        if (value !== undefined) result[key] = value;
      }
      return result as T;
    },
  };
};

export const codMapOf = <const K, const V>(
  codKey: Codec<K>,
  codVal: Codec<V>
): Codec<Map<K, V>> => ({
  size: value =>
    value
      .entries()
      .reduce(
        (acc, [key, val]) => acc + codKey.size(key) + codVal.size(val),
        codU32.size(0)
      ),
  write: (cursor, value) => {
    codU32.write(cursor, value.size);
    value.forEach((val, key) => {
      codKey.write(cursor, key);
      codVal.write(cursor, val);
    });
  },
  read: cursor => {
    const map = new Map<K, V>();
    const length = codU32.read(cursor);
    for (let i = 0; i < length; i++) {
      map.set(codKey.read(cursor), codVal.read(cursor));
    }
    return map;
  },
});
