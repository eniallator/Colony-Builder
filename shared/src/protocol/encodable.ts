import type { Guard } from "deep-guards";
import { attempt } from "niall-utils/core";

// oxlint-disable-next-line typescript/no-explicit-any
export interface Encodable<T, Args extends readonly unknown[] = any> {
  guard: Guard<T>;
  create: (...args: Args) => T;
  encode: (value: T) => string;
  decode: (encoded: string) => T | undefined;
}

export const encodable: {
  <const T, const Args extends readonly unknown[] = [T]>(
    guard: Guard<T>,
    create: (...args: Args) => T,
    encode?: (value: T) => string,
    decode?: (encoded: string) => T | undefined
  ): Encodable<T, Args>;
  <const T>(
    guard: Guard<T>,
    create?: undefined,
    encode?: (value: T) => string,
    decode?: (encoded: string) => T | undefined
  ): Encodable<T, [T]>;
} = <T, Args extends readonly unknown[] = [T]>(
  guard: Guard<T>,
  create?: (...args: Args) => T,
  encode?: (value: T) => string,
  decode?: (encoded: string) => T | undefined
): Encodable<T, Args> => ({
  guard,
  create: create ?? (((value: T) => value) as unknown as (...args: Args) => T),
  encode: encode ?? JSON.stringify,
  decode:
    decode ??
    (encoded => {
      const parsed = attempt((): unknown => JSON.parse(encoded));
      return guard(parsed) ? parsed : undefined;
    }),
});
