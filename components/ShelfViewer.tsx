"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useThree, useFrame, type RootState } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Edges, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  type Design,
  type Part,
  colourHex,
  partBox,
  partSize,
  thicknessCm,
  snap as snapPart,
  slide,
  isClear,
  makeId,
  MAX_PARTS,
  capAtEdge,
  uncap,
  isCap,
  isAtEdgeSlot,
  dragCapIntent,
  fitClear,
  growOuter,
  CAP_DIRS,
  type CapDir,
  detectJoints,
  MIN_PART_CM,
  OUTER_DIM,
  stretchedPart,
  fieldAxis,
  type SizeField,
  type StretchSide,
  type Axis,
  type Role,
} from "../lib/design";
import { useT, type TFn } from "../lib/i18n";
import {
  FRONT_FRAME,
  moveFrame,
  nudgeStep,
  worldDir,
  type MoveFrame,
  type Nudge,
} from "../lib/viewAxes";

/** Shared empty selection, so the default prop keeps a stable identity. */
const EMPTY_SELECTION: string[] = [];

const STEP = 5; // arrows move by 5 cm (keeps parts grid-aligned)
// How far one drag may grow the piece. The viewer re-frames to fit whatever it
// is showing, so an unbounded drag would race the camera outwards and shrink
// the piece to a speck under the pointer. Growth therefore stops after this
// much; let go and take hold again to carry on, which also keeps the camera
// settling between pulls instead of chasing the drag.
const GROW_PER_DRAG_CM = 60;
const EDGE_EPS = 0.01; // below this an arrow press moved nothing: we're at the edge
const opposite = (d: CapDir): CapDir =>
  d === "up" ? "down" : d === "down" ? "up" : d === "left" ? "right" : "left";
const ACCENT = "#4f46e5";
const AMBER = "#f59e0b";

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const M = (cm: number) => cm / 100; // cm → metres

// Control panel for the selected board: nudge it around the plane the camera
// is looking at, then duplicate / flip / remove. It used to float in the scene
// beside the board, which moved the buttons on every edit; it now docks to one
// corner of the canvas (see ShelfViewer) and edits whichever board is selected.
// It still takes the translator as a prop, the way it did in-scene.
function PartControls({
  translate: t,
  frame,
  onNudge,
  onDuplicate,
  onFlip,
  onDelete,
}: {
  translate: TFn;
  frame: MoveFrame;
  onNudge: (dir: Nudge) => void;
  onDuplicate: () => void;
  onFlip: () => void;
  onDelete: () => void;
}) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  // Four arrows, not six: the pad points where the screen points, and the axis
  // running into the screen is not one a flat pad can honestly offer. Each
  // button still says what it does to the piece — "move to the back" from
  // overhead — because a bare "up" means nothing once the camera has moved.
  const title = (dir: Nudge) => t(`viewer.${worldDir(frame, dir)}`);
  return (
    <div
      onPointerDown={stop}
      style={{ pointerEvents: "auto" }}
      className="w-[120px] rounded-2xl bg-white/70 p-2 text-zinc-900 shadow-lg ring-1 ring-white/70 backdrop-blur-xl backdrop-saturate-150"
    >
      {/* One 3×3 pad, so the whole panel is square: an inverted-T of arrows over
          a row of duplicate / flip / remove.
          Fixed pixel widths throughout (outer box + column tracks), not `1fr`,
          so the pad keeps its square shape wherever it is docked. */}
      <div className="grid grid-cols-[repeat(3,32px)] gap-1">
        <span aria-hidden="true" />
        <CtlBtn label="↑" title={title("up")} onClick={() => onNudge("up")} />
        <span aria-hidden="true" />
        <CtlBtn label="←" title={title("left")} onClick={() => onNudge("left")} />
        <CtlBtn label="↓" title={title("down")} onClick={() => onNudge("down")} />
        <CtlBtn label="→" title={title("right")} onClick={() => onNudge("right")} />
        <CtlBtn label="⧉" title={t("viewer.duplicate")} onClick={onDuplicate} />
        {/* Every board starts flat: flipping is how a shelf becomes a divider
            or a back panel, so one add button can produce all three. */}
        <CtlBtn label="⟲" title={t("viewer.flip")} onClick={onFlip} />
        <CtlBtn label="✕" title={t("viewer.remove")} onClick={onDelete} tone="danger" />
      </div>
    </div>
  );
}

function CtlBtn({
  label,
  title,
  onClick,
  tone = "plain",
}: {
  label: string;
  title: string;
  onClick: () => void;
  tone?: "plain" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "border-white/70 bg-white/55 text-rose-600 hover:border-rose-300/80 hover:bg-rose-50/90"
      : "border-white/70 bg-white/55 text-zinc-700 hover:border-indigo-300/80 hover:bg-indigo-50/90";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm shadow-sm transition active:scale-95 ${cls}`}
    >
      {label}
    </button>
  );
}

/**
 * Grab handles on the selected board's edges, the way a shape has them in a
 * drawing app: drag one and that edge follows, while the opposite edge stays
 * put.
 *
 * Only the edges lying in the current movement plane get a handle. A board's
 * other dimension runs into the screen from here, and a handle you can only
 * drag "away from yourself" is a guess, not a control — so it is simply not
 * offered until the camera comes round to it.
 */
function StretchHandles({
  part,
  tCm,
  frame,
  active,
  onGrab,
}: {
  part: Part;
  tCm: number;
  frame: MoveFrame;
  /** The handle currently being dragged, if any. */
  active: { field: SizeField; side: StretchSide } | null;
  onGrab: (field: SizeField, side: StretchSide) => void;
}) {
  const box = partBox(part, tCm);
  const handles: { field: SizeField; side: StretchSide; axis: Axis }[] = [];
  for (const field of ["aCm", "bCm"] as SizeField[]) {
    const axis = fieldAxis(part, field);
    if (axis !== frame.h && axis !== frame.v) continue; // edge-on to the camera
    handles.push({ field, side: 1, axis }, { field, side: -1, axis });
  }

  return (
    <>
      {handles.map(({ field, side, axis }) => {
        const at = { ...part.pos };
        at[axis] = side > 0 ? box.max[axis] : box.min[axis];
        const isActive = active?.field === field && active?.side === side;
        // While a drag is running the handles stop taking pointer events, so
        // the moves land on the canvas underneath and the gesture keeps going
        // even when the pointer is still over the dot it started on.
        const live = active !== null;
        return (
          <Html
            key={`${field}${side}`}
            position={[M(at.x), M(at.y), M(at.z)]}
            center
            zIndexRange={[40, 0]}
            style={{ pointerEvents: live ? "none" : "auto" }}
          >
            <button
              type="button"
              aria-label={`${part[field]} cm`}
              onPointerDown={(e) => {
                e.stopPropagation();
                onGrab(field, side);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ cursor: axis === frame.h ? "ew-resize" : "ns-resize", touchAction: "none" }}
            >
              {/* A generous invisible target around a small dot: easy to hit
                  with a thumb without a fat marker sitting over the board. */}
              <span
                className={`block rounded-full border-2 bg-white shadow-md transition-transform ${
                  isActive ? "h-3.5 w-3.5 scale-110 border-indigo-600" : "h-3 w-3 border-indigo-500"
                }`}
              />
            </button>
            {isActive && (
              <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900/90 px-2 py-1 font-mono text-[11px] tabular-nums text-white shadow-lg">
                {part[field]} cm
              </span>
            )}
          </Html>
        );
      })}
    </>
  );
}

/** Turning the default +Z-facing plane to face each axis in turn. */
const PLANE_ROTATION: Record<Axis, [number, number, number]> = {
  x: [0, Math.PI / 2, 0],
  y: [-Math.PI / 2, 0, 0],
  z: [0, 0, 0],
};

/**
 * Watches the camera and reports which plane it is looking at. It lives inside
 * <Canvas> because that is the only place the camera exists, and reports only
 * on an actual change, so an orbit costs one render per plane crossed rather
 * than one per frame.
 */
function MoveFrameProbe({ initial, onChange }: { initial: MoveFrame; onChange: (f: MoveFrame) => void }) {
  const camera = useThree((s) => s.camera);
  // The probe is the only thing that ever changes the frame, so it keeps its
  // own copy of the last one it reported; `initial` seeds it and is not read
  // again.
  const latest = useRef(initial);

  useFrame(() => {
    const m = camera.matrixWorld.elements; // column-major: right, up, backward
    const right = { x: m[0], y: m[1], z: m[2] };
    const up = { x: m[4], y: m[5], z: m[6] };
    const forward = { x: -m[8], y: -m[9], z: -m[10] };
    const next = moveFrame(forward, right, up, latest.current);
    const now = latest.current;
    if (
      next.locked !== now.locked ||
      next.h !== now.h ||
      next.hSign !== now.hSign ||
      next.v !== now.v ||
      next.vSign !== now.vSign
    ) {
      latest.current = next;
      onChange(next);
    }
  });

  return null;
}

// An expanding emissive ring that bursts at a snap contact then fades. Drives its
// own frames via invalidate() so the demand loop animates it without staying hot.
function SnapGlow({ point, seq }: { point: { x: number; y: number; z: number } | null; seq: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const start = useRef(0);
  const invalidate = useThree((s) => s.invalidate);

  // Restart the burst whenever a new snap fires (seq changes).
  useEffect(() => {
    start.current = 0;
  }, [seq]);

  useFrame((state) => {
    if (!ref.current || !point) return;
    if (start.current === 0) start.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - start.current;
    const dur = 0.45;
    if (t > dur) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const k = t / dur;
    const scale = 0.4 + k * 1.6;
    ref.current.scale.setScalar(scale);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = (1 - k) * 0.85;
    invalidate(); // keep animating under frameloop="demand"
  });

  if (!point) return null;
  return (
    <mesh ref={ref} position={[M(point.x), M(point.y), M(point.z)]} visible={false}>
      <ringGeometry args={[0.02, 0.05, 32]} />
      <meshBasicMaterial color={ACCENT} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// Faint persistent accent lines along every joint seam, so connections stay legible.
function Seams({ design }: { design: Design }) {
  const joints = useMemo(() => detectJoints(design), [design]);
  return (
    <>
      {joints.map((j, i) => (
        <Line
          key={`${j.aId}-${j.bId}-${i}`}
          points={[
            [M(j.seam.a.x), M(j.seam.a.y), M(j.seam.a.z)],
            [M(j.seam.b.x), M(j.seam.b.y), M(j.seam.b.z)],
          ]}
          color={ACCENT}
          transparent
          opacity={0.45}
          lineWidth={1.5}
        />
      ))}
    </>
  );
}

/** Every edit the control pad can make to a board: nudge on any axis,
 *  duplicate, flip, remove. Plain functions over the design rather than methods
 *  on an in-scene component, so the pad can live in the DOM and stay docked in
 *  one corner of the canvas instead of following the board around. */
function partActions(
  design: Design,
  {
    onChange,
    onSelect,
    onSnap,
  }: {
    onChange?: (d: Design) => void;
    onSelect?: (id: string | null) => void;
    onSnap?: (point: { x: number; y: number; z: number }) => void;
  },
) {
  const t = thicknessCm(design);
  const half = { x: design.outerCm.w / 2, y: design.outerCm.h / 2, z: design.outerCm.d / 2 };

  // Directions where a board's own axis has no cap meaning at all — a
  // divider pushed up, a shelf pushed sideways, anything pushed front/back —
  // never had a "stop dead at the wall" reason to exist beyond the outer
  // bound itself. Rather than clamping there, the furniture grows to follow
  // the board: many small boards can build something bigger than any single
  // carcass wall. Directions that DO have cap meaning (a shelf capping the
  // top, a divider capping a side) keep the existing stop-then-promote flow
  // untouched, so the two features never compete for the same gesture.
  function capEligible(part: Part, dir: CapDir): boolean {
    return dir === "up" || dir === "down" ? part.axis === "y" : part.axis === "x";
  }

  function move(part: Part, dx: number, dy: number, dz = 0) {
    const others = design.parts.filter((p) => p.id !== part.id);

    // Depth has no edge promotion at all: front and back always grow.
    if (dz !== 0) {
      const [, , sz] = partSize(part, t);
      const desiredZ = part.pos.z + dz;
      const outerCm = { ...design.outerCm, d: growOuter("d", design.outerCm.d, desiredZ, sz / 2) };
      const target = { ...part.pos, z: clampN(desiredZ, -outerCm.d / 2 + sz / 2, outerCm.d / 2 - sz / 2) };
      const { pos } = slide(part, target, others, t);
      onChange?.({
        ...design,
        outerCm,
        parts: design.parts.map((p) => (p.id === part.id ? { ...p, pos: { ...p.pos, z: round1(pos.z) } } : p)),
      });
      return;
    }

    const dir: CapDir = dy > 0 ? "up" : dy < 0 ? "down" : dx > 0 ? "right" : "left";

    if (!capEligible(part, dir)) {
      const [sx, sy] = partSize(part, t);
      const desired = { x: part.pos.x + dx, y: part.pos.y + dy };
      const outerCm = {
        ...design.outerCm,
        w: growOuter("w", design.outerCm.w, desired.x, sx / 2),
        h: growOuter("h", design.outerCm.h, desired.y, sy / 2),
      };
      const target = {
        ...part.pos,
        x: clampN(desired.x, -outerCm.w / 2 + sx / 2, outerCm.w / 2 - sx / 2),
        y: clampN(desired.y, -outerCm.h / 2 + sy / 2, outerCm.h / 2 - sy / 2),
      };
      const { pos } = slide(part, target, others, t);
      onChange?.({
        ...design,
        outerCm,
        parts: design.parts.map((p) =>
          p.id === part.id ? { ...p, pos: { ...p.pos, x: round1(pos.x), y: round1(pos.y) } } : p,
        ),
      });
      return;
    }

    // A cap pushed back off its edge returns to an ordinary inner board, and
    // the boards it covered grow back out to the outer face.
    if (isCap(part, design, opposite(dir), t)) {
      const back = uncap(design, part.id, opposite(dir), t);
      if (back) {
        onChange?.(back);
        onSnap?.(part.pos);
        return;
      }
    }

    const [sx, sy] = partSize(part, t);
    const target = {
      ...part.pos,
      x: clampN(part.pos.x + dx, -half.x + sx / 2, half.x - sx / 2),
      y: clampN(part.pos.y + dy, -half.y + sy / 2, half.y - sy / 2),
    };
    // Boards are solid: stop flush against whatever stands in the way.
    const { pos } = slide(part, target, others, t);
    const travelled = Math.abs(pos.x - part.pos.x) + Math.abs(pos.y - part.pos.y);

    // Second click at the edge: the board that can go no further becomes the
    // outer top / bottom / side, spanning the full width over the boards it
    // covers. The first click was the one that landed it flush here.
    if (travelled <= EDGE_EPS) {
      const capped = capAtEdge(design, part.id, dir, t);
      if (capped) {
        onChange?.(capped);
        onSnap?.(capped.parts.find((p) => p.id === part.id)?.pos ?? part.pos);
      }
      return;
    }

    // Stopped short of the full step: it just landed flush against something,
    // which is the click that says "this is the end".
    if (travelled + EDGE_EPS < Math.abs(dx) + Math.abs(dy)) onSnap?.({ ...part.pos, x: pos.x, y: pos.y });

    onChange?.({
      ...design,
      parts: design.parts.map((p) =>
        p.id === part.id ? { ...p, pos: { ...p.pos, x: round1(pos.x), y: round1(pos.y) } } : p,
      ),
    });
  }
  // Flip cycles the board through the three orientations (flat shelf →
  // upright divider → back panel), refitting it to the carcass each time and
  // stepping it clear of whatever it would otherwise land inside.
  function flip(part: Part) {
    const nextAxis: Axis = part.axis === "y" ? "x" : part.axis === "x" ? "z" : "y";
    const { w, h, d } = design.outerCm;
    const fitW = round1(Math.max(MIN_PART_CM, w - 2 * t));
    const fitH = round1(Math.max(MIN_PART_CM, h - 2 * t));
    const dims =
      nextAxis === "y"
        ? { aCm: fitW, bCm: d }
        : nextAxis === "x"
          ? { aCm: fitH, bCm: d }
          : { aCm: fitW, bCm: fitH };
    const role: Role = nextAxis === "y" ? "shelf" : nextAxis === "x" ? "divider" : "wall";
    const turned: Part = { ...part, axis: nextAxis, role, ...dims };

    // Keep the board inside the carcass on every axis after the size change.
    const [sx, sy, sz] = partSize(turned, t);
    const pos = {
      x: clampN(turned.pos.x, -half.x + sx / 2, half.x - sx / 2),
      y: clampN(turned.pos.y, -half.y + sy / 2, half.y - sy / 2),
      z: clampN(turned.pos.z, -half.z + sz / 2, half.z - sz / 2),
    };
    // fitClear never ships an overlap: if the turned orientation genuinely
    // has nowhere to go, even shrunk to the smallest board, the flip is
    // simply refused rather than landing the board inside another.
    const placed = fitClear({ ...turned, pos }, design.parts.filter((p) => p.id !== part.id), t, design.outerCm);
    if (!placed) return;
    onChange?.({ ...design, parts: design.parts.map((p) => (p.id === part.id ? placed : p)) });
  }

  // A copy of the board, moved clear of the original — nudged to a different
  // level first, then shifted sideways, then (only if the piece is packed
  // solid) shrunk, so a duplicate never lands as a "ghost" stacked exactly on
  // its source.
  function duplicate(part: Part) {
    if (design.parts.length >= MAX_PARTS) return;
    const copy: Part = { ...part, id: makeId() };
    const placed = fitClear(copy, design.parts, t, design.outerCm);
    if (!placed) return;
    onChange?.({ ...design, parts: [...design.parts, placed] });
    onSelect?.(placed.id);
  }

  function del(part: Part) {
    onChange?.({ ...design, parts: design.parts.filter((p) => p.id !== part.id) });
    onSelect?.(null);
  }
  return { move, flip, duplicate, del };
}

function Unit({
  design,
  editable,
  selectedIds,
  floatingIds,
  unitRef,
  onSelect,
  onDragStart,
  colorOverride,
}: {
  design: Design;
  editable: boolean;
  selectedIds: string[];
  floatingIds: string[];
  unitRef: React.RefObject<THREE.Group | null>;
  onSelect?: (id: string | null, extend?: boolean) => void;
  onDragStart?: (part: Part, e: ThreeEvent<PointerEvent>) => void;
  colorOverride?: string;
}) {
  const t = thicknessCm(design);
  const baseColor = colorOverride ?? colourHex(design.colour);

  return (
    <group ref={unitRef}>
      {editable && <Seams design={design} />}
      {design.parts.map((p) => {
        const [sx, sy, sz] = partSize(p, t);
        const selected = editable && selectedIds.includes(p.id);
        const floating = floatingIds.includes(p.id);
        const color = floating ? AMBER : baseColor;
        return (
          <mesh
            key={p.id}
            position={[M(p.pos.x), M(p.pos.y), M(p.pos.z)]}
            castShadow
            receiveShadow
            onPointerDown={
              editable
                ? (e: ThreeEvent<PointerEvent>) => {
                    // Right-click opens the group menu; it must not first tear
                    // the group down by reselecting whatever is under it.
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    // Shift or ⌘/Ctrl extends the selection, as everywhere else.
                    const extend = e.shiftKey || e.metaKey || e.ctrlKey;
                    onSelect?.(p.id, extend);
                    // Dragging a board out of a group would only scatter it, so
                    // a gesture starts only on a board being picked on its own.
                    if (!extend) onDragStart?.(p, e);
                  }
                : undefined
            }
            onPointerOver={editable ? () => (document.body.style.cursor = "grab") : undefined}
            onPointerOut={editable ? () => (document.body.style.cursor = "auto") : undefined}
          >
            <boxGeometry args={[M(sx), M(sy), M(sz)]} />
            <meshStandardMaterial
              color={color}
              roughness={0.6}
              metalness={0}
              emissive={selected ? ACCENT : floating ? AMBER : "#000000"}
              emissiveIntensity={selected ? 0.35 : floating ? 0.25 : 0}
            />
            {/* scale 1: the outline sits exactly on the board's own faces. An
                inflated outline read as the board poking into its neighbour. */}
            {selected && <Edges scale={1} threshold={15} color={ACCENT} />}
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Pull the camera in or out until the piece — measured by its own boards, not
 * the envelope around them — fills the canvas at whatever shape the canvas is.
 *
 * The default framing scales by the outer box and keeps a fixed camera, which
 * is right for the landscape editor but loses the piece in a tall portrait
 * frame, and loses it completely once the envelope has grown past the boards
 * (a design rebuilt after "clear" keeps the old outer size). Fitting the
 * bounding sphere instead keeps every angle of a full turn inside the frame.
 */
function FitCamera({ radius }: { radius: number }) {
  // The camera is read through the store rather than subscribed to: it is a
  // mutable three.js object this effect repositions, not React state.
  const get = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const controls = useThree((s) => s.controls) as unknown as { update?: () => void } | null;
  useEffect(() => {
    if (!(radius > 0) || !(width > 0) || !(height > 0)) return;
    const camera = get().camera as THREE.PerspectiveCamera;
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * (width / height));
    const dist = (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.04;
    const dir = camera.position.clone();
    if (dir.lengthSq() < 1e-6) dir.set(1.6, 1.05, 2.0);
    camera.position.copy(dir.normalize().multiplyScalar(dist));
    camera.near = Math.max(0.01, dist / 50);
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    controls?.update?.();
  }, [get, controls, radius, width, height]);
  return null;
}

function Scene({
  design,
  autoRotate,
  interactive,
  editable,
  selectedIds,
  floatingIds,
  onSelect,
  onChange,
  colorOverride,
  lite,
  fit,
  glow,
  pulse,
  frame,
  onGesture,
  fitCamera,
}: {
  design: Design;
  autoRotate: boolean;
  interactive: boolean;
  editable: boolean;
  selectedIds: string[];
  floatingIds: string[];
  onSelect?: (id: string | null, extend?: boolean) => void;
  onChange?: (d: Design) => void;
  colorOverride?: string;
  lite: boolean;
  fit: number;
  /** Snap burst, owned by the DOM wrapper so the docked control pad can fire
   *  it too (arrow moves land flush exactly like a drag does). */
  glow: { point: { x: number; y: number; z: number } | null; seq: number };
  pulse: (point: { x: number; y: number; z: number }) => void;
  /** The plane the camera is looking at — the two axes a drag may move along. */
  frame: MoveFrame;
  /** True while a drag or stretch is under way, so one gesture reads as one edit. */
  onGesture?: (active: boolean) => void;
  fitCamera: boolean;
}) {
  const { w, h, d } = design.outerCm;
  const maxDim = M(Math.max(Math.max(1, w), h, d));
  // `fit` scales how much of the frame the piece fills. Smaller = pulled back,
  // which is what small cards need so the whole piece stays inside the tile.
  const s = fit / maxDim;

  // Deterministic auto-centre + re-frame (spec §9): centre the parts' bounding box
  // ourselves rather than via drei <Center>, whose first-mount measurement of the
  // async <Line> seams left the model un-framed until the next React render.
  const centre = useMemo(() => {
    const t = thicknessCm(design);
    let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (const p of design.parts) {
      const b = partBox(p, t);
      minx = Math.min(minx, b.min.x); maxx = Math.max(maxx, b.max.x);
      miny = Math.min(miny, b.min.y); maxy = Math.max(maxy, b.max.y);
      minz = Math.min(minz, b.min.z); maxz = Math.max(maxz, b.max.z);
    }
    if (!isFinite(minx)) return { x: 0, y: 0, z: 0, h: h, diag: Math.hypot(w, h, d) };
    return {
      x: (minx + maxx) / 2,
      y: (miny + maxy) / 2,
      z: (minz + maxz) / 2,
      h: maxy - miny,
      diag: Math.hypot(maxx - minx, maxy - miny, maxz - minz),
    };
  }, [design, w, h, d]);
  const bottomY = -(M(centre.h) * s) / 2;

  // The pad and the stretch handles edit ONE board; with a group selected they
  // step aside for the group operations.
  const selectedPart =
    editable && selectedIds.length === 1
      ? (design.parts.find((p) => p.id === selectedIds[0]) ?? null)
      : null;

  const unitRef = useRef<THREE.Group | null>(null);
  const drag = useRef<{
    id: string;
    /** Frame captured when the gesture began, so an orbit can never reinterpret
     *  a drag that is already under way. */
    frame: MoveFrame;
    /** Envelope when the gesture began, so one pull can only grow it so far. */
    outerAtStart: Design["outerCm"];
    offset: { x: number; y: number; z: number };
    /** Edges the board was already parked against when this gesture started.
     *  Only those can be promoted by it, so the drag that carries a board to
     *  the edge stops there and the next one makes it the top. */
    edgeAtStart: Record<CapDir, boolean>;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  // A stretch runs through the same plane and the same pointer handlers as a
  // move; this is what tells them apart.
  const stretch = useRef<{ id: string; field: SizeField; side: StretchSide; anchorCm: number } | null>(null);
  const [stretching, setStretching] = useState<{ field: SizeField; side: StretchSide } | null>(null);
  // The plane the pointer is projected onto: perpendicular to the locked axis,
  // sitting at the board's own coordinate along it. Facing the camera like this
  // also keeps the projection stable at steep angles, where a fixed plane went
  // edge-on to the ray and the board stopped following the pointer.
  const [dragPlane, setDragPlane] = useState<{ axis: Axis; at: number }>({ axis: "z", at: 0 });
  const lastSnapped = useRef(false);

  // Nudge a repaint after each commit (the static thumbnails run frameloop
  // "demand"; the interactive editor and auto-rotating showcases run "always").
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  });

  // Map a world point to design cm (inverting Center + scale via the Unit group).
  function worldToCm(pWorld: THREE.Vector3): { x: number; y: number; z: number } {
    const local = unitRef.current!.worldToLocal(pWorld.clone());
    return { x: local.x * 100, y: local.y * 100, z: local.z * 100 };
  }

  function onDragStart(part: Part, e: ThreeEvent<PointerEvent>) {
    if (!unitRef.current) return;
    const grab = worldToCm(e.point);
    const partWorld = unitRef.current.localToWorld(new THREE.Vector3(M(part.pos.x), M(part.pos.y), M(part.pos.z)));
    const tCm = thicknessCm(design);
    const edgeAtStart = Object.fromEntries(
      CAP_DIRS.map((dir: CapDir) => [dir, isAtEdgeSlot(part, design, dir, tCm)]),
    ) as Record<CapDir, boolean>;
    drag.current = {
      id: part.id,
      frame,
      outerAtStart: { ...design.outerCm },
      offset: { x: part.pos.x - grab.x, y: part.pos.y - grab.y, z: part.pos.z - grab.z },
      edgeAtStart,
    };
    lastSnapped.current = false;
    setDragPlane({ axis: frame.locked, at: partWorld[frame.locked] });
    setDragging(true);
    onGesture?.(true);
  }

  function onStretchStart(part: Part, field: SizeField, side: StretchSide) {
    if (!unitRef.current) return;
    const partWorld = unitRef.current.localToWorld(
      new THREE.Vector3(M(part.pos.x), M(part.pos.y), M(part.pos.z)),
    );
    // Pin the anchored edge now: recomputing it mid-gesture lets rounding walk it.
    const box = partBox(part, thicknessCm(design));
    const axis = fieldAxis(part, field);
    stretch.current = { id: part.id, field, side, anchorCm: side > 0 ? box.min[axis] : box.max[axis] };
    setStretching({ field, side });
    setDragPlane({ axis: frame.locked, at: partWorld[frame.locked] });
    setDragging(true);
    onGesture?.(true);
  }

  // The grabbed edge simply goes where the pointer is; everything else about
  // the board — its other dimension, its opposite edge — stays exactly put.
  function onStretchMove(
    e: ThreeEvent<PointerEvent>,
    st: { id: string; field: SizeField; side: StretchSide; anchorCm: number },
  ) {
    const cur = design;
    const part = cur.parts.find((p) => p.id === st.id);
    if (!part) return;
    const tCm = thicknessCm(cur);
    const axis = fieldAxis(part, st.field);
    const pcm = worldToCm(e.point);
    const others = cur.parts.filter((p) => p.id !== st.id);
    const next = stretchedPart(part, st.field, st.side, pcm[axis], others, tCm, cur.outerCm, st.anchorCm);
    if (!next) return;
    onChange?.({ ...cur, parts: cur.parts.map((p) => (p.id === next.id ? next : p)) });
  }

  function onDragMove(e: ThreeEvent<PointerEvent>) {
    const st = stretch.current;
    if (st) {
      onStretchMove(e, st);
      return;
    }
    const dr = drag.current;
    if (!dr || !unitRef.current) return;
    const cur = design; // handler is re-created each render with the latest design
    const part = cur.parts.find((p) => p.id === dr.id);
    if (!part) return;
    const tCm = thicknessCm(cur);
    const size = partSize(part, tCm);
    const half: Record<Axis, number> = { x: size[0] / 2, y: size[1] / 2, z: size[2] / 2 };
    const others = cur.parts.filter((p) => p.id !== dr.id);
    const pcm = worldToCm(e.point);

    // The two axes this gesture may move along — whichever pair faces the
    // camera. The third one keeps the value it had when the drag started, so a
    // board can never drift in the one direction the user cannot see.
    const free: Axis[] = [dr.frame.h, dr.frame.v];
    const isFree = (a: Axis) => a === dr.frame.h || a === dr.frame.v;

    // Where the pointer actually wants the board, before the carcass clamps it.
    // Pushing past the edge is how a drag asks for the cap promotion.
    const want: Record<Axis, number> = { x: part.pos.x, y: part.pos.y, z: part.pos.z };
    for (const a of free) want[a] = pcm[a] + dr.offset[a];

    // Same rule as the arrow move: an axis only clamps to the current bound
    // when the board's own axis gives that direction cap meaning (a shelf up
    // or down, a divider left or right). Every other axis grows the
    // furniture to follow the drag instead of stopping dead at an edge that
    // has no reason to be fixed.
    const outerCm = { ...cur.outerCm };
    for (const a of free) {
      if (part.axis === a) continue;
      const dim = OUTER_DIM[a];
      // Grow to follow the board, but only so far in one pull (see the note on
      // GROW_PER_DRAG_CM) — the board then stops at the edge of that allowance.
      const ceiling = dr.outerAtStart[dim] + GROW_PER_DRAG_CM;
      outerCm[dim] = Math.min(growOuter(dim, cur.outerCm[dim], want[a], half[a]), ceiling);
    }
    const limit: Record<Axis, number> = {
      x: outerCm.w / 2 - half.x,
      y: outerCm.h / 2 - half.y,
      z: outerCm.d / 2 - half.z,
    };

    // A cap pulled back off its own face reverts to an ordinary inner board, so
    // one gesture can try the promotion and undo it. Capping is an x/y affair
    // (there is no such thing as a front cap), and a locked axis reports the
    // board's own position, which can never read as an overshoot — so only the
    // axes actually being dragged can ask for a promotion.
    const pullBack = dragCapIntent({ x: want.x, y: want.y }, { x: limit.x, y: limit.y }, part, cur, tCm);
    if (pullBack?.back) {
      const back = uncap(cur, part.id, pullBack.dir, tCm);
      if (back) {
        onChange?.(back);
        pulse(part.pos);
        lastSnapped.current = true;
        return;
      }
    }

    const target = { ...part.pos };
    for (const a of free) target[a] = clampN(want[a], -limit[a], limit[a]);

    // Boards are solid, never ghosts: sweep from where the part is now and stop
    // flush against the first board in the way (sliding along it is still free).
    const solid = slide(part, target, others, tCm).pos;
    const landed = { ...part.pos };
    for (const a of free) landed[a] = solid[a];

    // Magnetic snap to nearby flush faces — but only when the snapped position
    // is itself free, so the magnet can never pull a board inside another. The
    // snap searches all three axes; only the two being dragged are taken from
    // it, so it can't shunt the board through the locked one.
    const moved: Part = { ...part, pos: landed };
    const res = snapPart(moved, others, tCm);
    const snappedPos = { ...part.pos };
    for (const a of free) snappedPos[a] = res.pos[a];
    const snapCandidate: Part = { ...part, pos: snappedPos };
    let snapped = false;
    if (res.snapped && isFree(res.axis!) && isClear(snapCandidate, others, tCm)) {
      for (const a of free) landed[a] = snappedPos[a];
      snapped = true;
      if (!lastSnapped.current && res.contact) pulse(res.contact); // rising edge
    }
    lastSnapped.current = snapped;

    const rounded = { ...part.pos };
    for (const a of free) rounded[a] = round1(landed[a]);

    const next = {
      ...cur,
      outerCm,
      parts: cur.parts.map((p) => (p.id === dr.id ? { ...p, pos: rounded } : p)),
    };

    // Push past the edge and the board becomes the outer top / bottom / side —
    // but only if it was already parked there when this drag began. The drag
    // that carries a board up to the edge just lands it flush; the next one
    // promotes it, so the two steps always read as two separate moves.
    if (pullBack && !pullBack.back && dr.edgeAtStart[pullBack.dir]) {
      const capped = capAtEdge(next, dr.id, pullBack.dir, tCm);
      if (capped) {
        onChange?.(capped);
        pulse(capped.parts.find((p) => p.id === dr.id)?.pos ?? part.pos);
        lastSnapped.current = true;
        return;
      }
    }

    onChange?.(next);
  }

  const onDragEnd = useCallback(() => {
    drag.current = null;
    stretch.current = null;
    setStretching(null);
    setDragging(false);
    lastSnapped.current = false;
    onGesture?.(false);
  }, [onGesture]);

  // A drag can end somewhere the in-scene plane never hears about: over one of
  // the DOM overlays on top of the canvas (the add button, the menu, the board
  // control pad), outside the viewer entirely, or as a touch the browser
  // cancels. Any of those leaves the gesture open, and since rotation is gated
  // on it, the piece silently stops spinning while zoom keeps working.
  //
  // These listeners stay attached for the life of the viewer rather than only
  // while a drag runs: a click fast enough to release before React commits the
  // effect would slip through the gap and strand the gesture — which is what a
  // single tap on a board did. The gesture lives in a ref, set synchronously on
  // pointer-down, so the handler always sees it.
  useEffect(() => {
    const end = () => {
      if (drag.current || stretch.current) onDragEnd();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, [onDragEnd]);

  return (
    <>
      <ambientLight intensity={lite ? 1.15 : 0.85} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={lite ? 1.5 : 1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {!lite && <Environment preset="city" />}
      {fitCamera && <FitCamera radius={(M(centre.diag) * s) / 2} />}

      {/* Auto-centre + re-frame as the piece changes (spec §9). */}
      <group scale={s}>
        <group position={[-M(centre.x), -M(centre.y), -M(centre.z)]}>
          <Unit
            design={design}
            editable={editable}
            selectedIds={selectedIds}
            floatingIds={floatingIds}
            unitRef={unitRef}
            onSelect={onSelect}
            onDragStart={onDragStart}
            colorOverride={colorOverride}
          />
          {/* Handles ride with the board, so they belong in the same centred,
              scaled group the boards are drawn in. Hidden while the board is
              being moved: they would only lag behind the drag and clutter it. */}
          {editable && selectedPart && (!dragging || stretching) && (
            <StretchHandles
              part={selectedPart}
              tCm={thicknessCm(design)}
              frame={frame}
              active={stretching}
              onGrab={(field, side) => onStretchStart(selectedPart, field, side)}
            />
          )}
          {editable && <SnapGlow point={glow.point} seq={glow.seq} />}
        </group>
      </group>

      {/* Invisible drag plane: catches pointer moves while dragging a part. It
          lies across the two axes in play, square to the locked one. */}
      {dragging && (
        <mesh
          position={[
            dragPlane.axis === "x" ? dragPlane.at : 0,
            dragPlane.axis === "y" ? dragPlane.at : 0,
            dragPlane.axis === "z" ? dragPlane.at : 0,
          ]}
          rotation={PLANE_ROTATION[dragPlane.axis]}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerLeave={onDragEnd}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      <ContactShadows position={[0, bottomY - 0.002, 0]} opacity={0.32} scale={3} blur={2.6} far={2} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={interactive}
        enableRotate={interactive && !dragging}
        autoRotate={autoRotate}
        autoRotateSpeed={0.9}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

export interface ShelfViewerProps {
  design: Design;
  /** Canvas height. A string (e.g. "100%") lets it fill a flex parent instead. */
  height?: number | string;
  autoRotate?: boolean;
  interactive?: boolean;
  editable?: boolean;
  selectedIds?: string[];
  floatingIds?: string[];
  onSelect?: (id: string | null, extend?: boolean) => void;
  onChange?: (d: Design) => void;
  /** Force a single material colour for every part (overrides the colour). */
  color?: string;
  /** Canvas clear colour. Pass a warm tone to blend into a framed scene, or
   * "transparent" to let a CSS backdrop (e.g. a dark stage + glow) show through. */
  background?: string;
  /** Skip the HDR environment + bump lights (cheaper; for small thumbnails). */
  lite?: boolean;
  /** How much of the frame the piece fills (default 1.1). Lower pulls the
   * camera back — small cards need this so tall pieces aren't cropped. */
  fit?: number;
  /** Keep the drawing buffer readable after a frame, so the canvas can be
   *  turned into a PNG or a video stream. Costs memory/perf, so it is opt-in:
   *  only the share dialog sets it (see components/design/ShareDialog.tsx). */
  capturable?: boolean;
  /** Handed the live <canvas> once WebGL is up, plus the R3F store — the share
   *  dialog renders its picture and clip frames through it at export size. */
  onCanvasReady?: (canvas: HTMLCanvasElement, three: RootState) => void;
  /** Frame the camera to the piece's own boards at the canvas's aspect, instead
   *  of the fixed landscape framing. The portrait share stage needs this. */
  fitCamera?: boolean;
  /** Stop the render loop (frameloop "never") while something else renders
   *  through this canvas by hand, e.g. a share export. */
  paused?: boolean;
  /** Told which two axes the camera has put on screen, whenever that changes,
   *  so the page can name them next to the canvas controls. */
  onMoveFrame?: (frame: MoveFrame) => void;
  /** True while a drag or stretch is running, so undo can treat the whole
   *  gesture as the single edit the user thinks they made. */
  onGesture?: (active: boolean) => void;
}

export function ShelfViewer({
  design,
  height = 420,
  autoRotate = false,
  interactive = true,
  editable = false,
  selectedIds = EMPTY_SELECTION,
  floatingIds = [],
  onSelect,
  onChange,
  color,
  background = "#fafafa",
  lite = false,
  fit = 1.1,
  capturable = false,
  onCanvasReady,
  fitCamera = false,
  paused = false,
  onMoveFrame,
  onGesture,
}: ShelfViewerProps) {
  // Read i18n out here, in the DOM tree: <Canvas> mounts a separate R3F reconciler
  // that our LocaleProvider context does not cross, so in-scene components take the
  // translator as a prop instead of calling useT() themselves.
  const translate = useT();

  // The snap burst lives here rather than inside the canvas: both the drag
  // (in-scene) and the docked control pad (DOM) fire it, so landing a board
  // flush feels the same however it was moved.
  const [glow, setGlow] = useState<{ point: { x: number; y: number; z: number } | null; seq: number }>({
    point: null,
    seq: 0,
  });
  // Which two axes the camera has put on screen. Boards move in that plane and
  // nowhere else, so a drag or an arrow always does what the view suggests.
  const [frame, setFrame] = useState<MoveFrame>(FRONT_FRAME);
  useEffect(() => {
    onMoveFrame?.(frame);
  }, [frame, onMoveFrame]);

  const pulse = useCallback((point: { x: number; y: number; z: number }) => {
    setGlow({ point, seq: Date.now() });
    try {
      navigator.vibrate?.(8);
    } catch {
      /* not supported */
    }
  }, []);

  // The board the control pad edits. The pad is docked to a corner of the
  // canvas instead of floating beside the board: one place to look, one place
  // to reach, so a run of edits never turns into chasing a moving panel.
  const selectedPart =
    editable && selectedIds.length === 1
      ? (design.parts.find((p) => p.id === selectedIds[0]) ?? null)
      : null;
  const actions = partActions(design, { onChange, onSelect, onSnap: pulse });

  // Frameloop strategy: the interactive editor and auto-rotating showcases animate
  // every frame; static thumbnails render on demand to stay cheap. But every canvas
  // runs "always" for the first moment so it paints reliably once the ResizeObserver
  // has sized it (in this R3F build a plain invalidate() won't repaint after that
  // resize), then the static ones drop to "demand".
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 600);
    return () => clearTimeout(t);
  }, []);
  const frameloop: "always" | "demand" | "never" = paused
    ? "never"
    : autoRotate || editable || !settled
      ? "always"
      : "demand";

  return (
    <div style={{ height }} className="relative w-full">
      <Canvas
        shadows
        frameloop={frameloop}
        camera={{ position: [1.6, 1.05, 2.0], fov: 42 }}
        dpr={[1, 2]}
        gl={capturable ? { preserveDrawingBuffer: true } : undefined}
        onCreated={onCanvasReady ? (state) => onCanvasReady(state.gl.domElement, state) : undefined}
        onPointerMissed={
          editable
            ? (e) => {
                // Same again for the empty canvas: only a left click clears.
                if ((e as MouseEvent).button === 0) onSelect?.(null);
              }
            : undefined
        }
      >
        {background !== "transparent" && <color attach="background" args={[background]} />}
        <Suspense fallback={null}>
          <Scene
            design={design}
            autoRotate={autoRotate}
            interactive={interactive}
            editable={editable}
            selectedIds={selectedIds}
            floatingIds={floatingIds}
            onSelect={onSelect}
            onChange={onChange}
            colorOverride={color}
            lite={lite}
            fit={fit}
            glow={glow}
            pulse={pulse}
            frame={frame}
            onGesture={onGesture}
            fitCamera={fitCamera}
          />
          {/* Only the editor moves boards, so only the editor needs to track
              which plane the camera is on. */}
          {editable && <MoveFrameProbe initial={FRONT_FRAME} onChange={setFrame} />}
        </Suspense>
      </Canvas>

      {/* Docked control pad: bottom-right on a phone (thumb corner, opposite
          the add button), top-right under the canvas menu button on a desktop.
          Sits under the menu's own dropdown, which the page raises above it. */}
      {selectedPart && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 lg:bottom-auto lg:top-[68px]">
          <PartControls
            translate={translate}
            frame={frame}
            onNudge={(dir) => {
              const step = nudgeStep(frame, dir, STEP);
              actions.move(selectedPart, step.x, step.y, step.z);
            }}
            onDuplicate={() => actions.duplicate(selectedPart)}
            onFlip={() => actions.flip(selectedPart)}
            onDelete={() => actions.del(selectedPart)}
          />
        </div>
      )}
    </div>
  );
}

export default ShelfViewer;
