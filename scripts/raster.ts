// A tiny, dependency-free raster canvas for the library contact sheet:
// z-buffered triangles, depth-tested lines, a 5×7 bitmap font and a PNG
// encoder on Node's own zlib. It draws flat-shaded boards, which is all a
// review sheet needs, and it runs anywhere `npm install` has run.

import { deflateSync } from "node:zlib";

export type RGB = [number, number, number];

/** A screen-space vertex: pixel x/y plus depth (larger = nearer the viewer). */
export interface V {
  x: number;
  y: number;
  z: number;
}

export class Raster {
  readonly w: number;
  readonly h: number;
  private readonly rgb: Uint8Array;
  private readonly depth: Float32Array;

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.rgb = new Uint8Array(w * h * 3);
    this.depth = new Float32Array(w * h).fill(-Infinity);
    this.rect(0, 0, w, h, bg);
  }

  /** Reset the depth buffer, so the next drawing starts in front of everything. */
  clearDepth(): void {
    this.depth.fill(-Infinity);
  }

  private put(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.rgb[i] = c[0];
    this.rgb[i + 1] = c[1];
    this.rgb[i + 2] = c[2];
  }

  /** Solid rectangle, no depth test. */
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.put(xx, yy, c);
  }

  /** 1-px outline, no depth test. */
  frame(x: number, y: number, w: number, h: number, c: RGB): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  /** Filled triangle with a depth test (barycentric, pixel-centre sampling). */
  tri(a: V, b: V, c: V, col: RGB): void {
    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const maxX = Math.min(this.w - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const maxY = Math.min(this.h - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(area) < 1e-9) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area;
        const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * a.z + w1 * b.z + w2 * c.z;
        const i = y * this.w + x;
        if (z <= this.depth[i]) continue;
        this.depth[i] = z;
        this.put(x, y, col);
      }
    }
  }

  /** Convex quad (corners in order) as two triangles. */
  quad(p: V[], col: RGB): void {
    this.tri(p[0], p[1], p[2], col);
    this.tri(p[0], p[2], p[3], col);
  }

  /** Line drawn where it is not hidden behind something nearer (depth bias `bias`). */
  line(a: V, b: V, col: RGB, bias = 0.6): void {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const x = Math.round(a.x + (b.x - a.x) * f);
      const y = Math.round(a.y + (b.y - a.y) * f);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
      const z = a.z + (b.z - a.z) * f;
      if (z + bias < this.depth[y * this.w + x]) continue;
      this.put(x, y, col);
    }
  }

  /** Text in the 5×7 font; lower case and diacritics fold to plain capitals. */
  text(x: number, y: number, s: string, col: RGB, scale = 2): number {
    const clean = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    let cx = Math.round(x);
    for (const ch of clean) {
      const glyph = FONT[ch] ?? FONT["?"];
      for (let row = 0; row < 7; row++) {
        for (let colIx = 0; colIx < 5; colIx++) {
          if (glyph[row][colIx] === "#") this.rect(cx + colIx * scale, y + row * scale, scale, scale, col);
        }
      }
      cx += 6 * scale;
    }
    return cx;
  }

  /** Width in pixels of `s` at `scale`. */
  static textWidth(s: string, scale = 2): number {
    return s.length * 6 * scale;
  }

  /** Copy another raster in at (x, y). */
  blit(src: Raster, x: number, y: number): void {
    for (let yy = 0; yy < src.h; yy++) {
      for (let xx = 0; xx < src.w; xx++) {
        const i = (yy * src.w + xx) * 3;
        this.put(x + xx, y + yy, [src.rgb[i], src.rgb[i + 1], src.rgb[i + 2]]);
      }
    }
  }

  png(): Buffer {
    const raw = Buffer.alloc((this.w * 3 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 3 + 1)] = 0; // filter: none
      Buffer.from(this.rgb.buffer, y * this.w * 3, this.w * 3).copy(raw, y * (this.w * 3 + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // colour type: RGB
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// 5×7 bitmap font, one string per row ('#' = ink).
const G = (...rows: string[]) => rows;
const FONT: Record<string, string[]> = {
  " ": G(".....", ".....", ".....", ".....", ".....", ".....", "....."),
  A: G(".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"),
  B: G("####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."),
  C: G(".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."),
  D: G("###..", "#..#.", "#...#", "#...#", "#...#", "#..#.", "###.."),
  E: G("#####", "#....", "#....", "####.", "#....", "#....", "#####"),
  F: G("#####", "#....", "#....", "####.", "#....", "#....", "#...."),
  G: G(".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"),
  H: G("#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"),
  I: G(".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."),
  J: G("..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."),
  K: G("#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"),
  L: G("#....", "#....", "#....", "#....", "#....", "#....", "#####"),
  M: G("#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"),
  N: G("#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"),
  O: G(".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
  P: G("####.", "#...#", "#...#", "####.", "#....", "#....", "#...."),
  Q: G(".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"),
  R: G("####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"),
  S: G(".####", "#....", "#....", ".###.", "....#", "....#", "####."),
  T: G("#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."),
  U: G("#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
  V: G("#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."),
  W: G("#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."),
  X: G("#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"),
  Y: G("#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."),
  Z: G("#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"),
  "0": G(".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."),
  "1": G("..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."),
  "2": G(".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"),
  "3": G("#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."),
  "4": G("...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."),
  "5": G("#####", "#....", "####.", "....#", "....#", "#...#", ".###."),
  "6": G("..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."),
  "7": G("#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."),
  "8": G(".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."),
  "9": G(".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."),
  ".": G(".....", ".....", ".....", ".....", ".....", ".##..", ".##.."),
  ",": G(".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."),
  ":": G(".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."),
  ";": G(".....", ".##..", ".##..", ".....", ".##..", "..#..", ".#..."),
  "-": G(".....", ".....", ".....", "#####", ".....", ".....", "....."),
  "+": G(".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."),
  "/": G(".....", "....#", "...#.", "..#..", ".#...", "#....", "....."),
  "(": G("...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."),
  ")": G(".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."),
  "%": G("##...", "##..#", "...#.", "..#..", ".#...", "#..##", "...##"),
  "#": G(".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."),
  "=": G(".....", ".....", "#####", ".....", "#####", ".....", "....."),
  "!": G("..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."),
  "?": G(".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."),
  "×": G(".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "....."),
  _: G(".....", ".....", ".....", ".....", ".....", ".....", "#####"),
  "'": G("..#..", "..#..", ".#...", ".....", ".....", ".....", "....."),
  "*": G(".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."),
  "&": G(".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"),
  ">": G(".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."),
  "<": G("...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."),
  "·": G(".....", ".....", ".....", "..#..", ".....", ".....", "....."),
  "–": G(".....", ".....", ".....", "#####", ".....", ".....", "....."),
};
