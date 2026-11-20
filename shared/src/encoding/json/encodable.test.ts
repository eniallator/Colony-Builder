import { isNumber, isString } from "deep-guards";
import { describe, expect, it } from "vitest";

import { jsonArrayOf, jsonNumber, jsonString } from "./codec.ts";
import { jsonEncodable } from "./encodable.ts";

const text = jsonEncodable(isString, jsonString);
const numbers = jsonEncodable(
  (value): value is number[] =>
    Array.isArray(value) && value.every(item => isNumber(item)),
  jsonArrayOf(jsonNumber)
);

describe("jsonEncodable", () => {
  it("encodes to JSON text", () => {
    expect(text.encode("hi")).toBe('"hi"');
    expect(numbers.encode([1, 2])).toBe("[1,2]");
  });

  it("decodes what it encoded", () => {
    expect(text.decode(text.encode("hi"))).toBe("hi");
    expect(numbers.decode("[1,2]")).toEqual([1, 2]);
  });

  it("decodes to undefined for invalid JSON", () => {
    expect(text.decode("{")).toBeUndefined();
  });

  it("decodes to undefined when the codec rejects the shape", () => {
    expect(numbers.decode('["a"]')).toBeUndefined();
  });

  it("decodes to undefined when the guard rejects the value", () => {
    const evens = jsonEncodable(
      (value): value is number => isNumber(value) && value % 2 === 0,
      jsonNumber
    );

    expect(evens.decode("3")).toBeUndefined();
    expect(evens.decode("4")).toBe(4);
  });
});
