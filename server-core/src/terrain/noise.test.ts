import { describe, expect, it } from "vitest";

import { fbm, seededNoise, type FbmOptions } from "./noise.ts";

const OPTIONS: FbmOptions = {
  scale: 0.05,
  octaves: 4,
  lacunarity: 2,
  persistence: 0.5,
};

describe("seededNoise", () => {
  it("is deterministic for the same seed and name", () => {
    const a = seededNoise("seed", "name");
    const b = seededNoise("seed", "name");

    expect(a(1.5, 2.5, 3)).toBe(b(1.5, 2.5, 3));
  });

  it("differs between seeds", () => {
    const a = seededNoise("seed-a", "name");
    const b = seededNoise("seed-b", "name");

    expect(a(1.5, 2.5, 3)).not.toBe(b(1.5, 2.5, 3));
  });

  it("differs between names for the same seed", () => {
    const a = seededNoise("seed", "first");
    const b = seededNoise("seed", "second");

    expect(a(1.5, 2.5, 3)).not.toBe(b(1.5, 2.5, 3));
  });
});

describe("fbm", () => {
  it("stays within [-1, 1]", () => {
    const noise = seededNoise("seed", "bounds");

    for (let x = -300; x < 300; x += 7) {
      for (let y = -300; y < 300; y += 7) {
        expect(Math.abs(fbm(noise, x, y, OPTIONS))).toBeLessThanOrEqual(1);
      }
    }
  });

  it("with one octave is the raw noise at the scaled position", () => {
    const noise = seededNoise("seed", "single");
    const options = { ...OPTIONS, octaves: 1 };

    expect(fbm(noise, 10, 20, options)).toBe(
      noise(10 * options.scale, 20 * options.scale, 0)
    );
  });

  it("scales octave frequency by lacunarity and amplitude by persistence", () => {
    const noise = seededNoise("seed", "octaves");
    const options: FbmOptions = {
      scale: 0.1,
      octaves: 2,
      lacunarity: 3,
      persistence: 0.25,
    };

    const expected =
      (noise(10 * 0.1, 20 * 0.1, 0) + noise(10 * 0.3, 20 * 0.3, 1) * 0.25) /
      1.25;

    expect(fbm(noise, 10, 20, options)).toBeCloseTo(expected, 12);
  });
});
