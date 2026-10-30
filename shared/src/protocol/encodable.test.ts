import { isNumber, isString } from "deep-guards";
import { describe, expect, it } from "vitest";

import { codString, codU8 } from "./codec.ts";
import {
  encArrayOf,
  encExact,
  encObjectOf,
  encodable,
  encOneOf,
  encOptional,
  encTupleOf,
  encUnionOf,
} from "./encodable.ts";

const byte = encodable(isNumber, codU8);
const text = encodable(isString, codString);

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
    const small = encodable((v): v is number => isNumber(v) && v < 10, codU8);

    expect(small.decode(Uint8Array.of(9))).toBe(9);
    expect(small.decode(Uint8Array.of(10))).toBeUndefined();
  });

  it("uses the identity as the default create", () => {
    expect(byte.create(5)).toBe(5);
  });

  it("uses a custom create when given", () => {
    const doubled = encodable(isNumber, codU8, (n: number) => n * 2);

    expect(doubled.create(5)).toBe(10);
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
  const colour = encOneOf("red", "green", "blue");

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

  it("prefixes the items with a u32 length", () => {
    expect(bytesArray.encode([5, 6])).toEqual(Uint8Array.of(2, 0, 0, 0, 5, 6));
    expect(bytesArray.encode([])).toEqual(Uint8Array.of(0, 0, 0, 0));
  });

  it("round-trips", () => {
    expect(bytesArray.decode(bytesArray.encode([1, 2, 3]))).toEqual([1, 2, 3]);
    expect(bytesArray.decode(bytesArray.encode([]))).toEqual([]);
  });

  it("returns undefined when the length exceeds the remaining bytes", () => {
    expect(
      bytesArray.decode(Uint8Array.of(255, 255, 255, 255, 1))
    ).toBeUndefined();
  });

  it("guards every item", () => {
    expect(bytesArray.guard([1, 2])).toBe(true);
    expect(bytesArray.guard([1, "2"])).toBe(false);
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

  it("uses the custom create when given", () => {
    const wrapped = encObjectOf({ id: byte }, (id: number) => ({ id }));

    expect(wrapped.create(4)).toEqual({ id: 4 });
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
    const first = encUnionOf(byte, encodable(isNumber, codU8));

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
