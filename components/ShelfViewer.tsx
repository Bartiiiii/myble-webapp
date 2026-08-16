"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Html, Edges, Line } from "@react-three/drei";
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
  detectJoints,
} from "../lib/design";
import { useT, type TFn } from "../lib/i18n";

const STEP = 5; // arrows move by 5 cm (keeps parts grid-aligned)
const ACCENT = "#4f46e5";
const AMBER = "#f59e0b";

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const M = (cm: number) => cm / 100; // cm → metres

// In-scene control panel: precise arrow-move + delete (any part is deletable).
// Rendered inside <Canvas>, which is a separate R3F reconciler — React context from
// the DOM tree does not reach here, so the translator arrives as a prop (see ShelfViewer).
function PartControls({
  part,
  translate: t,
  onMove,
  onDelete,
}: {
  part: Part;
  translate: TFn;
  onMove: (dx: number, dy: number) => void;
  onDelete: () => void;
}) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div
      onPointerDown={stop}
      style={{ pointerEvents: "auto", transform: "translateY(-120%)" }}
      className="w-40 rounded-2xl bg-white/95 p-3 text-zinc-900 shadow-xl ring-1 ring-zinc-200 backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{t(`roles.${part.role}`)}</span>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          {t("viewer.remove")}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 grid-rows-2 gap-1">
        <span />
        <CtlBtn label="↑" onClick={() => onMove(0, STEP)} />
        <span />
        <CtlBtn label="←" onClick={() => onMove(-STEP, 0)} />
        <CtlBtn label="↓" onClick={() => onMove(0, -STEP)} />
        <CtlBtn label="→" onClick={() => onMove(STEP, 0)} />
      </div>
    </div>
  );
}

function CtlBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-base text-zinc-700 transition hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100"
    >
      {label}
    </button>
  );
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

function Unit({
  design,
  editable,
  selectedId,
  floatingIds,
  unitRef,
  onSelect,
  onChange,
  onDragStart,
  colorOverride,
  translate,
}: {
  design: Design;
  editable: boolean;
  selectedId: string | null;
  floatingIds: string[];
  unitRef: React.RefObject<THREE.Group | null>;
  onSelect?: (id: string | null) => void;
  onChange?: (d: Design) => void;
  onDragStart?: (part: Part, e: ThreeEvent<PointerEvent>) => void;
  colorOverride?: string;
  translate: TFn;
}) {
  const t = thicknessCm(design);
  const baseColor = colorOverride ?? colourHex(design.colour);
  const half = { x: design.outerCm.w / 2, y: design.outerCm.h / 2, z: design.outerCm.d / 2 };

  function move(part: Part, dx: number, dy: number) {
    const [sx, sy] = partSize(part, t);
    const target = {
      ...part.pos,
      x: clampN(part.pos.x + dx, -half.x + sx / 2, half.x - sx / 2),
      y: clampN(part.pos.y + dy, -half.y + sy / 2, half.y - sy / 2),
    };
    // Boards are solid: stop flush against whatever stands in the way.
    const { pos } = slide(part, target, design.parts.filter((p) => p.id !== part.id), t);
    onChange?.({
      ...design,
      parts: design.parts.map((p) =>
        p.id === part.id ? { ...p, pos: { ...p.pos, x: round1(pos.x), y: round1(pos.y) } } : p,
      ),
    });
  }
  function del(part: Part) {
    onChange?.({ ...design, parts: design.parts.filter((p) => p.id !== part.id) });
    onSelect?.(null);
  }

  return (
    <group ref={unitRef}>
      {editable && <Seams design={design} />}
      {design.parts.map((p) => {
        const [sx, sy, sz] = partSize(p, t);
        const selected = editable && p.id === selectedId;
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
                    e.stopPropagation();
                    onSelect?.(p.id);
                    onDragStart?.(p, e);
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
            {selected && <Edges scale={1.02} threshold={15} color={ACCENT} />}
            {selected && (
              <Html center distanceFactor={undefined} zIndexRange={[60, 0]} style={{ pointerEvents: "none" }}>
                <PartControls
                  part={p}
                  translate={translate}
                  onMove={(dx, dy) => move(p, dx, dy)}
                  onDelete={() => del(p)}
                />
              </Html>
            )}
          </mesh>
        );
      })}
    </group>
  );
}

function Scene({
  design,
  autoRotate,
  interactive,
  editable,
  selectedId,
  floatingIds,
  onSelect,
  onChange,
  colorOverride,
  lite,
  translate,
  fit,
}: {
  design: Design;
  autoRotate: boolean;
  interactive: boolean;
  editable: boolean;
  selectedId: string | null;
  floatingIds: string[];
  onSelect?: (id: string | null) => void;
  onChange?: (d: Design) => void;
  colorOverride?: string;
  lite: boolean;
  translate: TFn;
  fit: number;
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
    if (!isFinite(minx)) return { x: 0, y: 0, z: 0, h: h };
    return { x: (minx + maxx) / 2, y: (miny + maxy) / 2, z: (minz + maxz) / 2, h: maxy - miny };
  }, [design, h]);
  const bottomY = -(M(centre.h) * s) / 2;

  const unitRef = useRef<THREE.Group | null>(null);
  const drag = useRef<{ id: string; offset: { x: number; y: number } } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPlaneZ, setDragPlaneZ] = useState(0);
  const [glow, setGlow] = useState<{ point: { x: number; y: number; z: number } | null; seq: number }>({ point: null, seq: 0 });
  const lastSnapped = useRef(false);

  // Nudge a repaint after each commit (the static thumbnails run frameloop
  // "demand"; the interactive editor and auto-rotating showcases run "always").
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  });

  // Map a world point to design cm (inverting Center + scale via the Unit group).
  function worldToCm(pWorld: THREE.Vector3): { x: number; y: number } {
    const local = unitRef.current!.worldToLocal(pWorld.clone());
    return { x: local.x * 100, y: local.y * 100 };
  }

  function onDragStart(part: Part, e: ThreeEvent<PointerEvent>) {
    if (!unitRef.current) return;
    const grab = worldToCm(e.point);
    const partWorld = unitRef.current.localToWorld(new THREE.Vector3(M(part.pos.x), M(part.pos.y), M(part.pos.z)));
    drag.current = { id: part.id, offset: { x: part.pos.x - grab.x, y: part.pos.y - grab.y } };
    lastSnapped.current = false;
    setDragPlaneZ(partWorld.z);
    setDragging(true);
  }

  function onDragMove(e: ThreeEvent<PointerEvent>) {
    const dr = drag.current;
    if (!dr || !unitRef.current) return;
    const cur = design; // handler is re-created each render with the latest design
    const part = cur.parts.find((p) => p.id === dr.id);
    if (!part) return;
    const half = { x: cur.outerCm.w / 2, y: cur.outerCm.h / 2 };
    const tCm = thicknessCm(cur);
    const [sx, sy] = partSize(part, tCm);
    const others = cur.parts.filter((p) => p.id !== dr.id);
    const pcm = worldToCm(e.point);
    const target = {
      ...part.pos,
      x: clampN(pcm.x + dr.offset.x, -half.x + sx / 2, half.x - sx / 2),
      y: clampN(pcm.y + dr.offset.y, -half.y + sy / 2, half.y - sy / 2),
    };

    // Boards are solid, never ghosts: sweep from where the part is now and stop
    // flush against the first board in the way (sliding along it is still free).
    const solid = slide(part, target, others, tCm).pos;
    let nx = solid.x;
    let ny = solid.y;

    // Magnetic snap to nearby flush faces — but only when the snapped position
    // is itself free, so the magnet can never pull a board inside another.
    const moved: Part = { ...part, pos: { ...part.pos, x: nx, y: ny } };
    const res = snapPart(moved, others, tCm);
    const snapCandidate: Part = { ...part, pos: { ...part.pos, x: res.pos.x, y: res.pos.y } };
    let snapped = false;
    if (res.snapped && isClear(snapCandidate, others, tCm)) {
      nx = res.pos.x;
      ny = res.pos.y;
      snapped = true;
      if (!lastSnapped.current && res.contact) {
        // Rising edge: glow burst + haptic.
        setGlow({ point: res.contact, seq: Date.now() });
        try {
          navigator.vibrate?.(8);
        } catch {
          /* not supported */
        }
      }
    }
    lastSnapped.current = snapped;

    onChange?.({
      ...cur,
      parts: cur.parts.map((p) => (p.id === dr.id ? { ...p, pos: { ...p.pos, x: round1(nx), y: round1(ny) } } : p)),
    });
  }

  function onDragEnd() {
    drag.current = null;
    setDragging(false);
    lastSnapped.current = false;
  }

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

      {/* Auto-centre + re-frame as the piece changes (spec §9). */}
      <group scale={s}>
        <group position={[-M(centre.x), -M(centre.y), -M(centre.z)]}>
          <Unit
            design={design}
            editable={editable}
            selectedId={selectedId}
            floatingIds={floatingIds}
            unitRef={unitRef}
            onSelect={onSelect}
            onChange={onChange}
            onDragStart={onDragStart}
            colorOverride={colorOverride}
            translate={translate}
          />
          {editable && <SnapGlow point={glow.point} seq={glow.seq} />}
        </group>
      </group>

      {/* Invisible drag plane: catches pointer moves while dragging a part. */}
      {dragging && (
        <mesh
          position={[0, 0, dragPlaneZ]}
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
  height?: number;
  autoRotate?: boolean;
  interactive?: boolean;
  editable?: boolean;
  selectedId?: string | null;
  floatingIds?: string[];
  onSelect?: (id: string | null) => void;
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
}

export function ShelfViewer({
  design,
  height = 420,
  autoRotate = false,
  interactive = true,
  editable = false,
  selectedId = null,
  floatingIds = [],
  onSelect,
  onChange,
  color,
  background = "#fafafa",
  lite = false,
  fit = 1.1,
}: ShelfViewerProps) {
  // Read i18n out here, in the DOM tree: <Canvas> mounts a separate R3F reconciler
  // that our LocaleProvider context does not cross, so in-scene components take the
  // translator as a prop instead of calling useT() themselves.
  const translate = useT();

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
  const frameloop: "always" | "demand" = autoRotate || editable || !settled ? "always" : "demand";

  return (
    <div style={{ height }} className="w-full">
      <Canvas
        shadows
        frameloop={frameloop}
        camera={{ position: [1.6, 1.05, 2.0], fov: 42 }}
        dpr={[1, 2]}
        onPointerMissed={editable ? () => onSelect?.(null) : undefined}
      >
        {background !== "transparent" && <color attach="background" args={[background]} />}
        <Suspense fallback={null}>
          <Scene
            design={design}
            autoRotate={autoRotate}
            interactive={interactive}
            editable={editable}
            selectedId={selectedId}
            floatingIds={floatingIds}
            onSelect={onSelect}
            onChange={onChange}
            colorOverride={color}
            lite={lite}
            translate={translate}
            fit={fit}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default ShelfViewer;
