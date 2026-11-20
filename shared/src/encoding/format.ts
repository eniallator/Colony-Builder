import type { Guard } from "deep-guards";

/**
 * Phantom key that brands codecs and encodables with their format. It has no
 * runtime value, so a codec never needs to set it.
 */
export declare const FORMAT: unique symbol;

/** A wire format: a name that keeps formats apart, and what it encodes to and decodes from. */
export interface Format<
  Name extends string = string,
  Encoded = unknown,
  Decodable = Encoded,
> {
  readonly name: Name;
  /** What encoding a value produces. */
  readonly encoded: Encoded;
  /** What decoding accepts, which may be wider than what encoding produces. */
  readonly decodable: Decodable;
}

export type EncodedOf<F extends Format> = F["encoded"];
export type DecodableOf<F extends Format> = F["decodable"];

/** What every codec has in common. Codecs only compose with the same format. */
export interface Codec<F extends Format> {
  readonly [FORMAT]?: F;
}

/** A guard, a codec of the same format, and the conversion to and from the wire. */
export interface Encodable<T, F extends Format, C extends Codec<F> = Codec<F>> {
  guard: Guard<T>;
  codec: C;
  encode: (value: T) => EncodedOf<F>;
  decode: (encoded: DecodableOf<F>) => T | undefined;
}
