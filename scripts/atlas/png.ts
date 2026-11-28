import { crc32, deflateSync } from "node:zlib";

import { byteAt, TILE, type Pixels } from "./core.ts";

const chunk = (type: string, data: Buffer): Buffer => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
};

/** Minimal dependency-free RGBA PNG encoder. */
export const encodePng = (
  width: number,
  height: number,
  rgba: Pixels
): Buffer => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

/** Copies a sprite into `dst`, optionally upscaled; `alpha: "copy"` keeps raw RGBA. */
export const blit = (
  dst: Pixels,
  dstWidth: number,
  sprite: Pixels,
  ox: number,
  oy: number,
  { scale = 1, copy = false }: { scale?: number; copy?: boolean } = {}
): void => {
  const height = sprite.length / (TILE * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < TILE; x++) {
      const from = (y * TILE + x) * 4;
      const a = byteAt(sprite, from + 3) / 255;
      if (a === 0 && !copy) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const to =
            ((oy + y * scale + sy) * dstWidth + ox + x * scale + sx) * 4;
          if (copy) {
            dst.set(sprite.subarray(from, from + 4), to);
            continue;
          }
          for (let c = 0; c < 3; c++) {
            dst[to + c] = Math.round(
              byteAt(sprite, from + c) * a + byteAt(dst, to + c) * (1 - a)
            );
          }
          dst[to + 3] = Math.max(byteAt(dst, to + 3), byteAt(sprite, from + 3));
        }
      }
    }
  }
};
