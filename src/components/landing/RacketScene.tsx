import { Canvas, useFrame } from "@react-three/fiber";
import { Center, ContactShadows, Environment, Lightformer, OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";

import { tokenColor } from "./tokenColor";

const INK = tokenColor("--ink-2");
const WHITE = tokenColor("--white");
const URL = "/models/racket.glb";
export type RacketKind = "control" | "balanced" | "power";
const TEX: Record<RacketKind, string> = {
  control: "/models/racket-control.jpg",
  balanced: "/models/racket-balanced.jpg",
  power: "/models/racket-power.jpg",
};

// The rental racket, from the venue's own 3D file. It turns slowly on its own;
// with a mouse or trackpad the visitor grabs it and turns it any way they like.
function Racket({ kind }: { kind: RacketKind }) {
  const { scene } = useGLTF(URL);
  const maps = useTexture(TEX);
  const g = useRef<THREE.Group>(null);
  const spin = useRef(0);
  // Same racket body, the face colour of the model picked: blue control, yellow balanced, orange power.
  useEffect(() => {
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !("map" in m) || !m.map) return;
      const t = maps[kind];
      if (m.map === t) return;
      t.flipY = m.map.flipY;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      m.map = t;
      m.needsUpdate = true;
    });
    spin.current = Math.PI * 2;
  }, [kind, scene, maps]);
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    g.current.position.y = Math.sin(clock.elapsedTime * 1.1) * 0.06;
    // a quick turn when the visitor picks another racket, easing out
    if (spin.current > 0.001) {
      const step = spin.current * (1 - Math.exp(-6 * Math.min(dt, 0.05)));
      spin.current -= step;
      g.current.rotation.y += step;
    }
  });
  return (
    <group ref={g}>
      <Center>
        <primitive object={scene} rotation={[0, 0, Math.PI / 2]} />
      </Center>
    </group>
  );
}

export default function RacketScene({ kind = "balanced" }: { kind?: RacketKind }) {
  const fine = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.2, 6.2], fov: 38 }} gl={{ alpha: true, antialias: true }}>
      <hemisphereLight args={[WHITE, INK, 1.2]} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} />
      <directionalLight position={[-4, 1, -3]} intensity={0.8} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 4, 3]} scale={[6, 6, 1]} />
        <Lightformer intensity={1} position={[-4, 0, 2]} rotation-y={Math.PI / 2} scale={[4, 6, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <Racket kind={kind} />
      </Suspense>
      <ContactShadows position={[0, -1.75, 0]} scale={6} blur={2.6} opacity={0.35} far={3} />
      <OrbitControls
        enabled={fine}
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate
        autoRotateSpeed={1.6}
        minPolarAngle={0.5}
        maxPolarAngle={2.3}
      />
    </Canvas>
  );
}

useGLTF.preload(URL);
useTexture.preload(Object.values(TEX));
