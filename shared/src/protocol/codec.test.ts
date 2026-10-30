import { describe, expect, it } from "vitest";

import {
  codBoolean,
  codF32,
  codMap,
  codString,
  codTagged,
  codU8,
  codU32,
  type Codec,
} from "./codec.ts";

const write = <T>(codec: Codec<T>, value: T) => {
  const buffer = new ArrayBuffer(codec.size(value));
  codec.write({ view: new DataView(buffer), pos: 0 }, value);
  return [...new Uint8Array(buffer)];
};

const read = <T>(codec: Codec<T>, bytes: number[]) => {
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
