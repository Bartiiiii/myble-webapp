"use client";

// Room scenes for the design library: every design is shown standing in a
// furnished room instead of on a flat backdrop. Built from code (boxes,
// cylinders and canvas-drawn textures), so it costs no assets, stays true to
// scale — the room is measured in real centimetres around the piece's real
// size — and still turns in 3D like the rest of the viewer.
//
// Coordinates: the room renders inside the viewer's centred design group, so
// it shares the parts' frame (x = width, y = up, z = depth, front = +z). The
// group is scaled 0.01, so everything below is in centimetres, with y = 0 on
// the floor under the piece.

import React, { useMemo } from "react";
import * as THREE from "three";
import {
  Armchair,
  Basket,
  Bed,
  Block,
  Books,
  CoatRail,
  Door,
  FloorLamp,
  Frame,
  Lantern,
  Mirror,
  PetBed,
  Plant,
  Railing,
  Rug,
  SideWindow,
  Sofa,
  Speaker,
  TableLamp,
  TV,
} from "./props";
import { bricks, concrete, FLOOR_CM, gradient, planks, plaster, tiles } from "./textures";

import type { RoomId } from "../../lib/rooms";
export type { RoomId };

/** The piece's bounding box in design space (cm). */
export interface RoomBox {
  minx: number;
  maxx: number;
  miny: number;
  maxy: number;
  minz: number;
  maxz: number;
}

/** Everything a composition needs to place things around the piece (cm, floor = 0). */
interface Ctx {
  L: number; // left edge of the piece
  R: number; // right edge
  W: number; // width
  H: number; // height
  cx: number;
  cz: number;
  front: number; // front face (z)
  wallZ: number; // back wall surface (z)
  xL: number; // left side wall surface (x)
}

export interface RoomLight {
  ambient: number;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sun: string;
  sunIntensity: number;
}

interface RoomDef {
  /** Canvas clear colour — only seen past the room's edges. */
  background: string;
  wall?: string;
  wallTexture?: "plaster" | "brick";
  /** Lower-wall panelling colour (hallways). */
  wainscot?: string;
  floor: () => THREE.Texture;
  /** Distance from the piece's back to the wall (cm). */
  backGap?: number;
  /** Distance from the piece's left side to the side wall (cm), or null for none. */
  leftGap?: number | null;
  light: RoomLight;
  props: (c: Ctx) => React.ReactNode;
}

const WARM: RoomLight = { ambient: 0.45, hemiSky: "#fff6ea", hemiGround: "#b9a58c", hemi: 0.95, sun: "#fff1dc", sunIntensity: 1.7 };
const COOL: RoomLight = { ambient: 0.45, hemiSky: "#f1f4f8", hemiGround: "#a9a49c", hemi: 0.95, sun: "#fbf5ec", sunIntensity: 1.6 };
const DIM: RoomLight = { ambient: 0.5, hemiSky: "#fff3e2", hemiGround: "#8a735c", hemi: 1.0, sun: "#ffe9cc", sunIntensity: 1.9 };

/** Wall decoration that goes above the piece when it fits, else beside it. */
function aboveOrBeside(c: Ctx, w: number, h: number) {
  const y = Math.max(c.H + 30 + h / 2, 150);
  if (y + h / 2 < 245) return { x: c.cx, y };
  return { x: c.R + 30 + w / 2, y: 150 };
}

const ART_WARM = ["#efe7da", "#c8643b", "#e2b65c", "#2f4a3f", "#d9a38a"];
const ART_COOL = ["#e9ecef", "#2f4b6e", "#9fb6c9", "#d9c7a7", "#c45a3c"];
const ART_EARTH = ["#f1ebe1", "#7d5a44", "#b9945f", "#3c3c3c", "#a6b39a"];

export const ROOMS: Record<RoomId, RoomDef> = {
  // Sage living room — floor lamp, armchair, plant and a rug.
  living: {
    background: "#c7cdb8",
    wall: "#cdd3bf",
    floor: () => planks("#b88c5e"),
    leftGap: 210,
    light: WARM,
    props: (c) => {
      const art = aboveOrBeside(c, 50, 66);
      return (
        <>
          <FloorLamp at={[c.L - 38, 0, c.wallZ + 26]} />
          <Armchair at={[c.L - 125, 0, c.wallZ + 70]} rotY={0.5} color="#c9b49a" />
          <Plant at={[c.R + 42, 0, c.wallZ + 24]} height={80} kind="blades" pot="#e4ddd0" seed={3} />
          <Basket at={[c.R + 100, 0, c.wallZ + 28]} />
          <Frame at={[art.x, art.y, c.wallZ]} w={50} h={66} seed="living" palette={ART_WARM} />
          <Rug at={[c.cx, 0, c.front + 75]} w={Math.max(200, c.W + 120)} d={150} field="#e9e1d2" border="#c79a80" motif="#a3ad94" />
        </>
      );
    },
  },

  // Sunny reading corner with a window — for the pet pieces.
  reading: {
    background: "#efe6d6",
    wall: "#f0e8da",
    floor: () => planks("#d4b48c", { key: "light" }),
    leftGap: 130,
    light: WARM,
    props: (c) => {
      const art = aboveOrBeside(c, 42, 54);
      return (
        <>
          <SideWindow x={c.xL} z={c.wallZ + 120} />
          <Plant at={[c.L - 60, 0, c.wallZ + 38]} height={155} kind="tree" pot="#c97f5c" seed={7} />
          <PetBed at={[c.R + 55, 0, c.wallZ + 50]} />
          <Books at={[c.R + 120, 0, c.wallZ + 30]} />
          <Frame at={[art.x, art.y, c.wallZ]} w={42} h={54} seed="reading" palette={ART_EARTH} frame="#c9a77c" />
          <Rug at={[c.cx, 0, c.front + 55]} w={Math.max(150, c.W + 80)} d={150} field="#e3d4bd" border="#e3d4bd" motif="#e3d4bd" round />
        </>
      );
    },
  },

  // Deep-green music lounge: speakers either side, album art on the wall.
  music: {
    background: "#3e5a4b",
    wall: "#46624f",
    floor: () => planks("#7a5236", { key: "walnut" }),
    leftGap: 170,
    light: DIM,
    props: (c) => {
      const y = Math.max(c.H + 50, 150);
      const above = y + 16 < 245;
      const xs = above ? [c.cx - 42, c.cx, c.cx + 42] : [c.R + 40, c.R + 82, c.R + 124];
      const palettes = [
        ["#e8d7b5", "#c0392b", "#1f1f1f"],
        ["#1f2a44", "#f2c14e", "#f7f3e9"],
        ["#f0e6d8", "#2f6f73", "#e07a5f"],
      ];
      return (
        <>
          {xs.map((x, i) => (
            <Frame key={i} at={[x, above ? y : 150, c.wallZ]} w={34} h={34} seed={`lp${i}`} palette={palettes[i]} frame="#1a1a1a" mount={false} />
          ))}
          <Speaker at={[c.L - 26, 0, c.wallZ + 22]} />
          <Speaker at={[c.R + 26, 0, c.wallZ + 22]} />
          <Plant at={[c.L - 95, 0, c.wallZ + 30]} height={110} kind="blades" pot="#2d2d2d" seed={5} />
          <Rug at={[c.cx, 0, c.front + 70]} w={Math.max(200, c.W + 120)} d={150} field="#c9a46f" border="#8a4a36" motif="#a98856" style="diamonds" />
        </>
      );
    },
  },

  // Dusty-blue study: reading chair, lamp, books.
  study: {
    background: "#a9b9c6",
    wall: "#aebfcc",
    floor: () => planks("#9a6c45", { width: 12, key: "study" }),
    leftGap: 220,
    light: COOL,
    props: (c) => {
      const art = aboveOrBeside(c, 46, 60);
      return (
        <>
          <FloorLamp at={[c.L - 38, 0, c.wallZ + 26]} metal="#b08d57" />
          <Armchair at={[c.L - 135, 0, c.wallZ + 72]} rotY={0.55} color="#a65d3f" legs="#3b2a20" />
          <Books at={[c.R + 35, 0, c.wallZ + 25]} />
          <Plant at={[c.R + 95, 0, c.wallZ + 26]} height={70} kind="bush" pot="#f0ece4" seed={11} />
          <Frame at={[art.x, art.y, c.wallZ]} w={46} h={60} seed="study" palette={ART_COOL} frame="#f2f0eb" />
          <Rug at={[c.cx, 0, c.front + 75]} w={Math.max(200, c.W + 120)} d={150} field="#ddd3c1" border="#8b97a6" motif="#c9a08a" style="stripes" />
        </>
      );
    },
  },

  // Living room with the sofa behind — for coffee tables.
  lounge: {
    background: "#e9e2d6",
    wall: "#ece5d9",
    floor: () => planks("#c09466", { key: "lounge" }),
    backGap: 45 + 92,
    leftGap: null,
    light: WARM,
    props: (c) => {
      const sofaW = Math.max(210, c.W + 90);
      const sofaZ = c.wallZ + 46;
      return (
        <>
          <Sofa at={[c.cx, 0, sofaZ]} w={sofaW} color="#9aa391" />
          <Frame at={[c.cx - 32, 150, c.wallZ]} w={50} h={64} seed="lounge-a" palette={ART_WARM} frame="#c9a77c" />
          <Frame at={[c.cx + 32, 150, c.wallZ]} w={50} h={64} seed="lounge-b" palette={ART_WARM} frame="#c9a77c" />
          <Plant at={[c.cx - sofaW / 2 - 40, 0, c.wallZ + 36]} height={150} kind="tree" pot="#e8e2d6" seed={2} />
          <FloorLamp at={[c.cx + sofaW / 2 + 32, 0, c.wallZ + 28]} metal="#b08d57" />
          <Rug at={[c.cx, 0, c.cz + 10]} w={Math.max(230, c.W + 140)} d={170} field="#efe8dc" border="#c48b6a" motif="#9aa391" />
        </>
      );
    },
  },

  // Brick-and-concrete loft.
  loft: {
    background: "#8f4c37",
    wall: "#ffffff",
    wallTexture: "brick",
    floor: () => concrete("#a7a39c"),
    leftGap: 190,
    light: WARM,
    props: (c) => {
      const art = aboveOrBeside(c, 60, 44);
      return (
        <>
          <FloorLamp at={[c.L - 38, 0, c.wallZ + 26]} metal="#1f1f1f" shade="#2a2a2a" />
          <Plant at={[c.L - 115, 0, c.wallZ + 45]} height={120} kind="bush" pot="#3a3a3a" seed={13} />
          <Basket at={[c.R + 42, 0, c.wallZ + 30]} color="#8a6a48" />
          <Frame at={[art.x, art.y, c.wallZ]} w={60} h={44} seed="loft" palette={ART_EARTH} frame="#1a1a1a" />
          <Rug at={[c.cx, 0, c.front + 75]} w={Math.max(200, c.W + 120)} d={150} field="#d9cbb3" border="#5a514a" motif="#c2b296"  style="diamonds" />
        </>
      );
    },
  },

  // Bedroom: the bed to the left, a lamp on the piece itself.
  bedroom: {
    background: "#d9cfc6",
    wall: "#ddd3c9",
    floor: () => planks("#c8a57f", { key: "bed" }),
    leftGap: 300,
    light: WARM,
    props: (c) => {
      const bedX = c.L - 8 - 82;
      return (
        <>
          <Bed at={[bedX, 0, c.wallZ]} />
          <TableLamp at={[c.L + 11, c.H, c.cz - 3]} />
          <Frame at={[bedX, 150, c.wallZ]} w={80} h={55} seed="bed" palette={ART_EARTH} frame="#c9a77c" />
          <Plant at={[c.R + 45, 0, c.wallZ + 28]} height={85} kind="blades" pot="#e8e2d6" seed={17} />
          <Rug at={[c.R + 30, 0, c.front + 70]} w={120} d={80} field="#e9e3d7" border="#d2c1aa" motif="#b8c2b5" style="stripes" />
        </>
      );
    },
  },

  // TV wall for media benches.
  tvwall: {
    background: "#dcd8d1",
    wall: "#dedad3",
    floor: () => planks("#b88c5e", { key: "tv" }),
    leftGap: 190,
    light: COOL,
    props: (c) => {
      const tvW = Math.min(140, Math.max(100, c.W - 10));
      const tvY = c.H + 22 + (tvW * 0.575) / 2;
      const fits = tvY + (tvW * 0.575) / 2 < 250;
      return (
        <>
          {fits && <TV at={[c.cx, tvY, c.wallZ]} w={tvW} />}
          <Plant at={[c.L - 45, 0, c.wallZ + 30]} height={130} kind="blades" pot="#2f2f2f" seed={19} />
          <Speaker at={[c.R + 28, 0, c.wallZ + 22]} h={90} color="#e6e1d8" />
          <Rug at={[c.cx, 0, c.front + 80]} w={Math.max(220, c.W + 120)} d={160} field="#d6d2c9" border="#6f7a85" motif="#c4a27a" />
        </>
      );
    },
  },

  // Hallway: panelled wall, checker tiles, round mirror, coats.
  hallway: {
    background: "#ebe4d6",
    wall: "#efe8da",
    wainscot: "#9fae95",
    floor: () => tiles("#b5643f", "#efe6d4", 30, "#d8cfc0"),
    leftGap: 160,
    light: WARM,
    props: (c) => {
      const m = aboveOrBeside(c, 60, 60);
      return (
        <>
          <Mirror at={[m.x, Math.max(m.y, 160), c.wallZ]} />
          <CoatRail at={[c.L - 75, 180, c.wallZ]} w={84} />
          <Plant at={[c.R + 35, 0, c.wallZ + 24]} height={75} kind="blades" pot="#efe8da" seed={23} />
          <Basket at={[c.L - 75, 0, c.wallZ + 30]} r={17} h={28} />
        </>
      );
    },
  },

  // Entryway: front door, coat rail, doormat.
  entry: {
    background: "#dde3df",
    wall: "#dfe5e1",
    floor: () => tiles("#8f9396", "#a4a8aa", 40, "#7e8285"),
    leftGap: null,
    light: COOL,
    props: (c) => {
      const doorX = c.L - 80;
      const rail = c.H < 120 ? { x: c.cx, w: Math.min(110, Math.max(70, c.W - 10)) } : { x: c.R + 60, w: 80 };
      return (
        <>
          <Door at={[doorX, 0, c.wallZ]} />
          <CoatRail at={[rail.x, 185, c.wallZ]} w={rail.w} coats={["#3e4a5c", "#b5703f"]} />
          <Rug at={[doorX, 0, c.wallZ + 50]} w={80} d={50} field="#6b5a48" border="#4d4034" motif="#4d4034" />
          <Plant at={[c.R + 40, 0, c.wallZ + 26]} height={95} kind="bush" pot="#d9d2c5" seed={29} />
        </>
      );
    },
  },

  // Home office with a window and a tall plant.
  office: {
    background: "#bfcad2",
    wall: "#c4ced6",
    floor: () => planks("#c9a679", { key: "office" }),
    leftGap: 150,
    light: COOL,
    props: (c) => {
      const art = c.H < 100 ? aboveOrBeside(c, 56, 40) : { x: c.R + 58, y: 150 };
      return (
        <>
          <SideWindow x={c.xL} z={c.wallZ + 110} />
          <Plant at={[c.L - 62, 0, c.wallZ + 40]} height={140} kind="tree" pot="#f0ece4" seed={31} />
          <Frame at={[art.x, art.y, c.wallZ]} w={56} h={40} seed="office" palette={ART_COOL} frame="#2b2b2b" />
          <Books at={[c.R + 40, 0, c.wallZ + 26]} colors={["#2f4b6e", "#d8b46a", "#e8e2d6"]} />
          <Rug at={[c.cx, 0, c.front + 70]} w={Math.max(180, c.W + 80)} d={130} field="#e3e6e8" border="#8ea2b8" motif="#c9d4de" style="stripes" />
        </>
      );
    },
  },

  // Outdoor terrace: deck, glass railing, sky and trees.
  terrace: {
    background: "#cfe1ee",
    floor: () => planks("#9b7653", { width: 14, gap: "#3a2b1f", key: "deck" }),
    backGap: 70,
    leftGap: null,
    light: { ambient: 0.45, hemiSky: "#dcecff", hemiGround: "#8a7a5a", hemi: 0.85, sun: "#fff4e0", sunIntensity: 2.6 },
    props: (c) => (
      <>
        <Railing z={c.wallZ} x0={c.cx - 375} x1={c.cx + 375} />
        <Plant at={[c.L - 70, 0, c.wallZ + 45]} height={160} kind="tree" pot="#c06a45" seed={37} />
        <Plant at={[c.R + 85, 0, c.wallZ + 40]} height={90} kind="bush" pot="#c06a45" seed={41} />
        <Lantern at={[c.R + 48, 0, c.wallZ + 32]} />
      </>
    ),
  },
};

/** Floor, walls and skirting. */
function Shell({ def, c }: { def: RoomDef; c: Ctx }) {
  const floorTex = useMemo(() => def.floor(), [def]);
  const wallMap = useMemo(
    () => (def.wallTexture === "brick" ? bricks("#a4563c") : def.wall ? plaster() : null),
    [def],
  );
  const wallH = Math.max(270, c.H + 40);
  const wallW = FLOOR_CM;
  const isOutdoor = !def.wall;
  return (
    <>
      {/* Floor (stops at the back wall / railing). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[c.cx, 0, c.wallZ + FLOOR_CM / 2]} receiveShadow>
        <planeGeometry args={[FLOOR_CM, FLOOR_CM]} />
        <meshStandardMaterial map={floorTex} roughness={0.75} />
      </mesh>

      {!isOutdoor && (
        <>
          <mesh position={[c.cx, wallH / 2, c.wallZ]} receiveShadow>
            <planeGeometry args={[wallW, wallH]} />
            <meshStandardMaterial color={def.wall} map={wallMap ?? undefined} roughness={0.95} />
          </mesh>
          {def.wainscot && (
            <>
              <Block size={[wallW, 100, 1.5]} at={[c.cx, 0, c.wallZ + 0.75]} color={def.wainscot} shadow={false} />
              <Block size={[wallW, 4, 3]} at={[c.cx, 100, c.wallZ + 1.5]} color={def.wainscot} shadow={false} />
            </>
          )}
          <Block size={[wallW, 9, 1.6]} at={[c.cx, 0, c.wallZ + (def.wainscot ? 2.3 : 0.8)]} color={def.wainscot ?? "#f6f3ee"} shadow={false} />
          {def.leftGap != null && (
            <>
              <mesh position={[c.xL, wallH / 2, c.wallZ + FLOOR_CM / 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                <planeGeometry args={[FLOOR_CM, wallH]} />
                <meshStandardMaterial color={def.wall} map={wallMap ?? undefined} roughness={0.95} />
              </mesh>
              <Block size={[1.6, 9, FLOOR_CM]} at={[c.xL + 0.8, 0, c.wallZ + FLOOR_CM / 2]} color={def.wainscot ?? "#f6f3ee"} shadow={false} />
            </>
          )}
        </>
      )}

      {isOutdoor && <Outdoors c={c} />}
    </>
  );
}

/** What lies past the terrace railing: lawn, trees, sky. */
function Outdoors({ c }: { c: Ctx }) {
  const sky = useMemo(() => gradient("sky", "#9cc3e4", "#e7f0f4"), []);
  const trees = useMemo(() => {
    const out: { x: number; z: number; r: number; c: string }[] = [];
    let a = 7;
    const r = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 26; i++)
      out.push({
        x: c.cx - 900 + r() * 1800,
        z: c.wallZ - 260 - r() * 520,
        r: 90 + r() * 120,
        c: ["#6f8f5a", "#7d9a63", "#5f7f4d", "#88a66d"][i % 4],
      });
    return out;
  }, [c.cx, c.wallZ]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[c.cx, -40, c.wallZ - 700]}>
        <planeGeometry args={[4000, 1400]} />
        <meshStandardMaterial color="#9fb27f" roughness={1} />
      </mesh>
      {trees.map((t, i) => (
        <mesh key={i} position={[t.x, -40 + t.r * 0.9, t.z]} scale={[t.r, t.r * 1.1, t.r]}>
          <icosahedronGeometry args={[1, 3]} />
          <meshStandardMaterial color={t.c} roughness={1} />
        </mesh>
      ))}
      <mesh position={[c.cx, 400, c.wallZ - 1100]}>
        <planeGeometry args={[6000, 1600]} />
        <meshBasicMaterial map={sky} toneMapped={false} />
      </mesh>
      {/* deck edge fascia */}
      <Block size={[FLOOR_CM, 14, 4]} at={[c.cx, -14, c.wallZ - 2]} color="#6e5238" shadow={false} />
    </>
  );
}

/**
 * The room around a piece. Render inside the viewer's design-space group (the
 * one whose units are metres and whose origin is the parts' origin).
 */
export function Room({ id, box }: { id: RoomId; box: RoomBox }) {
  const def = ROOMS[id];
  const c: Ctx = useMemo(() => {
    const backGap = def.backGap ?? 1;
    const wallZ = box.minz - backGap;
    return {
      L: box.minx,
      R: box.maxx,
      W: box.maxx - box.minx,
      H: box.maxy - box.miny,
      cx: (box.minx + box.maxx) / 2,
      cz: (box.minz + box.maxz) / 2,
      front: box.maxz,
      wallZ,
      xL: box.minx - (def.leftGap ?? 0),
    };
  }, [box, def]);

  return (
    <group position={[0, box.miny / 100, 0]} scale={0.01}>
      <Shell def={def} c={c} />
      {def.props(c)}
    </group>
  );
}

/** Lights for a room scene (world space, outside the scaled group). */
export function RoomLights({ id }: { id: RoomId }) {
  const l = ROOMS[id].light;
  return (
    <>
      <ambientLight intensity={l.ambient} />
      <hemisphereLight args={[l.hemiSky, l.hemiGround, l.hemi]} />
      {/* Key light from the left/front — the window side — so the piece
          throws a soft shadow onto the wall on the camera's side. */}
      <directionalLight
        position={[-3.2, 5, 3.6]}
        intensity={l.sunIntensity}
        color={l.sun}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-2.6}
        shadow-camera-right={2.6}
        shadow-camera-top={2.6}
        shadow-camera-bottom={-2.6}
        shadow-camera-near={1}
        shadow-camera-far={14}
      />
      <directionalLight position={[3, 2, 4]} intensity={0.35} color="#ffffff" />
    </>
  );
}
