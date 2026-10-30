import { type Tagged, type Untag } from "niall-utils/core";

export interface Cursor {
  view: DataView;
  pos: number;
}

/** Fixed-layout binary codec. All multi-byte values are little-endian. */
export interface Codec<T> {
  // Method syntax keeps `T` bivariant, so an `object` codec (required keys that may be
  // `undefined`) is assignable to a guard's type (optional keys).
  size(value: T): number;
  write(cursor: Cursor, value: T): void;
  read(cursor: Cursor): T;
}

// oxlint-disable-next-line typescript/no-explicit-any
export type CodecType<C extends Codec<any>> =
  C extends Codec<infer T> ? T : never;

export const mapCodec = <const A, const B>(
  codec: Codec<B>,
  encode: (value: A) => B,
  decode: (value: B) => A
): Codec<A> => ({
  size: value => codec.size(encode(value)),
  write: (cursor, value) => {
    codec.write(cursor, encode(value));
  },
  read: cursor => decode(codec.read(cursor)),
});

export const taggedCodec = <T extends Tagged<unknown, string>>(
  codec: Codec<Untag<T>>
): Codec<T> => codec as Codec<T>;

const LITTLE_ENDIAN = true;

const fixed = (
  bytes: number,
  write: (view: DataView, pos: number, value: number) => void,
  read: (view: DataView, pos: number) => number
): Codec<number> => ({
  size: () => bytes,
  write: (cursor, value) => {
    write(cursor.view, cursor.pos, value);
    cursor.pos += bytes;
  },
  read: cursor => {
    const value = read(cursor.view, cursor.pos);
    cursor.pos += bytes;
    return value;
  },
});

export const u8 = fixed(
  1,
  (view, pos, value) => {
    view.setUint8(pos, value);
  },
  (view, pos) => view.getUint8(pos)
);

export const u32 = fixed(
  4,
  (view, pos, value) => {
    view.setUint32(pos, value, LITTLE_ENDIAN);
  },
  (view, pos) => view.getUint32(pos, LITTLE_ENDIAN)
);

export const f32 = fixed(
  4,
  (view, pos, value) => {
    view.setFloat32(pos, value, LITTLE_ENDIAN);
  },
  (view, pos) => view.getFloat32(pos, LITTLE_ENDIAN)
);

export const bool = mapCodec<boolean, number>(u8, Number, v => !!v);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/** A u32 byte length followed by the UTF-8 bytes. */
export const utf8: Codec<string> = {
  size: value => u32.size(0) + textEncoder.encode(value).length,
  write: (cursor, value) => {
    const bytes = textEncoder.encode(value);
    u32.write(cursor, bytes.length);
    new Uint8Array(cursor.view.buffer, cursor.view.byteOffset + cursor.pos).set(
      bytes
    );
    cursor.pos += bytes.length;
  },
  read: cursor => {
    const length = u32.read(cursor);
    if (length > cursor.view.byteLength - cursor.pos) {
      throw new RangeError("String length exceeds remaining bytes");
    }
    const bytes = new Uint8Array(
      cursor.view.buffer,
      cursor.view.byteOffset + cursor.pos,
      length
    );
    cursor.pos += length;
    return textDecoder.decode(bytes);
  },
};
