import { describe, expect, it } from "vitest";

import {
  chooseUIntCod,
  codArrayOf,
  codBoolean,
  codEntries,
  codExact,
  codF16,
  codF32,
  codI8,
  codI16,
  codI32,
  codMap,
  codMapOf,
  codObjectOf,
  codOneOf,
  codOptional,
  codRecordOf,
  codStringOf,
  codTagged,
  codTupleOf,
  codU8,
  codU16,
  codU32,
  codUInt,
  isPrecision,
  type Codec,
  type CodecValue,
} from "./codec.ts";

const codString = codStringOf();

const write = <T extends CodecValue>(codec: Codec<T>, value: T) => {
  const buffer = new ArrayBuffer(codec.size(value));
  codec.write({ view: new DataView(buffer), pos: 0 }, value);
  return [...new Uint8Array(buffer)];
};

const read = <T extends CodecValue>(codec: Codec<T>, bytes: number[]) => {
  const cursor = { view: new DataView(new Uint8Array(bytes).buffer), pos: 0 };
  return { value: codec.read(cursor), pos: cursor.pos };
};

describe("codU8", () => {
  it("is one byte wide", () => {
    expect(codU8.size(0)).toBe(1);
    expect(write(codU8, 0xab)).toEqual([0xab]);
  });

  it("reads a byte and advances the cursor", () => {
    expect(read(codU8, [200])).toEqual({ value: 200, pos: 1 });
  });
});

describe("signed integer codecs", () => {
  it("are as wide as their name says, little-endian", () => {
    expect([codI8.size(0), codI16.size(0), codI32.size(0)]).toEqual([1, 2, 4]);
    expect(write(codI8, -1)).toEqual([0xff]);
    expect(write(codI16, -2)).toEqual([0xfe, 0xff]);
    expect(write(codI32, -2)).toEqual([0xfe, 0xff, 0xff, 0xff]);
  });

  it("reads negative values and advances the cursor", () => {
    expect(read(codI8, [0x80])).toEqual({ value: -128, pos: 1 });
    expect(read(codI16, [0x00, 0x80])).toEqual({ value: -32768, pos: 2 });
    expect(read(codI32, [0, 0, 0, 0x80])).toEqual({
      value: -(2 ** 31),
      pos: 4,
    });
  });
});

describe("codU16", () => {
  it("is two bytes wide, little-endian", () => {
    expect(codU16.size(0)).toBe(2);
    expect(write(codU16, 0x0102)).toEqual([2, 1]);
  });

  it("reads little-endian and advances the cursor", () => {
    expect(read(codU16, [2, 1])).toEqual({ value: 0x0102, pos: 2 });
  });

  it("round-trips the full range", () => {
    expect(read(codU16, write(codU16, 0xffff)).value).toBe(0xffff);
    expect(read(codU16, write(codU16, 0)).value).toBe(0);
  });

  it("throws when reading past the end of the buffer", () => {
    expect(() => read(codU16, [1])).toThrow(RangeError);
  });
});

describe("codF16", () => {
  it("is two bytes wide, little-endian", () => {
    expect(codF16.size(0)).toBe(2);
    expect(write(codF16, 1)).toEqual([0x00, 0x3c]);
  });

  it("reads little-endian and advances the cursor", () => {
    expect(read(codF16, [0x00, 0x3e])).toEqual({ value: 1.5, pos: 2 });
  });

  it("round-trips non-finite values", () => {
    expect(read(codF16, write(codF16, -Infinity)).value).toBe(-Infinity);
    expect(read(codF16, write(codF16, Number.NaN)).value).toBeNaN();
  });

  it("loses precision beyond half-float range", () => {
    expect(read(codF16, write(codF16, 0.1)).value).not.toBe(0.1);
    expect(read(codF16, write(codF16, 70000)).value).toBe(Infinity);
  });
});

describe("chooseUIntCod", () => {
  it.each([
    [0, codU8],
    [255, codU8],
    [256, codU16],
    [65535, codU16],
    [65536, codU32],
  ])("picks the narrowest codec for %i", (value, expected) => {
    expect(chooseUIntCod(value)).toBe(expected);
  });
});

describe("codOneOf", () => {
  it("uses a single byte for up to 256 values", () => {
    const values = Array.from({ length: 200 }, (_, i) => i);
    const cod = codOneOf(values as [number, ...number[]]);

    expect(write(cod, 199)).toEqual([199]);
    expect(read(cod, [199]).value).toBe(199);
  });

  it("widens the index to two bytes past 256 values", () => {
    const values = Array.from({ length: 300 }, (_, i) => i);
    const cod = codOneOf(values as [number, ...number[]]);

    expect(cod.size(0)).toBe(2);
    expect(write(cod, 299)).toEqual([0x2b, 0x01]);
    expect(read(cod, [0x2b, 0x01])).toEqual({ value: 299, pos: 2 });
  });

  it("throws on an index outside the values", () => {
    expect(() => read(codOneOf(["a", "b"]), [2])).toThrow("Unknown enum index");
  });
});

describe("codU32", () => {
  it("is four bytes wide, little-endian", () => {
    expect(codU32.size(0)).toBe(4);
    expect(write(codU32, 0x01020304)).toEqual([4, 3, 2, 1]);
  });

  it("reads little-endian and advances the cursor", () => {
    expect(read(codU32, [4, 3, 2, 1])).toEqual({ value: 0x01020304, pos: 4 });
  });

  it("writes consecutive values from the cursor position", () => {
    const cursor = { view: new DataView(new ArrayBuffer(5)), pos: 0 };
    codU8.write(cursor, 7);
    codU32.write(cursor, 9);

    expect(cursor.pos).toBe(5);
    expect([...new Uint8Array(cursor.view.buffer)]).toEqual([7, 9, 0, 0, 0]);
  });

  it("throws when reading past the end of the buffer", () => {
    expect(() => read(codU32, [1, 2])).toThrow(RangeError);
  });
});

describe("codF32", () => {
  it("is four bytes wide, little-endian", () => {
    expect(codF32.size(0)).toBe(4);
    expect(write(codF32, 1)).toEqual([0, 0, 0x80, 0x3f]);
  });

  it("reads little-endian and advances the cursor", () => {
    expect(read(codF32, [0, 0, 0xc0, 0x3f])).toEqual({ value: 1.5, pos: 4 });
  });

  it("round-trips non-finite values", () => {
    expect(read(codF32, write(codF32, Infinity)).value).toBe(Infinity);
    expect(read(codF32, write(codF32, Number.NaN)).value).toBeNaN();
  });
});

describe("codBoolean", () => {
  it("encodes as a single byte", () => {
    expect(write(codBoolean, true)).toEqual([1]);
    expect(write(codBoolean, false)).toEqual([0]);
  });

  it("reads any non-zero byte as true", () => {
    expect(read(codBoolean, [0]).value).toBe(false);
    expect(read(codBoolean, [1]).value).toBe(true);
    expect(read(codBoolean, [9]).value).toBe(true);
  });
});

describe("codMap", () => {
  const doubled = codMap<number, number>(
    codU8,
    value => value * 2,
    value => value / 2
  );

  it("encodes through the mapping", () => {
    expect(write(doubled, 5)).toEqual([10]);
    expect(doubled.size(5)).toBe(1);
  });

  it("decodes through the mapping", () => {
    expect(read(doubled, [10])).toEqual({ value: 5, pos: 1 });
  });
});

describe("codTagged", () => {
  it("returns the same codec", () => {
    expect(codTagged(codU32)).toBe(codU32);
  });
});

describe("codRecordOf", () => {
  const record = codRecordOf(codString, codU8);

  it("prefixes the entries with a u32 count", () => {
    expect(write(record, {})).toEqual([0, 0, 0, 0]);
    expect(write(record, { a: 1 })).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 0x61, 1]);
  });

  it("sizes exactly what it writes", () => {
    const value = { a: 1, bc: 2 };

    expect(record.size({})).toBe(4);
    expect(record.size(value)).toBe(write(record, value).length);
  });

  it("round-trips, advancing the cursor past every entry", () => {
    const value = { a: 1, bc: 2, def: 3 };
    const bytes = write(record, value);

    expect(read(record, bytes)).toEqual({ value, pos: bytes.length });
    expect(read(record, write(record, {})).value).toEqual({});
  });

  it("round-trips numeric keys", () => {
    const byId = codRecordOf(codU8, codU8);

    expect(write(byId, { 5: 9 })).toEqual([1, 0, 0, 0, 5, 9]);
    expect(read(byId, [1, 0, 0, 0, 5, 9]).value).toEqual({ 5: 9 });
  });

  it("throws when the entries run past the end of the buffer", () => {
    expect(() => read(record, [2, 0, 0, 0, 1, 0, 0, 0, 0x61, 1])).toThrow(
      RangeError
    );
  });
});

describe("codMapOf", () => {
  const map = codMapOf(codU8, codString);

  it("prefixes the entries with a u32 count", () => {
    expect(write(map, new Map())).toEqual([0, 0, 0, 0]);
    expect(write(map, new Map([[7, "a"]]))).toEqual([
      1, 0, 0, 0, 7, 1, 0, 0, 0, 0x61,
    ]);
  });

  it("sizes exactly what it writes", () => {
    const value = new Map([
      [1, "a"],
      [2, "bc"],
    ]);

    expect(map.size(new Map())).toBe(4);
    expect(map.size(value)).toBe(write(map, value).length);
  });

  it("round-trips, keeping insertion order", () => {
    const value = new Map([
      [2, "bc"],
      [1, "a"],
    ]);
    const bytes = write(map, value);

    expect(read(map, bytes)).toEqual({ value, pos: bytes.length });
    expect([...read(map, bytes).value.keys()]).toEqual([2, 1]);
  });
});

describe("codString", () => {
  it.each(["", "hello", "héllo wörld", "日本語", "👾"])(
    "round-trips %j",
    text => {
      const bytes = write(codString, text);

      expect(bytes).toHaveLength(codString.size(text));
      expect(read(codString, bytes)).toEqual({
        value: text,
        pos: bytes.length,
      });
    }
  );

  it("prefixes the byte length, not the character count", () => {
    expect(write(codString, "é")).toEqual([2, 0, 0, 0, 0xc3, 0xa9]);
  });

  it("respects the byte offset of the view and the cursor position", () => {
    const buffer = new ArrayBuffer(12);
    const cursor = { view: new DataView(buffer, 2, 8), pos: 1 };
    codString.write(cursor, "ab");

    expect([...new Uint8Array(buffer)]).toEqual([
      0, 0, 0, 2, 0, 0, 0, 0x61, 0x62, 0, 0, 0,
    ]);
    expect(cursor.pos).toBe(7);
  });

  it("rejects a length longer than the remaining bytes", () => {
    expect(() => read(codString, [5, 0, 0, 0, 0x61])).toThrow(
      "String length exceeds remaining bytes"
    );
  });

  it("rejects invalid UTF-8", () => {
    expect(() => read(codString, [1, 0, 0, 0, 0xff])).toThrow(TypeError);
  });
});

describe("codUInt", () => {
  it("uses the width of the precision", () => {
    expect(write(codUInt("u8"), 7)).toEqual([7]);
    expect(write(codUInt("u16"), 7)).toEqual([7, 0]);
    expect(write(codUInt("u32"), 7)).toEqual([7, 0, 0, 0]);
    expect(codUInt("u16").size(0)).toBe(2);
    expect(read(codUInt("u16"), [7, 0])).toEqual({ value: 7, pos: 2 });
  });

  it("accepts the maximum and rejects anything larger", () => {
    expect(write(codUInt("u8"), 255)).toEqual([255]);
    expect(() => write(codUInt("u8"), 256)).toThrow(RangeError);
    expect(() => write(codUInt("u16"), 65536)).toThrow(RangeError);
  });
});

describe("length precision", () => {
  it("defaults to u32", () => {
    expect(write(codArrayOf(codU8), [1])).toEqual([0, 1, 0, 0, 0, 1]);
  });

  it("is honoured by every length-prefixed codec", () => {
    expect(write(codStringOf("u8"), "a")).toEqual([1, 0x61]);
    expect(write(codArrayOf(codU8, { lengthPrecision: "u8" }), [1])).toEqual([
      0, 1, 1,
    ]);
    expect(write(codEntries(codU8, codU8, "u8"), [[1, 2]])).toEqual([1, 1, 2]);
    expect(write(codRecordOf(codU8, codU8, "u8"), { 1: 2 })).toEqual([1, 1, 2]);
    expect(write(codMapOf(codU8, codU8, "u8"), new Map([[1, 2]]))).toEqual([
      1, 1, 2,
    ]);
  });

  it("throws when a length overflows the precision", () => {
    const distinct = Array.from({ length: 256 }, (_, i) => i);

    expect(() =>
      write(codArrayOf(codU8, { lengthPrecision: "u8" }), distinct)
    ).toThrow(RangeError);
  });
});

describe("codEntries", () => {
  const cod = codEntries(codU8, codU8);
  const value: [number, number][] = [
    [1, 2],
    [3, 4],
  ];

  it("round-trips entries in order", () => {
    expect(write(cod, value)).toEqual([2, 0, 0, 0, 1, 2, 3, 4]);
    expect(read(cod, write(cod, value)).value).toEqual(value);
    expect(cod.size(value)).toBe(8);
  });
});

describe("isPrecision", () => {
  it.each(["u8", "u16", "u32"])("accepts %s", precision => {
    expect(isPrecision(precision)).toBe(true);
  });

  it.each(["u64", "U8", 8, undefined])("rejects %j", value => {
    expect(isPrecision(value)).toBe(false);
  });
});

describe("codUInt reading", () => {
  it("throws when reading past the end of the buffer", () => {
    expect(() => read(codUInt("u16"), [1])).toThrow(RangeError);
  });
});

describe("codOneOf precision", () => {
  const values = ["a", "b"] as const;

  it("overrides the narrowest index width", () => {
    const wide = codOneOf(values, "u16");

    expect(wide.size("a")).toBe(2);
    expect(write(wide, "b")).toEqual([1, 0]);
    expect(read(wide, [1, 0])).toEqual({ value: "b", pos: 2 });
  });

  it("falls back to the narrowest width when omitted", () => {
    expect(write(codOneOf(values), "b")).toEqual([1]);
  });

  it("throws when an index overflows the precision", () => {
    const many = Array.from({ length: 300 }, (_, i) => i);
    const narrow = codOneOf(many as [number, ...number[]], "u8");

    expect(() => write(narrow, 299)).toThrow(RangeError);
  });
});

describe("codExact", () => {
  const exact = codExact("tag");

  it("occupies no bytes", () => {
    expect(exact.size("tag")).toBe(0);
    expect(write(exact, "tag")).toEqual([]);
  });

  it("reads the fixed value without moving the cursor", () => {
    expect(read(exact, [])).toEqual({ value: "tag", pos: 0 });
  });
});

describe("codOptional", () => {
  const optional = codOptional(codU8);

  it("writes a presence byte before a defined value", () => {
    expect(write(optional, undefined)).toEqual([0]);
    expect(write(optional, 5)).toEqual([1, 5]);
  });

  it("sizes exactly what it writes", () => {
    expect(optional.size(undefined)).toBe(1);
    expect(optional.size(5)).toBe(2);
  });

  it("reads back both cases", () => {
    expect(read(optional, [0])).toEqual({ value: undefined, pos: 1 });
    expect(read(optional, [1, 5])).toEqual({ value: 5, pos: 2 });
  });
});

describe("codTupleOf", () => {
  const tuple = codTupleOf<[number, number]>(codU8, codU16);

  it("writes the members in order with no prefix", () => {
    expect(write(tuple, [1, 2])).toEqual([1, 2, 0]);
  });

  it("sizes exactly what it writes", () => {
    expect(tuple.size([1, 2])).toBe(3);
  });

  it("reads the members back, advancing the cursor", () => {
    expect(read(tuple, [1, 2, 0])).toEqual({ value: [1, 2], pos: 3 });
  });
});

describe("codObjectOf", () => {
  const obj = codObjectOf<{ a: number; b: number | undefined }>({
    a: codU8,
    b: codOptional(codU8),
  });

  it("writes the fields in declaration order", () => {
    expect(write(obj, { a: 1, b: 2 })).toEqual([1, 1, 2]);
    expect(write(obj, { a: 1, b: undefined })).toEqual([1, 0]);
  });

  it("sizes exactly what it writes", () => {
    expect(obj.size({ a: 1, b: 2 })).toBe(3);
    expect(obj.size({ a: 1, b: undefined })).toBe(2);
  });

  it("round-trips, omitting undefined fields on read", () => {
    expect(read(obj, [1, 1, 2])).toEqual({ value: { a: 1, b: 2 }, pos: 3 });

    const { value, pos } = read(obj, [1, 0]);
    expect(value).toStrictEqual({ a: 1 });
    expect(pos).toBe(2);
  });
});

describe("codArrayOf", () => {
  const long = Array<number>(300).fill(1);

  describe("without a fixed length", () => {
    const arr = codArrayOf(codU8);

    it("writes the dynamic mode, a u32 count, then the items", () => {
      expect(write(arr, [])).toEqual([0, 0, 0, 0, 0]);
      expect(write(arr, [1, 2])).toEqual([0, 2, 0, 0, 0, 1, 2]);
    });

    it("writes the rle mode, a u32 run count, then each run, when smaller", () => {
      expect(write(arr, [5, 5, 5, 5, 5, 7])).toEqual([
        ...[1, 2, 0, 0, 0],
        ...[5, 5, 1, 7],
      ]);
    });

    it("keeps the plain layout when run-length encoding is no smaller", () => {
      // Both layouts take 9 bytes.
      expect(write(arr, [5, 5, 5, 7])).toEqual([0, 4, 0, 0, 0, 5, 5, 5, 7]);
    });

    it("splits runs longer than the run precision allows", () => {
      expect(write(arr, long)).toEqual([1, 2, 0, 0, 0, 255, 1, 45, 1]);
      expect(read(arr, write(arr, long)).value).toEqual(long);
    });

    it("sizes exactly what it writes", () => {
      for (const value of [[], [1, 2], [5, 5, 5, 5, 5, 7], long]) {
        expect(arr.size(value)).toBe(write(arr, value).length);
      }
      expect(codArrayOf(codString).size(["a", "bc"])).toBe(
        write(codArrayOf(codString), ["a", "bc"]).length
      );
    });

    it("round-trips both layouts, advancing the cursor past every item", () => {
      expect(read(arr, [0, 2, 0, 0, 0, 1, 2])).toEqual({
        value: [1, 2],
        pos: 7,
      });
      expect(read(arr, [1, 2, 0, 0, 0, 5, 5, 1, 7])).toEqual({
        value: [5, 5, 5, 5, 5, 7],
        pos: 9,
      });
      expect(read(arr, [1, 0, 0, 0, 0])).toEqual({ value: [], pos: 5 });
    });

    it("only merges values that are strictly equal", () => {
      const objects = codArrayOf(codObjectOf({ a: codU8 }));

      expect(write(objects, [{ a: 1 }, { a: 1 }, { a: 1 }])[0]).toBe(0);
    });

    it("throws when the count exceeds the remaining bytes", () => {
      expect(() => read(arr, [0, 5, 0, 0, 0, 1])).toThrow(
        "Array length exceeds remaining bytes"
      );
      expect(() => read(arr, [1, 5, 0, 0, 0, 1])).toThrow(
        "Array length exceeds remaining bytes"
      );
    });

    it("throws for the fixed modes", () => {
      expect(() => read(arr, [2, 1])).toThrow(
        "Array mode fixed is not allowed"
      );
      expect(() => read(arr, [3, 1, 1])).toThrow(
        "Array mode fixedrle is not allowed"
      );
    });

    it("throws for an unknown mode", () => {
      expect(() => read(arr, [4])).toThrow("Unknown enum index");
    });
  });

  describe("with a fixed length", () => {
    const four = codArrayOf(codU8, { fixedLength: 4 });

    it("writes the fixed mode and the items with no count", () => {
      expect(write(four, [1, 2, 3, 4])).toEqual([2, 1, 2, 3, 4]);
    });

    it("writes the fixedrle mode and the runs when smaller", () => {
      expect(write(four, [1, 1, 1, 1])).toEqual([3, 4, 1]);
    });

    it("keeps the plain layout when run-length encoding is no smaller", () => {
      // Both layouts take 5 bytes.
      expect(write(four, [5, 5, 5, 7])).toEqual([2, 5, 5, 5, 7]);
    });

    it("splits runs longer than the run precision allows", () => {
      const wide = codArrayOf(codU8, { fixedLength: 300 });
      const wider = codArrayOf(codU8, {
        fixedLength: 300,
        runPrecision: "u16",
      });

      expect(write(wide, long)).toEqual([3, 255, 1, 45, 1]);
      expect(read(wide, [3, 255, 1, 45, 1]).value).toEqual(long);
      expect(write(wider, long)).toEqual([3, 0x2c, 0x01, 1]);
      expect(read(wider, [3, 0x2c, 0x01, 1]).value).toEqual(long);
    });

    it("sizes exactly what it writes", () => {
      for (const value of [
        [1, 2, 3, 4],
        [1, 1, 1, 1],
        [5, 5, 5, 7],
      ]) {
        expect(four.size(value)).toBe(write(four, value).length);
      }
      const strings = codArrayOf(codString, { fixedLength: 2 });
      expect(strings.size(["a", "bc"])).toBe(
        write(strings, ["a", "bc"]).length
      );
    });

    it("round-trips both layouts, advancing the cursor past every item", () => {
      expect(read(four, [2, 4, 5, 6, 7])).toEqual({
        value: [4, 5, 6, 7],
        pos: 5,
      });
      expect(read(four, [3, 3, 5, 1, 7])).toEqual({
        value: [5, 5, 5, 7],
        pos: 5,
      });
    });

    it("does not consume bytes past the final run", () => {
      expect(read(four, [3, 4, 1, 9, 9]).pos).toBe(3);
    });

    it("round-trips an empty array", () => {
      const empty = codArrayOf(codU8, { fixedLength: 0 });

      expect(write(empty, [])).toEqual([2]);
      expect(read(empty, [2])).toEqual({ value: [], pos: 1 });
    });

    it("throws when writing the wrong number of items", () => {
      const cursor = { view: new DataView(new ArrayBuffer(8)), pos: 0 };

      expect(() => {
        four.write(cursor, [1, 2]);
      }).toThrow("Expected length 4, got 2");
    });

    it("throws when the items run past the end of the buffer", () => {
      expect(() => read(four, [2, 1, 2])).toThrow(
        "Array length exceeds remaining bytes"
      );
    });

    it("throws when a run overshoots the fixed length", () => {
      expect(() => read(four, [3, 5, 1])).toThrow(
        "Run length exceeds remaining array length"
      );
    });

    it("throws when the runs run past the end of the buffer", () => {
      expect(() => read(four, [3, 3, 5])).toThrow(RangeError);
    });

    it("throws for the dynamic modes", () => {
      expect(() => read(four, [0, 0, 0, 0, 0])).toThrow(
        "Array mode dynamic is not allowed"
      );
      expect(() => read(four, [1, 0, 0, 0, 0])).toThrow(
        "Array mode rle is not allowed"
      );
    });
  });

  describe("options", () => {
    it("sets the width of the item and run count", () => {
      const narrow = codArrayOf(codU8, { lengthPrecision: "u8" });

      expect(write(narrow, [1])).toEqual([0, 1, 1]);
      expect(write(narrow, [4, 4, 4, 4, 4, 4])).toEqual([1, 1, 6, 4]);
      expect(read(narrow, [1, 1, 6, 4]).value).toEqual([4, 4, 4, 4, 4, 4]);
    });

    it("sets the width of each run length", () => {
      const wide = codArrayOf(codU8, { runPrecision: "u16" });

      expect(write(wide, long)).toEqual([1, 1, 0, 0, 0, 0x2c, 0x01, 1]);
      expect(read(wide, [1, 1, 0, 0, 0, 0x2c, 0x01, 1]).value).toEqual(long);
    });

    it("throws when the run count overflows the length precision", () => {
      const distinct = Array.from({ length: 256 }, (_, i) => i);

      expect(() =>
        write(codArrayOf(codU8, { lengthPrecision: "u8" }), distinct)
      ).toThrow(RangeError);
    });
  });
});

describe("length precision reading", () => {
  it("reads every length-prefixed codec with a custom precision", () => {
    expect(read(codStringOf("u8"), [1, 0x61])).toEqual({ value: "a", pos: 2 });
    expect(
      read(codArrayOf(codU8, { lengthPrecision: "u16" }), [0, 1, 0, 9])
    ).toEqual({ value: [9], pos: 4 });
    expect(read(codEntries(codU8, codU8, "u8"), [1, 1, 2])).toEqual({
      value: [[1, 2]],
      pos: 3,
    });
    expect(read(codRecordOf(codU8, codU8, "u8"), [1, 1, 2])).toEqual({
      value: { 1: 2 },
      pos: 3,
    });
    expect(read(codMapOf(codU8, codU8, "u8"), [1, 1, 2])).toEqual({
      value: new Map([[1, 2]]),
      pos: 3,
    });
  });

  it("throws when a string or array overflows its precision", () => {
    expect(() => write(codStringOf("u8"), "a".repeat(256))).toThrow(RangeError);
    expect(() => write(codMapOf(codU8, codU8, "u8"), bigMap())).toThrow(
      RangeError
    );
  });

  it("throws when entries or records overflow their precision", () => {
    const entries = Array.from({ length: 256 }, (_, i): [number, number] => [
      i,
      i,
    ]);

    expect(() => write(codEntries(codU8, codU8, "u8"), entries)).toThrow(
      RangeError
    );
    expect(() =>
      write(codRecordOf(codU8, codU8, "u8"), Object.fromEntries(entries))
    ).toThrow(RangeError);
  });
});

describe("codEntries reading", () => {
  it("throws when the entries run past the end of the buffer", () => {
    expect(() => read(codEntries(codU8, codU8), [2, 0, 0, 0, 1, 2])).toThrow(
      RangeError
    );
  });
});

const bigMap = () =>
  new Map(Array.from({ length: 256 }, (_, i): [number, number] => [i, i]));
