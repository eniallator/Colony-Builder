import { isBoolean, isNumber, isString, type Guard } from "deep-guards";
import { raise } from "niall-utils/core";
import { typedToEntries } from "niall-utils/data";

import type { Codec, Format } from "../format.ts";

export type JsonFormat = Format<"json", string>;

/** Converts a value to and from the structure `JSON.stringify` / `JSON.parse` use. */
export interface JsonCodec<T> extends Codec<JsonFormat> {
  // Method syntax keeps `T` bivariant, like the binary codecs.
  toJson(value: T): unknown;
  /** Throws if `json` is not the shape this codec produces. */
  fromJson(json: unknown): T;
}

const isJsonObject = (json: unknown): json is Record<string, unknown> =>
  typeof json === "object" && json !== null && !Array.isArray(json);

const jsonPrimitive = <const T extends string | number | boolean>(
  name: string,
  guard: Guard<T>
): JsonCodec<T> => ({
  toJson: value => value,
  fromJson: json =>
    guard(json) ? json : raise(new TypeError(`Expected a ${name}`)),
});

export const jsonString = jsonPrimitive("string", isString);
export const jsonNumber = jsonPrimitive("number", isNumber);
export const jsonBoolean = jsonPrimitive("boolean", isBoolean);

export const jsonOptional = <const T>(
  codec: JsonCodec<T>
): JsonCodec<T | undefined> => ({
  toJson: value => (value === undefined ? undefined : codec.toJson(value)),
  fromJson: json => (json == null ? undefined : codec.fromJson(json)),
});

export const jsonArrayOf = <const T>(codec: JsonCodec<T>): JsonCodec<T[]> => ({
  toJson: values => values.map(value => codec.toJson(value)),
  fromJson: json =>
    Array.isArray(json)
      ? json.map((item: unknown) => codec.fromJson(item))
      : raise(new TypeError("Expected an array")),
});

export const jsonObjectOf = <
  const T extends { [K in keyof T]: unknown },
>(shape: { [K in keyof T]: JsonCodec<T[K]> }): JsonCodec<T> => {
  const fields = typedToEntries(shape);

  return {
    toJson: value =>
      Object.fromEntries(
        fields.map(([key, codec]) => [key, codec.toJson(value[key])])
      ),
    fromJson: json => {
      if (!isJsonObject(json)) raise(new TypeError("Expected an object"));

      const result: Partial<T> = {};
      for (const [key, codec] of fields) {
        const value = codec.fromJson(json[String(key)]);
        if (value !== undefined) result[key] = value;
      }
      return result as T;
    },
  };
};
