import { isBoolean, isNumber, isString, type Guard } from "deep-guards";
import { raise } from "niall-utils/core";
import { typedToEntries } from "niall-utils/data";

import type { Codec } from "../format.ts";

/**
 * Converts a value to and from the structure `JSON.stringify` / `JSON.parse`
 * use. `read` throws if given a shape `write` doesn't produce.
 */
export type JsonCodec<T> = Codec<T, unknown, [], unknown>;

const isJsonObject = (json: unknown): json is Record<string, unknown> =>
  typeof json === "object" && json !== null && !Array.isArray(json);

const jsonPrimitive = <const T extends string | number | boolean>(
  name: string,
  guard: Guard<T>
): JsonCodec<T> => ({
  write: value => value,
  read: json =>
    guard(json) ? json : raise(new TypeError(`Expected a ${name}`)),
});

export const jsonString = jsonPrimitive("string", isString);
export const jsonNumber = jsonPrimitive("number", isNumber);
export const jsonBoolean = jsonPrimitive("boolean", isBoolean);

export const jsonOptional = <const T>(
  codec: JsonCodec<T>
): JsonCodec<T | undefined> => ({
  write: value => (value === undefined ? undefined : codec.write(value)),
  read: json => (json == null ? undefined : codec.read(json)),
});

export const jsonArrayOf = <const T>(codec: JsonCodec<T>): JsonCodec<T[]> => ({
  write: values => values.map(value => codec.write(value)),
  read: json =>
    Array.isArray(json)
      ? json.map((item: unknown) => codec.read(item))
      : raise(new TypeError("Expected an array")),
});

export const jsonObjectOf = <
  const T extends { [K in keyof T]: unknown },
>(shape: { [K in keyof T]: JsonCodec<T[K]> }): JsonCodec<T> => {
  const fields = typedToEntries(shape);

  return {
    write: value =>
      Object.fromEntries(
        fields.map(([key, codec]) => [key, codec.write(value[key])])
      ),
    read: json => {
      if (!isJsonObject(json)) raise(new TypeError("Expected an object"));

      const result: Partial<T> = {};
      for (const [key, codec] of fields) {
        const value = codec.read(json[String(key)]);
        if (value !== undefined) result[key] = value;
      }
      return result as T;
    },
  };
};
