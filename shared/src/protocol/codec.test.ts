import { describe, expect, it } from "vitest";

import {
  bool,
  f32,
  mapCodec,
  taggedCodec,
  u8,
  u32,
  utf8,
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

describe("u8", () => {
  it("is one byte wide", () => {
    expect(u8.size(0)).toBe(1);
    expect(write(u8, 0xab)).toEqual([0xab]);
  });

  it("reads a byte and advances the cursor", () => {
    expect(read(u8, [200])).toEqual({ value: 200, pos: 1 });
  });
});

describe("u32", () => {
  it("is four bytes wide, little-endian", () => {
    expect(u32.size(0)).toBe(4);
    expect(write(u32, 0x01020304)).toEqual([4, 3, 2, 1]);
  });

  it("reads little-endian and advances the cursor", () => {
    expect(read(u32, [4, 3, 2, 1])).toEqual({ value: 0x01020304, pos: 4 });
  });

  it("writes consecutive values from the cursor position", () => {
    const cursor = { view: new DataView(new ArrayBuffer(5)), pos: 0 };
    u8.write(cursor, 7);
    u32.write(cursor, 9);

    expect(cursor.pos).toBe(5);
    expect([...new Uint8Array(cursor.view.buffer)]).toEqual([7, 9, 0, 0, 0]);
  });

  it("throws when reading past the end of the buffer", () => {
    expect(() => read(u32, [1, 2])).toThrow(RangeError);
  });
});

describe("f32", () => {
  it("is four bytes wide, little-endian", () => {
    expect(f32.size(0)).toBe(4);
    expect(write(f32, 1)).toEqual([0, 0, 0x80, 0x3f]);
  });

  it("reads little-endian and advances the cursor", () => {
    expect(read(f32, [0, 0, 0xc0, 0x3f])).toEqual({ value: 1.5, pos: 4 });
  });

  it("round-trips non-finite values", () => {
    expect(read(f32, write(f32, Infinity)).value).toBe(Infinity);
    expect(read(f32, write(f32, Number.NaN)).value).toBeNaN();
  });
});

describe("bool", () => {
  it("encodes as a single byte", () => {
    expect(write(bool, true)).toEqual([1]);
    expect(write(bool, false)).toEqual([0]);
  });

  it("reads any non-zero byte as true", () => {
    expect(read(bool, [0]).value).toBe(false);
    expect(read(bool, [1]).value).toBe(true);
    expect(read(bool, [9]).value).toBe(true);
  });
});

describe("mapCodec", () => {
  const doubled = mapCodec<number, number>(
    u8,
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

describe("taggedCodec", () => {
  it("returns the same codec", () => {
    expect(taggedCodec(u32)).toBe(u32);
  });
});

describe("utf8", () => {
  it.each(["", "hello", "héllo wörld", "日本語", "👾"])(
    "round-trips %j",
    text => {
      const bytes = write(utf8, text);

      expect(bytes.length).toBe(utf8.size(text));
      expect(read(utf8, bytes)).toEqual({ value: text, pos: bytes.length });
    }
  );

  it("prefixes the byte length, not the character count", () => {
    expect(write(utf8, "é")).toEqual([2, 0, 0, 0, 0xc3, 0xa9]);
  });

  it("respects the byte offset of the view and the cursor position", () => {
    const buffer = new ArrayBuffer(12);
    const cursor = { view: new DataView(buffer, 2, 8), pos: 1 };
    utf8.write(cursor, "ab");

    expect([...new Uint8Array(buffer)]).toEqual([
      0, 0, 0, 2, 0, 0, 0, 0x61, 0x62, 0, 0, 0,
    ]);
    expect(cursor.pos).toBe(7);
  });

  it("rejects a length longer than the remaining bytes", () => {
    expect(() => read(utf8, [5, 0, 0, 0, 0x61])).toThrow(
      "String length exceeds remaining bytes"
    );
  });

  it("rejects invalid UTF-8", () => {
    expect(() => read(utf8, [1, 0, 0, 0, 0xff])).toThrow(TypeError);
  });
});
