"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid } from "@react-three/drei";

type Plank3D = {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  color: string;
};

function makeId() {
  return crypto.randomUUID();
}

function createPlank(index: number): Plank3D {
  return {
    id: makeId(),
    name: `Plank ${index + 1}`,
    width: 1.8,
    height: 0.12,
    depth: 0.35,
    x: 0,
    y: 0.3 + index * 0.2,
    z: 0,
    rotationY: 0,
    color: index % 2 === 0 ? "#8b5e3c" : "#a06b45",
  };
}

function PlankMesh({
  plank,
  selected,
  onSelect,
}: {
  plank: Plank3D;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <mesh
      position={[plank.x, plank.y, plank.z]}
      rotation={[0, (plank.rotationY * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[plank.width, plank.height, plank.depth]} />
      <meshStandardMaterial
        color={plank.color}
        emissive={selected ? "#4338ca" : "#000000"}
        emissiveIntensity={selected ? 0.18 : 0}
      />
    </mesh>
  );
}

function FurnitureScene({
  planks,
  selectedId,
  onSelectPlank,
}: {
  planks: Plank3D[];
  selectedId: string;
  onSelectPlank: (id: string) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight
        position={[4, 6, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Environment preset="city" />

      <Grid
        position={[0, -0.01, 0]}
        args={[10, 10]}
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#d4d4d8"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#a1a1aa"
        fadeDistance={18}
        fadeStrength={1}
        infiniteGrid
      />

      {planks.map((plank) => (
        <PlankMesh
          key={plank.id}
          plank={plank}
          selected={plank.id === selectedId}
          onSelect={() => onSelectPlank(plank.id)}
        />
      ))}

      <OrbitControls enablePan enableZoom enableRotate />
    </>
  );
}

export default function DesignPage() {
  const [planks, setPlanks] = useState<Plank3D[]>([
    {
      id: makeId(),
      name: "Top plank",
      width: 2.2,
      height: 0.12,
      depth: 0.4,
      x: 0,
      y: 1.1,
      z: 0,
      rotationY: 0,
      color: "#8b5e3c",
    },
    {
      id: makeId(),
      name: "Bottom plank",
      width: 2.2,
      height: 0.12,
      depth: 0.4,
      x: 0,
      y: 0.05,
      z: 0,
      rotationY: 0,
      color: "#8b5e3c",
    },
    {
      id: makeId(),
      name: "Left side",
      width: 0.12,
      height: 1.2,
      depth: 0.4,
      x: -1.04,
      y: 0.58,
      z: 0,
      rotationY: 0,
      color: "#6b4a2f",
    },
    {
      id: makeId(),
      name: "Right side",
      width: 0.12,
      height: 1.2,
      depth: 0.4,
      x: 1.04,
      y: 0.58,
      z: 0,
      rotationY: 0,
      color: "#6b4a2f",
    },
    {
      id: makeId(),
      name: "Middle shelf",
      width: 1.95,
      height: 0.1,
      depth: 0.35,
      x: 0,
      y: 0.6,
      z: 0,
      rotationY: 0,
      color: "#a06b45",
    },
  ]);

  const [selectedId, setSelectedId] = useState<string>(planks[0]?.id ?? "");

  const selectedPlank = useMemo(
    () => planks.find((p) => p.id === selectedId) ?? null,
    [planks, selectedId]
  );

  function updatePlank(id: string, updates: Partial<Plank3D>) {
    setPlanks((current) =>
      current.map((plank) => (plank.id === id ? { ...plank, ...updates } : plank))
    );
  }

  function addPlank() {
    const newPlank = createPlank(planks.length);
    setPlanks((current) => [...current, newPlank]);
    setSelectedId(newPlank.id);
  }

  function duplicatePlank() {
    if (!selectedPlank) return;

    const copy: Plank3D = {
      ...selectedPlank,
      id: makeId(),
      name: `${selectedPlank.name} copy`,
      x: selectedPlank.x + 0.2,
      z: selectedPlank.z + 0.1,
    };

    setPlanks((current) => [...current, copy]);
    setSelectedId(copy.id);
  }

  function deletePlank() {
    if (!selectedPlank) return;

    setPlanks((current) => {
      const next = current.filter((p) => p.id !== selectedPlank.id);
      setSelectedId(next[0]?.id ?? "");
      return next;
    });
  }

  function resetExample() {
    const starter = [
      {
        id: makeId(),
        name: "Top plank",
        width: 2.2,
        height: 0.12,
        depth: 0.4,
        x: 0,
        y: 1.1,
        z: 0,
        rotationY: 0,
        color: "#8b5e3c",
      },
      {
        id: makeId(),
        name: "Bottom plank",
        width: 2.2,
        height: 0.12,
        depth: 0.4,
        x: 0,
        y: 0.05,
        z: 0,
        rotationY: 0,
        color: "#8b5e3c",
      },
      {
        id: makeId(),
        name: "Left side",
        width: 0.12,
        height: 1.2,
        depth: 0.4,
        x: -1.04,
        y: 0.58,
        z: 0,
        rotationY: 0,
        color: "#6b4a2f",
      },
      {
        id: makeId(),
        name: "Right side",
        width: 0.12,
        height: 1.2,
        depth: 0.4,
        x: 1.04,
        y: 0.58,
        z: 0,
        rotationY: 0,
        color: "#6b4a2f",
      },
      {
        id: makeId(),
        name: "Middle shelf",
        width: 1.95,
        height: 0.1,
        depth: 0.35,
        x: 0,
        y: 0.6,
        z: 0,
        rotationY: 0,
        color: "#a06b45",
      },
    ];

    setPlanks(starter);
    setSelectedId(starter[0].id);
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        {/* Brand row */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-indigo-600/20">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-700" fill="currentColor">
                <path d="M3 12c3-6 8-9 14-9 2 0 4 .4 6 1.2-3 6-8 9-14 9-2 0-4-.4-6-1.2zm0 8.8C6 14.8 11 12 17 12c2 0 4 .4 6 1.2-3 6-8 9-14 9-2 0-4-.4-6-1.2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">Myble</span>
          </Link>
        </div>

        {/* Header box */}
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600">Myble Configurator</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                3D Furniture Builder
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                Adjust every plank and see live updates on a rotatable 3D model.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              
              <Link
                href="/order/login"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Order
              </Link>
            </div>
          </div>
        </div>

        {/* 3D preview moved to top */}
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">3D preview</h2>
              <p className="text-sm text-zinc-600">
                Rotate, zoom, and inspect the furniture live as you edit.
              </p>
            </div>

            <div className="text-sm text-zinc-500">
              {planks.length} part{planks.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50">
            <div className="h-[520px] w-full">
              <Canvas
                shadows
                camera={{ position: [3.5, 2.5, 4], fov: 45 }}
                onPointerMissed={() => setSelectedId("")}
              >
                <FurnitureScene
                  planks={planks}
                  selectedId={selectedId}
                  onSelectPlank={setSelectedId}
                />
              </Canvas>
            </div>
          </div>
        </section>

        {/* Editor section below */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Parts</h2>
              <button
                onClick={addPlank}
                className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Add part
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {planks.map((plank) => {
                const active = plank.id === selectedId;

                return (
                  <button
                    key={plank.id}
                    onClick={() => setSelectedId(plank.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-zinc-200 bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{plank.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {plank.width.toFixed(2)} × {plank.height.toFixed(2)} ×{" "}
                        {plank.depth.toFixed(2)}
                      </p>
                    </div>

                    <span
                      className="ml-3 h-5 w-5 rounded-md ring-1 ring-black/10"
                      style={{ backgroundColor: plank.color }}
                    />
                  </button>
                );
              })}
            </div>

            {selectedPlank && (
              <div className="mt-6 border-t border-zinc-200 pt-5">
                <h3 className="text-base font-semibold">Selected part</h3>

                <div className="mt-4 grid gap-4">
                  <Field label="Name">
                    <input
                      value={selectedPlank.name}
                      onChange={(e) =>
                        updatePlank(selectedPlank.id, { name: e.target.value })
                      }
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                  </Field>

                  <Field label="Width">
                    <NumberInput
                      value={selectedPlank.width}
                      step={0.05}
                      min={0.05}
                      onChange={(value) =>
                        updatePlank(selectedPlank.id, {
                          width: clamp(value, 0.05, 4),
                        })
                      }
                    />
                  </Field>

                  <Field label="Height">
                    <NumberInput
                      value={selectedPlank.height}
                      step={0.05}
                      min={0.05}
                      onChange={(value) =>
                        updatePlank(selectedPlank.id, {
                          height: clamp(value, 0.05, 4),
                        })
                      }
                    />
                  </Field>

                  <Field label="Depth">
                    <NumberInput
                      value={selectedPlank.depth}
                      step={0.05}
                      min={0.05}
                      onChange={(value) =>
                        updatePlank(selectedPlank.id, {
                          depth: clamp(value, 0.05, 4),
                        })
                      }
                    />
                  </Field>

                  <Field label="X position">
                    <NumberInput
                      value={selectedPlank.x}
                      step={0.05}
                      onChange={(value) =>
                        updatePlank(selectedPlank.id, {
                          x: clamp(value, -3, 3),
                        })
                      }
                    />
                  </Field>

                  <Field label="Y position">
                    <NumberInput
                      value={selectedPlank.y}
                      step={0.05}
                      onChange={(value) =>
                        updatePlank(selectedPlank.id, {
                          y: clamp(value, -1, 4),
                        })
                      }
                    />
                  </Field>

                  <Field label="Z position">
                    <NumberInput
                      value={selectedPlank.z}
                      step={0.05}
                      onChange={(value) =>
                        updatePlank(selectedPlank.id, {
                          z: clamp(value, -3, 3),
                        })
                      }
                    />
                  </Field>

                  <Field label="Rotation Y">
                    <NumberInput
                      value={selectedPlank.rotationY}
                      step={5}
                      onChange={(value) =>
                        updatePlank(selectedPlank.id, {
                          rotationY: value,
                        })
                      }
                    />
                  </Field>

                  <Field label="Color">
                    <input
                      type="color"
                      value={selectedPlank.color}
                      onChange={(e) =>
                        updatePlank(selectedPlank.id, { color: e.target.value })
                      }
                      className="h-11 w-full rounded-xl border border-zinc-300 bg-white p-1"
                    />
                  </Field>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    onClick={duplicatePlank}
                    className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold hover:bg-zinc-200"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={deletePlank}
                    className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </aside>

          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <h2 className="text-lg font-semibold">Design controls</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Use the left panel to edit dimensions, position, color, and rotation of each part.
              The 3D preview above updates live as you make changes.
            </p>

            <div className="mt-5 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
              <h3 className="text-sm font-semibold">Next useful upgrade</h3>
              <p className="mt-1 text-sm text-zinc-600">
                The next version should add drag handles, snapping, collision checks,
                and saving projects to a database.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  step = 0.1,
  min,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
    />
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}