"use client";

// Furniture-and-decor props for the room scenes. All dimensions are real
// centimetres (the room group is scaled 0.01 into the viewer's metre space),
// so a sofa is a sofa-sized sofa next to whatever the customer designed.

import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { artwork, rug as rugTex } from "./textures";

type V3 = [number, number, number];

const mat = (color: string, roughness = 0.8, metalness = 0) => (
  <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
);

/** Box whose position is its bottom-centre — easier to stand things on the floor. */
export function Block({
  size,
  at,
  color,
  roughness = 0.8,
  metalness = 0,
  shadow = true,
  rotY = 0,
}: {
  size: V3;
  at: V3;
  color: string;
  roughness?: number;
  metalness?: number;
  shadow?: boolean;
  rotY?: number;
}) {
  return (
    <mesh position={[at[0], at[1] + size[1] / 2, at[2]]} rotation={[0, rotY, 0]} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      {mat(color, roughness, metalness)}
    </mesh>
  );
}

/** Soft upholstered block (cushions, mattress) — bottom-centre positioned. */
export function Soft({ size, at, color, radius = 6, rot = [0, 0, 0] }: { size: V3; at: V3; color: string; radius?: number; rot?: V3 }) {
  return (
    <RoundedBox
      args={size}
      radius={Math.min(radius, size[0] / 2.01, size[1] / 2.01, size[2] / 2.01)}
      smoothness={3}
      position={[at[0], at[1] + size[1] / 2, at[2]]}
      rotation={rot}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.95} />
    </RoundedBox>
  );
}

/** Potted plant. `kind` = leafy bush, tall blades (snake plant) or a little tree. */
export function Plant({
  at,
  height = 90,
  pot = "#d9d2c5",
  kind = "bush",
  seed = 1,
}: {
  at: V3;
  height?: number;
  pot?: string;
  kind?: "bush" | "blades" | "tree";
  seed?: number;
}) {
  const potH = Math.max(18, height * 0.28);
  const potR = Math.max(11, height * 0.15);
  const leaves = useMemo(() => {
    const out: { p: V3; s: V3; c: string; r: V3 }[] = [];
    let a = seed * 9301 + 49297;
    const r = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
    const greens = ["#4f6b3a", "#5d7d44", "#3f5a30", "#6b8a4e", "#56733f"];
    if (kind === "blades") {
      for (let i = 0; i < 14; i++) {
        const ang = r() * Math.PI * 2;
        const h = (height - potH) * (0.55 + r() * 0.45);
        const tilt = 0.1 + r() * 0.25;
        out.push({
          p: [Math.cos(ang) * potR * 0.3, potH + h / 2 - 2, Math.sin(ang) * potR * 0.3],
          s: [1, h, 0.28],
          c: greens[i % greens.length],
          r: [Math.sin(ang) * tilt, ang, Math.cos(ang) * tilt],
        });
      }
    } else {
      const crownY = kind === "tree" ? height * 0.72 : potH + (height - potH) * 0.5;
      const spread = kind === "tree" ? height * 0.24 : Math.max(potR * 1.4, (height - potH) * 0.42);
      const n = kind === "tree" ? 16 : 13;
      for (let i = 0; i < n; i++) {
        const ang = r() * Math.PI * 2;
        const rad = r() * spread * 0.75;
        const sz = spread * (0.35 + r() * 0.35);
        out.push({
          p: [Math.cos(ang) * rad, crownY + (r() - 0.5) * spread * 0.9, Math.sin(ang) * rad],
          s: [sz, sz * (0.7 + r() * 0.3), sz],
          c: greens[i % greens.length],
          r: [r(), r() * 3, r()],
        });
      }
    }
    return out;
  }, [height, kind, potH, potR, seed]);

  return (
    <group position={at}>
      <mesh position={[0, potH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[potR, potR * 0.78, potH, 28]} />
        {mat(pot, 0.7)}
      </mesh>
      <mesh position={[0, potH - 1, 0]}>
        <cylinderGeometry args={[potR * 0.92, potR * 0.92, 1, 24]} />
        {mat("#3b2c22", 1)}
      </mesh>
      {kind === "tree" && (
        <mesh position={[0, potH + (height * 0.6 - potH) / 2, 0]} castShadow>
          <cylinderGeometry args={[1.4, 2, height * 0.6 - potH, 8]} />
          {mat("#6b5040", 0.9)}
        </mesh>
      )}
      {leaves.map((l, i) =>
        kind === "blades" ? (
          // A pointed leaf: a thin cone flattened to a blade.
          <mesh key={i} position={l.p} rotation={l.r} scale={[1, 1, l.s[2]]} castShadow>
            <coneGeometry args={[4, l.s[1], 6]} />
            <meshStandardMaterial color={l.c} roughness={0.7} flatShading />
          </mesh>
        ) : (
          <mesh key={i} position={l.p} rotation={l.r} scale={l.s} castShadow>
            <icosahedronGeometry args={[0.5, 1]} />
            <meshStandardMaterial color={l.c} roughness={0.75} flatShading />
          </mesh>
        ),
      )}
    </group>
  );
}

/** Floor lamp with a fabric shade that glows a little. */
export function FloorLamp({ at, height = 160, metal = "#2a2a2a", shade = "#f4ead8" }: { at: V3; height?: number; metal?: string; shade?: string }) {
  return (
    <group position={at}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[14, 15, 2, 32]} />
        {mat(metal, 0.4, 0.6)}
      </mesh>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.9, 0.9, height, 10]} />
        {mat(metal, 0.4, 0.6)}
      </mesh>
      <mesh position={[0, height - 2, 0]} castShadow>
        <cylinderGeometry args={[15, 21, 30, 32, 1, true]} />
        <meshStandardMaterial color={shade} emissive={shade} emissiveIntensity={0.35} roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Table lamp to stand on top of a piece. */
export function TableLamp({ at, base = "#c7b9a3", shade = "#f6efe2" }: { at: V3; base?: string; shade?: string }) {
  return (
    <group position={at}>
      <mesh position={[0, 6, 0]} castShadow>
        <sphereGeometry args={[6, 24, 16]} />
        {mat(base, 0.35)}
      </mesh>
      <mesh position={[0, 15, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 8, 8]} />
        {mat("#b08d57", 0.3, 0.8)}
      </mesh>
      <mesh position={[0, 23, 0]} castShadow>
        <cylinderGeometry args={[6.5, 9.5, 12, 28, 1, true]} />
        <meshStandardMaterial color={shade} emissive={shade} emissiveIntensity={0.4} roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Framed print hung on the back wall; `at` is the picture's centre, against the wall. */
export function Frame({
  at,
  w,
  h,
  seed,
  palette,
  frame = "#2b2b2b",
  mount = true,
}: {
  at: V3;
  w: number;
  h: number;
  seed: string;
  palette: string[];
  frame?: string;
  mount?: boolean;
}) {
  const tex = useMemo(() => artwork(seed, palette), [seed, palette]);
  const m = mount ? Math.min(w, h) * 0.1 : 0;
  return (
    <group position={[at[0], at[1], at[2] + 1.5]}>
      <mesh castShadow>
        <boxGeometry args={[w, h, 3]} />
        {mat(frame, 0.6)}
      </mesh>
      <mesh position={[0, 0, 1.55]}>
        <planeGeometry args={[w - 3, h - 3]} />
        {mat("#f6f3ec", 0.9)}
      </mesh>
      <mesh position={[0, 0, 1.6]}>
        <planeGeometry args={[w - 3 - m * 2, h - 3 - m * 2]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Flat rug lying on the floor; `at` is its centre. */
export function Rug({ at, w, d, field, border, motif, style = "border", round = false }: {
  at: V3; w: number; d: number; field: string; border: string; motif: string;
  style?: "stripes" | "diamonds" | "border"; round?: boolean;
}) {
  const tex = useMemo(() => rugTex(field, border, motif, style), [field, border, motif, style]);
  return round ? (
    <mesh position={[at[0], 0.4, at[2]]} receiveShadow>
      <cylinderGeometry args={[w / 2, w / 2, 0.8, 48]} />
      <meshStandardMaterial color={field} roughness={1} />
    </mesh>
  ) : (
    <mesh position={[at[0], 0.4, at[2]]} receiveShadow>
      <boxGeometry args={[w, 0.8, d]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  );
}

/** Lounge armchair facing +z, rotated by `rotY`. `at` = floor centre. */
export function Armchair({ at, color = "#b9a48a", legs = "#6b4f3a", rotY = 0 }: { at: V3; color?: string; legs?: string; rotY?: number }) {
  return (
    <group position={at} rotation={[0, rotY, 0]}>
      {[[-30, -30], [30, -30], [-30, 30], [30, 30]].map(([x, z], i) => (
        <Block key={i} size={[3, 14, 3]} at={[x, 0, z]} color={legs} />
      ))}
      <Soft size={[78, 22, 78]} at={[0, 14, 0]} color={color} radius={7} />
      <Soft size={[78, 46, 16]} at={[0, 32, -31]} color={color} radius={7} />
      <Soft size={[14, 26, 70]} at={[-32, 32, 3]} color={color} radius={6} />
      <Soft size={[14, 26, 70]} at={[32, 32, 3]} color={color} radius={6} />
      <Soft size={[54, 10, 56]} at={[0, 36, 6]} color={color} radius={4} />
    </group>
  );
}

/** Three-seat sofa against the back wall. `at` = floor centre. */
export function Sofa({ at, w = 220, color = "#8f9a8a", legs = "#3a2f28" }: { at: V3; w?: number; color?: string; legs?: string }) {
  const d = 92;
  const seats = 3;
  const inner = w - 36;
  return (
    <group position={at}>
      {[[-w / 2 + 8, -d / 2 + 8], [w / 2 - 8, -d / 2 + 8], [-w / 2 + 8, d / 2 - 8], [w / 2 - 8, d / 2 - 8]].map(([x, z], i) => (
        <Block key={i} size={[3.5, 10, 3.5]} at={[x, 0, z]} color={legs} />
      ))}
      <Soft size={[w, 26, d]} at={[0, 10, 0]} color={color} radius={6} />
      <Soft size={[w, 46, 20]} at={[0, 30, -d / 2 + 10]} color={color} radius={7} />
      <Soft size={[18, 30, d]} at={[-w / 2 + 9, 30, 0]} color={color} radius={7} />
      <Soft size={[18, 30, d]} at={[w / 2 - 9, 30, 0]} color={color} radius={7} />
      {Array.from({ length: seats }, (_, i) => (
        <Soft
          key={i}
          size={[inner / seats - 2, 13, d - 26]}
          at={[-inner / 2 + (inner / seats) * (i + 0.5), 36, 8]}
          color={color}
          radius={5}
        />
      ))}
      <Soft size={[44, 40, 12]} at={[-inner / 2 + 30, 46, -d / 2 + 26]} color="#e7d8bf" radius={6} rot={[-0.15, 0.2, 0]} />
      <Soft size={[42, 38, 12]} at={[inner / 2 - 30, 46, -d / 2 + 26]} color="#c47e5a" radius={6} rot={[-0.15, -0.2, 0]} />
    </group>
  );
}

/** Double bed with its headboard on the back wall. `at` = floor centre of the head end. */
export function Bed({ at, w = 160, len = 205, frame = "#cbbba5", linen = "#f1ede6", throwColor = "#9aa79a" }: {
  at: V3; w?: number; len?: number; frame?: string; linen?: string; throwColor?: string;
}) {
  return (
    <group position={at}>
      <Soft size={[w + 10, 105, 8]} at={[0, 0, 4]} color={frame} radius={3} />
      <Block size={[w + 6, 26, len]} at={[0, 0, len / 2 + 8]} color={frame} />
      <Soft size={[w, 22, len - 4]} at={[0, 24, len / 2 + 8]} color={linen} radius={6} />
      <Soft size={[w + 4, 8, len * 0.66]} at={[0, 44, len * 0.62]} color={linen} radius={4} />
      <Soft size={[w * 0.44, 14, 38]} at={[-w * 0.24, 46, 34]} color="#ffffff" radius={6} rot={[0.35, 0, 0]} />
      <Soft size={[w * 0.44, 14, 38]} at={[w * 0.24, 46, 34]} color="#ffffff" radius={6} rot={[0.35, 0, 0]} />
      <Soft size={[w + 8, 4, 50]} at={[0, 50, len - 22]} color={throwColor} radius={2} />
    </group>
  );
}

/** Wall-mounted 55" TV; `at` = screen centre on the wall. */
export function TV({ at, w = 123 }: { at: V3; w?: number }) {
  const h = w * 0.575;
  return (
    <group position={[at[0], at[1], at[2] + 2.5]}>
      <mesh castShadow>
        <boxGeometry args={[w, h, 4]} />
        {mat("#141414", 0.4, 0.2)}
      </mesh>
      <mesh position={[0, 0, 2.05]}>
        <planeGeometry args={[w - 2, h - 2]} />
        <meshStandardMaterial color="#1d2229" roughness={0.15} metalness={0.4} />
      </mesh>
    </group>
  );
}

/** Tall floor speaker. */
export function Speaker({ at, h = 95, color = "#2e2a26", rotY = 0 }: { at: V3; h?: number; color?: string; rotY?: number }) {
  return (
    <group position={at} rotation={[0, rotY, 0]}>
      <Block size={[22, h, 26]} at={[0, 0, 0]} color={color} roughness={0.6} />
      {[h * 0.78, h * 0.55].map((y, i) => (
        <mesh key={i} position={[0, y, 13.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[i ? 7.5 : 3.5, i ? 7.5 : 3.5, 0.6, 24]} />
          {mat("#111", 0.5)}
        </mesh>
      ))}
    </group>
  );
}

/** Round mirror on the back wall; `at` = centre. */
export function Mirror({ at, d = 60 }: { at: V3; d?: number }) {
  return (
    <group position={[at[0], at[1], at[2] + 1.2]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[d / 2, d / 2, 2.4, 48]} />
        {mat("#b08d57", 0.3, 0.8)}
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[d / 2 - 2, d / 2 - 2, 0.2, 48]} />
        <meshStandardMaterial color="#c9d3d6" roughness={0.05} metalness={0.6} />
      </mesh>
    </group>
  );
}

/** Wall coat rail with a few hanging coats; `at` = rail centre on the wall. */
export function CoatRail({ at, w = 90, coats = ["#7b6a58", "#3e4a5c", "#b5703f"] }: { at: V3; w?: number; coats?: string[] }) {
  const n = coats.length;
  return (
    <group position={at}>
      <Block size={[w, 9, 2]} at={[0, -4.5, 1]} color="#a07e5c" />
      {coats.map((c, i) => {
        const x = -w / 2 + (w / n) * (i + 0.5);
        return (
          <group key={i}>
            <mesh position={[x, 0, 5]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[1, 1, 7, 8]} />
              {mat("#2b2b2b", 0.4, 0.7)}
            </mesh>
            <Soft size={[36, 92, 12]} at={[x + (i - 1) * 3, -94, 9]} color={c} radius={5} rot={[0.04, (i - 1) * 0.15, 0]} />
          </group>
        );
      })}
    </group>
  );
}

/** Panelled door set in the back wall; `at` = floor centre. */
export function Door({ at, color = "#f1ede4", frame = "#e3ddd1" }: { at: V3; color?: string; frame?: string }) {
  const w = 80, h = 205;
  return (
    <group position={at}>
      <Block size={[w + 12, 6, 3]} at={[0, h, 1.5]} color={frame} />
      <Block size={[6, h, 3]} at={[-w / 2 - 3, 0, 1.5]} color={frame} />
      <Block size={[6, h, 3]} at={[w / 2 + 3, 0, 1.5]} color={frame} />
      <Block size={[w, h, 1.5]} at={[0, 0, 0.75]} color={color} shadow={false} />
      <Block size={[w - 22, 70, 1]} at={[0, 22, 1.8]} color={color} shadow={false} />
      <Block size={[w - 22, 85, 1]} at={[0, 106, 1.8]} color={color} shadow={false} />
      <mesh position={[w / 2 - 9, 100, 4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1, 1, 13, 10]} />
        {mat("#b08d57", 0.3, 0.8)}
      </mesh>
    </group>
  );
}

/** Window on the left side wall (faces +x); light pours in from here. */
export function SideWindow({ x, z, sill = 85, w = 120, h = 140 }: { x: number; z: number; sill?: number; w?: number; h?: number }) {
  return (
    <group position={[x, sill + h / 2, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, 0.2]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#f3f6f8" toneMapped={false} />
      </mesh>
      <Block size={[w + 8, 5, 3]} at={[0, h / 2, 1.5]} color="#f4f2ee" />
      <Block size={[w + 8, 5, 3]} at={[0, -h / 2 - 5, 1.5]} color="#f4f2ee" />
      <Block size={[5, h, 3]} at={[-w / 2 - 2, -h / 2, 1.5]} color="#f4f2ee" />
      <Block size={[5, h, 3]} at={[w / 2 + 2, -h / 2, 1.5]} color="#f4f2ee" />
      <Block size={[3, h, 3]} at={[0, -h / 2, 1.5]} color="#f4f2ee" />
      <Block size={[w + 16, 3, 18]} at={[0, -h / 2 - 6, 9]} color="#ebe7df" />
    </group>
  );
}

/** A small stack of books lying on the floor or a surface. */
export function Books({ at, colors = ["#7d4b3a", "#3f5a6b", "#d8b46a", "#e8e2d6"], rotY = 0.2 }: { at: V3; colors?: string[]; rotY?: number }) {
  const heights = colors.map((_, i) => 3 + (i % 2) * 1.5);
  const bottoms = heights.map((_, i) => heights.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <group position={at} rotation={[0, rotY, 0]}>
      {colors.map((c, i) => (
        <Block key={i} size={[26 - i * 1.5, heights[i], 19 - i]} at={[i * 0.8, bottoms[i], 0]} color={c} rotY={(i % 2) * 0.12} />
      ))}
    </group>
  );
}

/** Woven basket. */
export function Basket({ at, r = 20, h = 30, color = "#c9a878" }: { at: V3; r?: number; h?: number; color?: string }) {
  return (
    <group position={at}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r * 0.85, h, 28, 1, true]} />
        <meshStandardMaterial color={color} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[r * 0.85, r * 0.85, 1, 28]} />
        {mat(color, 1)}
      </mesh>
      <Soft size={[r * 1.5, 10, r * 1.2]} at={[0, h - 6, 0]} color="#e9e1d3" radius={4} rot={[0.1, 0.4, 0.05]} />
    </group>
  );
}

/** Round pet cushion. */
export function PetBed({ at, r = 30, color = "#c9b7a1" }: { at: V3; r?: number; color?: string }) {
  return (
    <group position={at}>
      <mesh position={[0, 7, 0]} castShadow receiveShadow>
        <torusGeometry args={[r * 0.78, r * 0.24, 16, 40]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh position={[0, 3.5, 0]} receiveShadow>
        <cylinderGeometry args={[r * 0.8, r * 0.8, 7, 32]} />
        <meshStandardMaterial color="#efe6d8" roughness={1} />
      </mesh>
    </group>
  );
}

/** Outdoor railing: posts, top rail and glass panels along the back edge. */
export function Railing({ z, x0, x1, h = 100 }: { z: number; x0: number; x1: number; h?: number }) {
  const posts: number[] = [];
  for (let x = x0; x <= x1; x += 150) posts.push(x);
  return (
    <group>
      {posts.map((x, i) => (
        <Block key={i} size={[5, h, 5]} at={[x, 0, z]} color="#3a3a3a" roughness={0.5} metalness={0.5} />
      ))}
      <Block size={[x1 - x0 + 5, 5, 7]} at={[(x0 + x1) / 2, h, z]} color="#3a3a3a" roughness={0.5} metalness={0.5} />
      <mesh position={[(x0 + x1) / 2, h / 2 + 5, z]}>
        <boxGeometry args={[x1 - x0, h - 10, 1.2]} />
        <meshStandardMaterial color="#cfe3e6" transparent opacity={0.22} roughness={0.05} />
      </mesh>
    </group>
  );
}

/** Lantern for the terrace. */
export function Lantern({ at, h = 45 }: { at: V3; h?: number }) {
  return (
    <group position={at}>
      <Block size={[22, 3, 22]} at={[0, 0, 0]} color="#2b2b2b" metalness={0.5} roughness={0.5} />
      <Block size={[22, 3, 22]} at={[0, h - 3, 0]} color="#2b2b2b" metalness={0.5} roughness={0.5} />
      {[[-10, -10], [10, -10], [-10, 10], [10, 10]].map(([x, z], i) => (
        <Block key={i} size={[2, h - 6, 2]} at={[x, 3, z]} color="#2b2b2b" metalness={0.5} roughness={0.5} />
      ))}
      <mesh position={[0, 14, 0]}>
        <cylinderGeometry args={[4, 4, 16, 16]} />
        <meshStandardMaterial color="#fff3d6" emissive="#ffd9a0" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}
