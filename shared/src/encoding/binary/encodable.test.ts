import { isNumber, isString } from "deep-guards";
import { unsafeTag, type Tagged } from "niall-utils/core";
import { describe, expect, it } from "vitest";

import { codStringOf, codU8 } from "./codec.ts";
import {
  binaryEncodable,
  encArrayOf,
  encExact,
  encNumber,
  encObjectOf,
  encOneOf,
  encOptional,
  encRecordOf,
  encSetOf,
  encTagged,
  encTransform,
  encTupleOf,
  encUnionOf,
  isIntegerIn,
} from "./encodable.ts";

const byte = binaryEncodable(isNumber, codU8);
const text = binaryEncodable(isString, codStringOf());

describe("encodable", () => {
  it("encodes and decodes through the codec", () => {
    expect(byte.encode(42)).toEqual(Uint8Array.of(42));
    expect(byte.decode(Uint8Array.of(42))).toBe(42);
  });

  it("decodes from a view with a byte offset", () => {
    expect(byte.decode(Uint8Array.of(1, 2, 3).subarray(1, 2))).toBe(2);
  });

  it("returns undefined when bytes are left over", () => {
    expect(byte.decode(Uint8Array.of(1, 2))).toBeUndefined();
  });

  it("returns undefined when the bytes run out", () => {
    expect(byte.decode(Uint8Array.of())).toBeUndefined();
  });

  it("returns undefined when the decoded value fails the guard", () => {
    const small = binaryEncodable(
      (v): v is number => isNumber(v) && v < 10,
      codU8
    );

    expect(small.decode(Uint8Array.of(9))).toBe(9);
    expect(small.decode(Uint8Array.of(10))).toBeUndefined();
  });

  it("exposes the guard and codec it was built from", () => {
    expect(byte.guard).toBe(isNumber);
    expect(byte.codec).toBe(codU8);
  });
});

describe("encNumber", () => {
  it("encodes with the named number codec", () => {
    expect(encNumber("u8").encode(7)).toEqual(Uint8Array.of(7));
    expect(encNumber("u16").encode(0x0102)).toEqual(Uint8Array.of(2, 1));
    expect(encNumber("u16").decode(Uint8Array.of(2, 1))).toBe(0x0102);
  });

  it.each(["f16", "f32", "f64"] as const)(
    "only accepts finite numbers for %s",
    tpe => {
      const { guard } = encNumber(tpe);

      expect(guard(-1.5)).toBe(true);
      expect(guard("1.5")).toBe(false);
      expect(guard(Number.NaN)).toBe(false);
      expect(guard(Infinity)).toBe(false);
      expect(guard(-Infinity)).toBe(false);
    }
  );

  it.each([
    ["u8", 0, 2 ** 8 - 1],
    ["u16", 0, 2 ** 16 - 1],
    ["u32", 0, 2 ** 32 - 1],
    ["i8", -(2 ** 7), 2 ** 7 - 1],
    ["i16", -(2 ** 15), 2 ** 15 - 1],
    ["i32", -(2 ** 31), 2 ** 31 - 1],
  ] as const)(
    "only accepts integers within the range of %s",
    (tpe, min, max) => {
      const { guard } = encNumber(tpe);

      expect(guard(min)).toBe(true);
      expect(guard(max)).toBe(true);
      expect(guard(min - 1)).toBe(false);
      expect(guard(max + 1)).toBe(false);
      expect(guard(min + 0.5)).toBe(false);
      expect(guard(Number.NaN)).toBe(false);
      expect(guard(String(min))).toBe(false);
    }
  );

  it("only accepts integers up to the largest value for uChoose", () => {
    const { guard } = encNumber("uChoose", 1000);

    expect(guard(0)).toBe(true);
    expect(guard(1000)).toBe(true);
    expect(guard(1001)).toBe(false);
    expect(guard(-1)).toBe(false);
    expect(guard(1.5)).toBe(false);
  });

  it("chooses the narrowest unsigned width that fits the largest value", () => {
    expect(encNumber("uChoose", 255).encode(1)).toHaveLength(1);
    expect(encNumber("uChoose", 256).encode(1)).toHaveLength(2);
    expect(encNumber("uChoose", 65536).encode(1)).toHaveLength(4);
  });
});

describe("encTransform", () => {
  // Counts from 1, stored from 0.
  const positive = encTransform(
    encNumber("u8"),
    isIntegerIn(1, 256),
    stored => stored + 1,
    value => value - 1
  );

  it("converts a value before it is written with the wrapped codec", () => {
    expect(positive.encode(1)).toEqual(Uint8Array.of(0));
    expect(positive.encode(5)).toEqual(Uint8Array.of(4));
  });

  it("converts what the wrapped codec reads back", () => {
    expect(positive.decode(Uint8Array.of(4))).toBe(5);
  });

  it("returns undefined when the bytes cannot be decoded", () => {
    expect(positive.decode(Uint8Array.of())).toBeUndefined();
    expect(positive.decode(Uint8Array.of(1, 2))).toBeUndefined();
  });

  it("guards with the given guard", () => {
    expect(positive.guard(1)).toBe(true);
    expect(positive.guard(256)).toBe(true);
    expect(positive.guard(0)).toBe(false);
    expect(positive.guard(257)).toBe(false);
    expect(positive.guard("2")).toBe(false);
    expect(positive.guard(2n)).toBe(false);
  });

  it("converts the same way inside other encodables", () => {
    const counted = encObjectOf({ count: positive });

    expect(counted.encode({ count: 5 })).toEqual(Uint8Array.of(4));
    expect(counted.decode(Uint8Array.of(4))).toEqual({ count: 5 });
  });
});

describe("encTagged", () => {
  const id = encTagged<Tagged<number, "Id">>(encNumber("u16"));

  it("keeps the guard and codec of the encodable it wraps", () => {
    const inner = encNumber("u16");

    expect(id.encode(unsafeTag<Tagged<number, "Id">>()(0x0102))).toEqual(
      inner.encode(0x0102)
    );
    expect(id.guard(0x0102)).toBe(true);
    expect(id.guard(-1)).toBe(false);
  });
});

describe("encExact", () => {
  const tag = encExact("tag");

  it("occupies no bytes", () => {
    expect(tag.encode("tag")).toEqual(Uint8Array.of());
    expect(tag.decode(Uint8Array.of())).toBe("tag");
  });

  it("only accepts its own value", () => {
    expect(tag.guard("tag")).toBe(true);
    expect(tag.guard("other")).toBe(false);
  });

  it("returns undefined when given bytes", () => {
    expect(tag.decode(Uint8Array.of(0))).toBeUndefined();
  });
});

describe("encOneOf", () => {
  const colour = encOneOf(["red", "green", "blue"]);

  it("encodes as the index of the value", () => {
    expect(colour.encode("red")).toEqual(Uint8Array.of(0));
    expect(colour.encode("blue")).toEqual(Uint8Array.of(2));
  });

  it("decodes an index back into its value", () => {
    expect(colour.decode(Uint8Array.of(1))).toBe("green");
  });

  it("returns undefined for an unknown index", () => {
    expect(colour.decode(Uint8Array.of(3))).toBeUndefined();
  });

  it("guards on the listed values", () => {
    expect(colour.guard("green")).toBe(true);
    expect(colour.guard("pink")).toBe(false);
  });

  it("uses the given precision for the index", () => {
    const wide = encOneOf(["a", "b"], "u16");

    expect(wide.encode("b")).toEqual(Uint8Array.of(1, 0));
    expect(wide.decode(Uint8Array.of(1, 0))).toBe("b");
    expect(wide.decode(Uint8Array.of(1))).toBeUndefined();
  });
});

describe("encTupleOf", () => {
  const pair = encTupleOf(byte, text);

  it("writes each element in order", () => {
    expect(pair.encode([7, "hi"])).toEqual(
      Uint8Array.of(7, 2, 0, 0, 0, 0x68, 0x69)
    );
  });

  it("round-trips", () => {
    expect(pair.decode(pair.encode([7, "hi"]))).toEqual([7, "hi"]);
  });

  it("guards on length and element types", () => {
    expect(pair.guard([1, "a"])).toBe(true);
    expect(pair.guard([1])).toBe(false);
    expect(pair.guard([1, "a", 2])).toBe(false);
    expect(pair.guard(["a", 1])).toBe(false);
    expect(pair.guard("nope")).toBe(false);
  });
});

describe("encOptional", () => {
  const maybeByte = encOptional(byte);

  it("encodes a missing value as a single zero byte", () => {
    expect(maybeByte.encode(undefined)).toEqual(Uint8Array.of(0));
    expect(maybeByte.decode(Uint8Array.of(0))).toBeUndefined();
  });

  it("prefixes a present value with a one byte", () => {
    expect(maybeByte.encode(9)).toEqual(Uint8Array.of(1, 9));
    expect(maybeByte.decode(Uint8Array.of(1, 9))).toBe(9);
  });

  it("guards on undefined or the inner guard", () => {
    expect(maybeByte.guard(undefined)).toBe(true);
    expect(maybeByte.guard(3)).toBe(true);
    expect(maybeByte.guard("x")).toBe(false);
  });
});

describe("encArrayOf", () => {
  const bytesArray = encArrayOf(byte);

  it("round-trips", () => {
    expect(bytesArray.decode(bytesArray.encode([1, 2, 3]))).toEqual([1, 2, 3]);
    expect(bytesArray.decode(bytesArray.encode([4, 4, 4, 4, 4, 4]))).toEqual([
      4, 4, 4, 4, 4, 4,
    ]);
    expect(bytesArray.decode(bytesArray.encode([]))).toEqual([]);
  });

  it("returns undefined when the length exceeds the remaining bytes", () => {
    expect(
      bytesArray.decode(Uint8Array.of(0, 255, 255, 255, 255, 1))
    ).toBeUndefined();
  });

  it("guards every item", () => {
    expect(bytesArray.guard([1, 2])).toBe(true);
    expect(bytesArray.guard([1, "2"])).toBe(false);
  });

  it("passes the precisions on to the codec", () => {
    const wide = encArrayOf(byte, { runPrecision: "u16" });

    expect(wide.encode(Array<number>(300).fill(1))).toEqual(
      Uint8Array.of(1, 1, 0, 0, 0, 0x2c, 0x01, 1)
    );
  });

  describe("with a fixed length", () => {
    const triple = encArrayOf(byte, { fixedLength: 3 });

    it("passes the length on to the codec", () => {
      expect(triple.encode([1, 2, 3])).toEqual(Uint8Array.of(2, 1, 2, 3));
      expect(triple.decode(Uint8Array.of(2, 4, 5, 6))).toEqual([4, 5, 6]);
    });

    it("guards the length and every item", () => {
      expect(triple.guard([1, 2, 3])).toBe(true);
      expect(triple.guard([1, 2])).toBe(false);
      expect(triple.guard([1, 2, 3, 4])).toBe(false);
      expect(triple.guard([1, 2, "3"])).toBe(false);
    });
  });
});

describe("encSetOf", () => {
  const bytes = encSetOf(byte);

  it("round-trips", () => {
    const value = new Set([1, 2, 3]);

    expect(bytes.decode(bytes.encode(value))).toEqual(value);
    expect(bytes.decode(bytes.encode(new Set()))).toEqual(new Set());
  });

  it("guards the set and every item", () => {
    expect(bytes.guard(new Set([1, 2]))).toBe(true);
    expect(bytes.guard(new Set([1, "2"]))).toBe(false);
    expect(bytes.guard([1, 2])).toBe(false);
    expect(bytes.guard(null)).toBe(false);
  });
});

describe("encRecordOf", () => {
  const scores = encRecordOf(text, byte);

  it("prefixes the entries with a u32 count", () => {
    expect(scores.encode({})).toEqual(Uint8Array.of(0, 0, 0, 0));
    expect(scores.encode({ a: 7 })).toEqual(
      Uint8Array.of(1, 0, 0, 0, 1, 0, 0, 0, 0x61, 7)
    );
  });

  it("round-trips", () => {
    const value = { a: 1, bc: 2 };

    expect(scores.decode(scores.encode(value))).toEqual(value);
    expect(scores.decode(scores.encode({}))).toEqual({});
  });

  it("returns undefined when bytes are left over or run out", () => {
    expect(scores.decode(Uint8Array.of(0, 0, 0, 0, 1))).toBeUndefined();
    expect(scores.decode(Uint8Array.of(1, 0, 0, 0, 1))).toBeUndefined();
  });

  it("guards every key and value", () => {
    expect(scores.guard({ a: 1 })).toBe(true);
    expect(scores.guard({ a: "1" })).toBe(false);
    expect(scores.guard("nope")).toBe(false);
    expect(scores.guard(null)).toBe(false);
  });
});

describe("encExactObjectOf", () => {
  const entity = encObjectOf({
    id: byte,
    nickname: encOptional(text),
    tag: encExact("e"),
  });

  it("writes fields in the shape's key order", () => {
    expect(entity.encode({ id: 3, nickname: undefined, tag: "e" })).toEqual(
      Uint8Array.of(3, 0)
    );
    expect(entity.encode({ id: 3, nickname: "a", tag: "e" })).toEqual(
      Uint8Array.of(3, 1, 1, 0, 0, 0, 0x61)
    );
  });

  it("round-trips, omitting undefined fields", () => {
    expect(entity.decode(Uint8Array.of(3, 0))).toEqual({ id: 3, tag: "e" });
    expect("nickname" in (entity.decode(Uint8Array.of(3, 0)) ?? {})).toBe(
      false
    );
    expect(entity.decode(Uint8Array.of(3, 1, 1, 0, 0, 0, 0x61))).toEqual({
      id: 3,
      nickname: "a",
      tag: "e",
    });
  });

  it("guards the fields and rejects unknown keys", () => {
    expect(entity.guard({ id: 1, tag: "e" })).toBe(true);
    expect(entity.guard({ id: "1", tag: "e" })).toBe(false);
    expect(entity.guard({ id: 1, tag: "e", extra: 1 })).toBe(false);
    expect(entity.guard(null)).toBe(false);
  });
});

describe("encUnionOf", () => {
  const either = encUnionOf(byte, text);

  it("prefixes the value with the index of the matching variant", () => {
    expect(either.encode(5)).toEqual(Uint8Array.of(0, 5));
    expect(either.encode("hi")).toEqual(
      Uint8Array.of(1, 2, 0, 0, 0, 0x68, 0x69)
    );
  });

  it("round-trips each variant", () => {
    expect(either.decode(either.encode(5))).toBe(5);
    expect(either.decode(either.encode("hi"))).toBe("hi");
  });

  it("uses the first variant whose guard accepts the value", () => {
    const first = encUnionOf(byte, binaryEncodable(isNumber, codU8));

    expect(first.encode(1)).toEqual(Uint8Array.of(0, 1));
  });

  it("returns undefined for an unknown tag", () => {
    expect(either.decode(Uint8Array.of(2, 0))).toBeUndefined();
  });

  it("guards on any variant", () => {
    expect(either.guard(1)).toBe(true);
    expect(either.guard("a")).toBe(true);
    expect(either.guard(true)).toBe(false);
  });

  it("throws when encoding a value that matches no variant", () => {
    // @ts-expect-error `true` is not a valid variant
    expect(() => either.encode(true)).toThrow("Value matches no union variant");
  });
});
