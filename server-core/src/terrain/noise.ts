import alea from "alea";
import { createNoise3D, type NoiseFunction3D } from "simplex-noise";

export interface FbmOptions {
  scale: number;
  octaves: number;
  lacunarity: number;
  persistence: number;
}

export const seededNoise = (seed: string, name: string): NoiseFunction3D =>
  createNoise3D(alea(`${seed}:${name}`));

/**
 * Fractal Brownian motion: sums octaves of noise, each on its own z slice.
 * The result is normalised by the total amplitude, so it stays within [-1, 1].
 */
export const fbm = (
  noise3D: NoiseFunction3D,
  x: number,
  y: number,
  { scale, octaves, lacunarity, persistence }: FbmOptions
): number => {
  let sum = 0;
  let totalAmplitude = 0;
  for (let i = 0; i < octaves; i++) {
    const frequency = scale * lacunarity ** i;
    const amplitude = persistence ** i;
    sum += noise3D(x * frequency, y * frequency, i) * amplitude;
    totalAmplitude += amplitude;
  }
  return sum / totalAmplitude;
};
