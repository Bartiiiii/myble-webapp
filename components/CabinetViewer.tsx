"use client";

import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function CabinetModel() {
  const group = useRef<THREE.Group>(null);
  const gltf = useGLTF("/models/cabinet.glb");

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    // Auto-rotate around the base rotation from slider:
    group.current.rotation.y = t * 0.5;
  });

  return (
    <group ref={group} position={[0, 0.1, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
}

export function CabinetViewer() {
  

  return (
    <div className="w-full">
      <div className="h-[360px] w-full overflow-hidden rounded-2xl bg-zinc-950/90 ring-1 ring-white/10">
        <Canvas camera={{ position: [0, 0.9, 2.8], fov: 40 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 2]} intensity={1.3} />
          <Environment preset="city" />

          <CabinetModel />

          {/* Jeśli chcesz TYLKO suwak i żadnego obracania myszką, usuń tę linijkę */}
          <OrbitControls enablePan={false} enableZoom={false} />
        </Canvas>
      </div>

      
    </div>
  );
}
