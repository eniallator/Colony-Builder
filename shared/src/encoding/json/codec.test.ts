import { describe, expect, it } from "vitest";

import {
  jsonArrayOf,
  jsonBoolean,
  jsonNumber,
  jsonObjectOf,
  jsonOptional,
  jsonString,
  type JsonCodec,
} from "./codec.ts";

const roundTrip = <T>(codec: JsonCodec<T>, value: T) =>
  codec.read(JSON.parse(JSON.stringify(codec.write(value))));

describe("primitives", () => {
  it("round trip", () => {
    expect(roundTrip(jsonString, "hi")).toBe("hi");
    expect(roundTrip(jsonNumber, 1.5)).toBe(1.5);
    expect(roundTrip(jsonBoolean, false)).toBe(false);
  });

  it("reject the wrong type", () => {
    expect(() => jsonString.read(1)).toThrow("Expected a string");
    expect(() => jsonNumber.read("1")).toThrow("Expected a number");
    expect(() => jsonBoolean.read(0)).toThrow("Expected a boolean");
  });
});

describe("jsonOptional", () => {
  const codec = jsonOptional(jsonNumber);

  it("keeps a value", () => {
    expect(codec.write(3)).toBe(3);
    expect(codec.read(3)).toBe(3);
  });

  it("maps undefined and null to undefined", () => {
    expect(codec.write(undefined)).toBeUndefined();
    expect(codec.read(undefined)).toBeUndefined();
    expect(codec.read(null)).toBeUndefined();
  });
});

describe("jsonArrayOf", () => {
  const codec = jsonArrayOf(jsonNumber);

  it("round trips", () => {
    expect(roundTrip(codec, [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("rejects a non-array and a bad item", () => {
    expect(() => codec.read({})).toThrow("Expected an array");
    expect(() => codec.read([1, "2"])).toThrow("Expected a number");
  });
});

describe("jsonObjectOf", () => {
  const codec = jsonObjectOf<{ name: string; age: number | undefined }>({
    name: jsonString,
    age: jsonOptional(jsonNumber),
  });

  it("writes fields by name", () => {
    expect(codec.write({ name: "a", age: 2 })).toEqual({ name: "a", age: 2 });
  });

  it("round trips and omits absent optional fields", () => {
    expect(roundTrip(codec, { name: "a", age: 2 })).toEqual({
      name: "a",
      age: 2,
    });
    expect(JSON.stringify(codec.write({ name: "a", age: undefined }))).toBe(
      '{"name":"a"}'
    );
    expect(roundTrip(codec, { name: "a", age: undefined })).toEqual({
      name: "a",
    });
  });

  it("rejects non-objects and bad fields", () => {
    for (const json of [null, [], "x", 1]) {
      expect(() => codec.read(json)).toThrow("Expected an object");
    }
    expect(() => codec.read({ name: 1 })).toThrow("Expected a string");
  });
});
