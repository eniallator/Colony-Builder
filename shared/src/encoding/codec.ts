import { isOneOf, type TypeFromGuard } from "deep-guards";
import {
  raise,
  tuple,
  type ReadonlyNonEmptyArray,
  type Tagged,
  type Untag,
} from "niall-utils/core";
import { typedToEntries } from "niall-utils/data";

export interface Cursor {
  view: DataView;
  pos: number;
}

export type CodecValue = NonNullable<unknown> | undefined;

/** Fixed-layout binary codec. All multi-byte values are little-endian. */
export interface Codec<T extends CodecValue> {
  // Method syntax keeps `T` bivariant, so an `object` codec (required keys that may be
  // `undefined`) is assignable to a guard's type (optional keys).
  size(value: T): number;
  write(cursor: Cursor, value: T): void;
  read(cursor: Cursor): T;
}

// oxlint-disable-next-line typescript/no-explicit-any
export type CodecType<C extends Codec<any>> =
  C extends Codec<infer T> ? T : never;

export const codMap = <const A extends CodecValue, const B extends CodecValue>(
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

export const codTagged = <T extends Tagged<CodecValue, string>>(
  codec: Codec<Untag<T>>
): Codec<T> => codec as unknown as Codec<T>;

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
export const codF64 = fixedCodec(
  8,
  (view, pos, value) => {
    view.setFloat64(pos, value, LITTLE_ENDIAN);
  },
  (view, pos) => view.getFloat64(pos, LITTLE_ENDIAN)
);

const U8_MAX = 2 ** 8;
const U16_MAX = 2 ** 16;
export const chooseUIntCod = (value: number): Codec<number> =>
  value < U8_MAX ? codU8 : value < U16_MAX ? codU16 : codU32;

export const codBoolean = codMap<boolean, number>(codU8, Number, v => !!v);

const PRECISIONS = tuple("u8", "u16", "u32");
export const isPrecision = isOneOf(...PRECISIONS);
/** Width of the unsigned integer used for a length prefix or run length. */
export type Precision = TypeFromGuard<typeof isPrecision>;

const PRECISION_CODECS: Record<Precision, Codec<number>> = {
  u8: codU8,
  u16: codU16,
  u32: codU32,
};

const precisionMax = (precision: Precision): number =>
  2 ** (8 * PRECISION_CODECS[precision].size(0)) - 1;

/** Unsigned integer codec of the given precision that rejects overflowing values. */
export const codUInt = (precision: Precision): Codec<number> => {
  const codec = PRECISION_CODECS[precision];
  const max = precisionMax(precision);

  return {
    size: value => codec.size(value),
    write: (cursor, value) => {
      if (value > max) {
        throw new RangeError(`Value ${value} exceeds ${precision} maximum`);
      }
      codec.write(cursor, value);
    },
    read: cursor => codec.read(cursor),
  };
};

const sumSizes = <T>(
  items: Iterable<T>,
  size: (item: T) => number,
  acc: number = 0
): number => {
  for (const item of items) acc += size(item);
  return acc;
};

const assertFits = (cursor: Cursor, length: number, name: string): void => {
  if (length > cursor.view.byteLength - cursor.pos) {
    throw new RangeError(`${name} length exceeds remaining bytes`);
  }
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/** A length prefix of the given precision followed by the UTF-8 bytes. */
export const codStringOf = (
  lengthPrecision: Precision = "u32"
): Codec<string> => {
  const codLength = codUInt(lengthPrecision);

  return {
    size: value => codLength.size(0) + textEncoder.encode(value).length,
    write: (cursor, value) => {
      const bytes = textEncoder.encode(value);
      codLength.write(cursor, bytes.length);
      new Uint8Array(
        cursor.view.buffer,
        cursor.view.byteOffset + cursor.pos
      ).set(bytes);
      cursor.pos += bytes.length;
    },
    read: cursor => {
      const length = codLength.read(cursor);
      assertFits(cursor, length, "String");
      const bytes = new Uint8Array(
        cursor.view.buffer,
        cursor.view.byteOffset + cursor.pos,
        length
      );
      cursor.pos += length;
      return textDecoder.decode(bytes);
    },
  };
};

export const codExact = <const T extends string | number | boolean>(
  value: T
): Codec<T> => ({
  size: () => 0,
  write: () => undefined,
  read: () => value,
});

export const codOptional = <const T extends CodecValue>(
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
  const T extends ReadonlyNonEmptyArray<string | number | boolean>,
>(
  values: T,
  precision?: Precision
): Codec<T[number]> => {
  const cod =
    precision != null ? codUInt(precision) : chooseUIntCod(values.length);

  return {
    size: () => cod.size(0),
    write: (cursor, value) => {
      cod.write(cursor, values.indexOf(value));
    },
    read: cursor =>
      values[cod.read(cursor)] ?? raise(new RangeError("Unknown enum index")),
  };
};

export const codTupleOf = <const T extends readonly CodecValue[]>(
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

export const codSetOf = <const T extends CodecValue>(
  codec: Codec<T>,
  lengthPrecision: Precision = "u8"
): Codec<Set<T>> => {
  const codLength = codUInt(lengthPrecision);

  return {
    size: values =>
      sumSizes(values, value => codec.size(value), codLength.size(0)),
    write: (cursor, values) => {
      codLength.write(cursor, values.size);
      for (const value of values) codec.write(cursor, value);
    },
    read: cursor => {
      const length = codLength.read(cursor);
      assertFits(cursor, length, "Set");
      const set = new Set<T>();
      for (let i = 0; i < length; i++) set.add(codec.read(cursor));
      return set;
    },
  };
};

const codArrayMode = codOneOf(["dynamic", "rle", "fixed", "fixedrle"]);

export interface ArrayOptions {
  fixedLength?: number;
  lengthPrecision?: Precision;
  runPrecision?: Precision;
}

export const codArrayOf = <const T extends CodecValue>(
  codec: Codec<T>,
  opts: ArrayOptions = {}
): Codec<T[]> => {
  const { fixedLength, lengthPrecision = "u32", runPrecision = "u8" } = opts;
  const codLength = codUInt(lengthPrecision);
  const codRun = codUInt(runPrecision);
  const maxRun = precisionMax(runPrecision);
  const isFixed = fixedLength != null;

  const modeOf = (rle: boolean): CodecType<typeof codArrayMode> =>
    isFixed ? (rle ? "fixedrle" : "fixed") : rle ? "rle" : "dynamic";

  const layout = (values: T[], rle: boolean) => {
    const units: [T, number][] = rle
      ? values.reduce<[T, number][]>((runs, value) => {
          const last = runs.at(-1);
          if (last != null && last[0] === value && last[1] < maxRun) last[1]++;
          else runs.push([value, 1]);
          return runs;
        }, [])
      : values.map(value => [value, 1]);

    const size =
      (isFixed ? 0 : codLength.size(0)) +
      sumSizes(
        units,
        ([value]) => (rle ? codRun.size(0) : 0) + codec.size(value)
      );

    return { rle, units, size };
  };

  const smallest = (values: T[]) => {
    const plain = layout(values, false);
    const runs = layout(values, true);

    return runs.size < plain.size ? runs : plain;
  };

  return {
    size: values => codArrayMode.size("dynamic") + smallest(values).size,
    write: (cursor, values) => {
      if (isFixed && values.length !== fixedLength) {
        throw new Error(`Expected length ${fixedLength}, got ${values.length}`);
      }

      const { rle, units } = smallest(values);
      codArrayMode.write(cursor, modeOf(rle));
      if (!isFixed) codLength.write(cursor, units.length);
      for (const [value, runLength] of units) {
        if (rle) codRun.write(cursor, runLength);
        codec.write(cursor, value);
      }
    },
    read: cursor => {
      const mode = codArrayMode.read(cursor);
      const rle = mode === "rle" || mode === "fixedrle";
      if (mode !== modeOf(rle)) {
        throw new RangeError(`Array mode ${mode} is not allowed here`);
      }

      const unitCount = fixedLength ?? codLength.read(cursor);
      if (!(isFixed && rle)) assertFits(cursor, unitCount, "Array");

      const values: T[] = [];
      for (
        let units = 0;
        isFixed ? values.length < unitCount : units < unitCount;
        units++
      ) {
        const runLength = rle ? codRun.read(cursor) : 1;
        if (isFixed && runLength > unitCount - values.length) {
          throw new RangeError("Run length exceeds remaining array length");
        }

        const value = codec.read(cursor);
        for (let i = 0; i < runLength; i++) values.push(value);
      }
      return values;
    },
  };
};

export const codEntries = <
  const K extends CodecValue,
  const V extends CodecValue,
>(
  codKey: Codec<K>,
  codVal: Codec<V>,
  lengthPrecision: Precision = "u32"
): Codec<[K, V][]> => {
  const codLength = codUInt(lengthPrecision);

  return {
    size: value =>
      sumSizes(
        value,
        ([key, val]) => codKey.size(key) + codVal.size(val),
        codLength.size(0)
      ),
    write: (cursor, value) => {
      codLength.write(cursor, value.length);
      value.forEach(([key, val]) => {
        codKey.write(cursor, key);
        codVal.write(cursor, val);
      });
    },
    read: cursor => {
      const entries: [K, V][] = [];
      const length = codLength.read(cursor);
      assertFits(cursor, length, "Entries");
      for (let i = 0; i < length; i++) {
        entries.push([codKey.read(cursor), codVal.read(cursor)]);
      }
      return entries;
    },
  };
};

export const codRecordOf = <
  const K extends string | number,
  const V extends CodecValue,
>(
  codKey: Codec<K>,
  codVal: Codec<V>,
  lengthPrecision: Precision = "u32"
): Codec<Record<K, V>> => {
  const codLength = codUInt(lengthPrecision);

  return {
    size: value =>
      sumSizes(
        typedToEntries(value),
        ([key, val]) => codKey.size(key) + codVal.size(val),
        codLength.size(0)
      ),
    write: (cursor, value) => {
      const entries = typedToEntries(value);
      codLength.write(cursor, entries.length);
      entries.forEach(([key, val]) => {
        codKey.write(cursor, key);
        codVal.write(cursor, val);
      });
    },
    read: cursor => {
      const rec: Partial<Record<K, V>> = {};
      const length = codLength.read(cursor);
      assertFits(cursor, length, "Record");
      for (let i = 0; i < length; i++) {
        rec[codKey.read(cursor)] = codVal.read(cursor);
      }
      return rec as Record<K, V>;
    },
  };
};

export const codObjectOf = <
  const T extends { [K in keyof T]: CodecValue },
>(shape: {
  [K in keyof T]: Codec<T[K]>;
}): Codec<T> => {
  const fields = typedToEntries(shape);

  return {
    size: value => sumSizes(fields, ([key, codec]) => codec.size(value[key])),
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

export const codMapOf = <
  const K extends CodecValue,
  const V extends CodecValue,
>(
  codKey: Codec<K>,
  codVal: Codec<V>,
  lengthPrecision: Precision = "u32"
): Codec<Map<K, V>> => {
  const codLength = codUInt(lengthPrecision);

  return {
    size: value =>
      sumSizes(
        value,
        ([key, val]) => codKey.size(key) + codVal.size(val),
        codLength.size(0)
      ),
    write: (cursor, value) => {
      codLength.write(cursor, value.size);
      value.forEach((val, key) => {
        codKey.write(cursor, key);
        codVal.write(cursor, val);
      });
    },
    read: cursor => {
      const map = new Map<K, V>();
      const length = codLength.read(cursor);
      assertFits(cursor, length, "Map");
      for (let i = 0; i < length; i++) {
        map.set(codKey.read(cursor), codVal.read(cursor));
      }
      return map;
    },
  };
};
