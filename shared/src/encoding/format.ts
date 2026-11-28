import type { Guard } from "deep-guards";

/**
 * Writes a `T` and reads it back. `read` takes a `Source`, and `write` takes a
 * `Sink` ahead of the value and returns `Written`.
 */
export interface Codec<T, Source, Sink extends unknown[], Written> {
  write(...args: [...sink: Sink, value: T]): Written;
  read(source: Source): T;
}

/** A guard, a codec, and the conversion of a value to and from the wire. */
export interface Encodable<
  T,
  C extends Codec<unknown, never, unknown[], unknown>,
  Encoded,
  Decodable = Encoded,
> {
  guard: Guard<T>;
  codec: C;
  encode: (value: T) => Encoded;
  /** `Decodable` may be wider than what `encode` produces. */
  decode: (encoded: Decodable) => T | undefined;
}
