// Value noise ported from reference/prototype.html, with a seed offset.

export const hash2 = (x: number, y: number, s: number): number => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

const smooth = (t: number) => t * t * (3 - 2 * t);

export const smoothstep = (a: number, b: number, x: number) =>
  smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

export function valueNoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

const fbm = (x: number, y: number, s: number) =>
  valueNoise(x, y, s) * 0.55 + valueNoise(x * 2, y * 2, s + 1) * 0.3 + valueNoise(x * 4, y * 4, s + 2) * 0.15;

/** Forest and hill fields at a point in cell coordinates. */
export function terrainFields(x: number, y: number, seed: number, mapSize: number, open: [number, number]): [number, number] {
  const c = mapSize / 2;
  const clear = smoothstep(open[0], open[1], Math.hypot(x - c, y - c));
  const bump = (cx: number, cy: number, r: number) => Math.max(0, 1 - Math.hypot(x - cx, y - cy) / r);
  const forest = (fbm(x * 0.13, y * 0.13, 3 + seed) * 0.8 + bump(14, 15, 7) * 0.45) * clear;
  const hill = (fbm(x * 0.11, y * 0.11, 9 + seed) * 0.8 + bump(26, 25, 6) * 0.5) * clear;
  return [forest, hill];
}
