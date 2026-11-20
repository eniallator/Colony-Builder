import type { Guard } from "deep-guards";
import { attempt } from "niall-utils/core";

import type { Encodable } from "../format.ts";
import type { JsonCodec, JsonFormat } from "./codec.ts";

export type JsonEncodable<T> = Encodable<T, JsonFormat, JsonCodec<T>>;

export const jsonEncodable = <const T>(
  guard: Guard<T>,
  codec: JsonCodec<T>
): JsonEncodable<T> => ({
  guard,
  codec,
  encode: value => JSON.stringify(codec.toJson(value)),
  decode: text => {
    const decoded = attempt((): unknown => codec.fromJson(JSON.parse(text)));
    return guard(decoded) ? decoded : undefined;
  },
});
