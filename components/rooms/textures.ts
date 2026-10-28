"use client";

// Procedural surface textures for the library room scenes. Everything is drawn
// on a <canvas> at runtime — no image assets to ship, license or wait for — and
// cached per module, so a page of cards draws each texture once. (Each WebGL
// context still uploads its own copy; that is the cheap part.)

import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

/** Small deterministic RNG, so a texture looks the same on every load. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(
  key: string,
  size: [number, number],
  repeat: [number, number],
  draw: (g: CanvasRenderingContext2D, w: number, h: number, r: () => number) => void,
): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const [w, h] = size;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) | 0;
  draw(g, w, h, rng(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/** Light or darken a #rrggbb by `amt` (-1…1). */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

/** Floor plane size every room uses (cm) — textures repeat across it. */
export const FLOOR_CM = 1200;

/** Wood planks running along z (towards the camera). One tile = 160 cm. */
export function planks(base: string, opts: { width?: number; gap?: string; key?: string } = {}) {
  const tileCm = 160;
  const plankCm = opts.width ?? 20;
  return make(
    `planks:${base}:${plankCm}:${opts.gap ?? ""}:${opts.key ?? ""}`,
    [1024, 1024],
    [FLOOR_CM / tileCm, FLOOR_CM / tileCm],
    (g, w, h, r) => {
      const px = (cm: number) => (cm / tileCm) * w;
      // Whole planks per tile, so the pattern repeats without a seam.
      const cols = Math.round(tileCm / plankCm);
      const pw = tileCm / cols;
      for (let c = 0; c < cols; c++) {
        let y = -px(r() * 120);
        while (y < h) {
          const len = px(90 + r() * 110);
          const x0 = px(c * pw);
          g.fillStyle = shade(base, (r() - 0.5) * 0.16);
          g.fillRect(x0, y, px(pw), len);
          // grain: long, faint, slightly wavy strokes
          for (let k = 0; k < 14; k++) {
            const gx = x0 + r() * px(pw);
            g.strokeStyle = `rgba(${r() < 0.5 ? "60,35,15" : "255,240,220"},${0.04 + r() * 0.06})`;
            g.lineWidth = 1 + r() * 2;
            g.beginPath();
            g.moveTo(gx, y);
            const amp = 2 + r() * 5;
            for (let t = 0; t <= 1; t += 0.1) g.lineTo(gx + Math.sin(t * 6 + k) * amp, y + t * len);
            g.stroke();
          }
          // joint
          g.fillStyle = opts.gap ?? "rgba(40,25,10,0.35)";
          g.fillRect(x0, y, px(pw), 2);
          y += len;
        }
        g.fillStyle = opts.gap ?? "rgba(40,25,10,0.35)";
        g.fillRect(px(c * pw), 0, opts.gap ? px(1) : 2, h);
      }
    },
  );
}

/** Square tiles, optionally a two-colour checkerboard. One tile = 2×2 tiles. */
export function tiles(a: string, b: string, tileCm = 30, grout = "#cfc8bc") {
  return make(`tiles:${a}:${b}:${tileCm}:${grout}`, [512, 512], [FLOOR_CM / (tileCm * 2), FLOOR_CM / (tileCm * 2)], (g, w, h, r) => {
    const s = w / 2;
    g.fillStyle = grout;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = shade((i + j) % 2 ? b : a, (r() - 0.5) * 0.06);
        g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
        for (let k = 0; k < 120; k++) {
          g.fillStyle = `rgba(0,0,0,${r() * 0.04})`;
          g.fillRect(i * s + r() * s, j * s + r() * s, 3, 3);
        }
      }
  });
}

/** Polished concrete: soft cloudy blotches. */
export function concrete(base: string) {
  return make(`concrete:${base}`, [1024, 1024], [FLOOR_CM / 300, FLOOR_CM / 300], (g, w, h, r) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 260; k++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 140;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() < 0.5;
      grd.addColorStop(0, dark ? `rgba(0,0,0,${r() * 0.05})` : `rgba(255,255,255,${r() * 0.06})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let k = 0; k < 3000; k++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
      g.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
  });
}

/** Running-bond brick wall. One tile = 120 × 120 cm; the wall is 1200 × 300. */
export function bricks(base: string, mortar = "#d8d0c4") {
  return make(`bricks:${base}`, [1024, 1024], [10, 2.5], (g, w, h, r) => {
    const px = w / 120;
    g.fillStyle = mortar;
    g.fillRect(0, 0, w, h);
    const bh = 6.5, bw = 21.5, j = 1.0;
    let row = 0;
    for (let y = 0; y < 120; y += bh + j, row++) {
      for (let x = row % 2 ? -bw / 2 : 0; x < 120; x += bw + j) {
        g.fillStyle = shade(base, (r() - 0.5) * 0.28);
        g.fillRect(x * px, y * px, bw * px, bh * px);
        for (let k = 0; k < 6; k++) {
          g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${r() * 0.08})`;
          g.fillRect((x + r() * bw) * px, (y + r() * bh) * px, 4 + r() * 10, 2 + r() * 5);
        }
      }
    }
  });
}

/** Barely-there plaster grain, multiplied over a wall colour. */
export function plaster(repeat = 4) {
  return make(`plaster:${repeat}`, [512, 512], [repeat * 3, repeat], (g, w, h, r) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 9000; k++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.035})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

/** Woven rug: a field colour, a border and a simple repeating motif. */
export function rug(field: string, border: string, motif: string, style: "stripes" | "diamonds" | "border" = "border") {
  return make(`rug:${field}:${border}:${motif}:${style}`, [512, 512], [1, 1], (g, w, h, r) => {
    g.fillStyle = field;
    g.fillRect(0, 0, w, h);
    if (style === "stripes") {
      for (let y = 30; y < h; y += 52) {
        g.fillStyle = r() < 0.5 ? motif : border;
        g.fillRect(0, y, w, 6);
      }
    } else if (style === "diamonds") {
      g.strokeStyle = motif;
      g.lineWidth = 3;
      for (let x = -w; x < w * 2; x += 72) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + h, h);
        g.moveTo(x, h);
        g.lineTo(x + h, 0);
        g.stroke();
      }
    }
    g.lineWidth = 22;
    g.strokeStyle = border;
    g.strokeRect(24, 24, w - 48, h - 48);
    g.lineWidth = 4;
    g.strokeStyle = motif;
    g.strokeRect(50, 50, w - 100, h - 100);
    // woven speckle
    for (let k = 0; k < 6000; k++) {
      g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${r() * 0.07})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

/** An abstract print for a framed picture — arches, suns and blocks. */
export function artwork(seed: string, palette: string[]) {
  return make(`art:${seed}:${palette.join()}`, [512, 640], [1, 1], (g, w, h, r) => {
    g.fillStyle = palette[0];
    g.fillRect(0, 0, w, h);
    const pick = () => palette[1 + Math.floor(r() * (palette.length - 1))];
    const kind = Math.floor(r() * 3);
    if (kind === 0) {
      // arch + sun
      g.fillStyle = pick();
      g.beginPath();
      g.arc(w / 2, h * 0.62, w * 0.3, Math.PI, 0);
      g.lineTo(w * 0.8, h * 0.88);
      g.lineTo(w * 0.2, h * 0.88);
      g.fill();
      g.fillStyle = pick();
      g.beginPath();
      g.arc(w * 0.68, h * 0.28, w * 0.12, 0, Math.PI * 2);
      g.fill();
    } else if (kind === 1) {
      // stacked blocks
      for (let i = 0; i < 4; i++) {
        g.fillStyle = pick();
        g.fillRect(w * (0.15 + r() * 0.3), h * (0.12 + i * 0.19), w * (0.3 + r() * 0.3), h * 0.15);
      }
    } else {
      // overlapping circles
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = 0.85;
        g.fillStyle = pick();
        g.beginPath();
        g.arc(w * (0.3 + r() * 0.4), h * (0.3 + r() * 0.4), w * (0.18 + r() * 0.12), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    for (let k = 0; k < 2500; k++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.04})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

/** Soft vertical gradient (sky, TV glow). */
export function gradient(key: string, top: string, bottom: string) {
  return make(`grad:${key}:${top}:${bottom}`, [8, 256], [1, 1], (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, top);
    grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}
