import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import * as THREE from "three";

import { tokenColor } from "./tokenColor";

const BLUE = tokenColor("--blue");
const BLUE_DARK = tokenColor("--blue-hover");
const INK = tokenColor("--ink");
const NEON = tokenColor("--neon");
const WHITE = tokenColor("--white");

const W = 10; // court width, x
const L = 20; // court length, z
const GAP = 3.2;

function Glass({ w, h, position, rotationY = 0 }: { w: number; h: number; position: [number, number, number]; rotationY?: number }) {
  return (
    <mesh position={position} rotation-y={rotationY}>
      <boxGeometry args={[w, h, 0.04]} />
      <meshPhysicalMaterial color={WHITE} transmission={0.9} roughness={0.05} thickness={0.05} transparent opacity={0.6} />
    </mesh>
  );
}

function Fence({ w, h, position, rotationY = 0 }: { w: number; h: number; position: [number, number, number]; rotationY?: number }) {
  return (
    <mesh position={position} rotation-y={rotationY}>
      <planeGeometry args={[w, h, Math.round(w * 3), Math.round(h * 3)]} />
      <meshBasicMaterial color={INK} wireframe transparent opacity={0.18} />
    </mesh>
  );
}

function Post({ x, z, h = 4 }: { x: number; z: number; h?: number }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow>
      <boxGeometry args={[0.08, h, 0.08]} />
      <meshStandardMaterial color={INK} />
    </mesh>
  );
}

function LinePlane({ w, d, x = 0, z = 0 }: { w: number; d: number; x?: number; z?: number }) {
  return (
    <mesh position={[x, 0.012, z]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={WHITE} />
    </mesh>
  );
}

/** Build on first view: each court goes floor, lines, net, walls, lights, one court after another. */
const STEP = 1.15; // seconds between courts
const PART = { floor: [0, 0.45], lines: [0.3, 0.65], net: [0.55, 0.85], walls: [0.75, 1.15], poles: [1.0, 1.3], lamps: [1.25, 1.5] } as const;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const prog = (t: number, [a, b]: readonly [number, number]) => ease((t - a) / (b - a));

const GREEN = "#4fae1c";
const GREEN_DARK = "#2f6e12";

// The dome floor plan from the film: Court 1 and Court 2 blue at the back, Court 3 neon green across the front.
const LAYOUT: { x: number; z: number; rot: number; green: boolean }[] = [
  { x: -(W / 2 + GAP / 2), z: -6, rot: 0, green: false },
  { x: W / 2 + GAP / 2, z: -6, rot: 0, green: false },
  { x: 0, z: 4 + GAP / 2 + W / 2, rot: Math.PI / 2, green: true },
];

function Court({ x, z = 0, rot = 0, green = false, selected, dim, onPick, build, delay }: { x: number; z?: number; rot?: number; green?: boolean; selected: boolean; dim: boolean; onPick?: () => void; build: RefObject<number>; delay: number }) {
  const hw = W / 2;
  const floor = useRef<THREE.Group>(null);
  const lines = useRef<THREE.Group>(null);
  const net = useRef<THREE.Group>(null);
  const walls = useRef<THREE.Group>(null);
  const poles = useRef<THREE.Group>(null);
  const lamps = useRef<THREE.MeshStandardMaterial[]>([]);
  const done = useRef(false);
  const [built, setBuilt] = useState(false);
  const show = (g: THREE.Object3D | null, v: number) => { if (g) g.visible = v > 0.002; };
  useFrame(() => {
    if (done.current) {
      lamps.current.forEach((m) => { if (m) m.emissiveIntensity = selected ? 1.6 : 0.6; });
      return;
    }
    const t = (build.current ?? 99) - delay;
    const f = prog(t, PART.floor);
    floor.current?.scale.set(Math.max(f, 0.001), 1, Math.max(f, 0.001));
    show(floor.current, f);
    const l = prog(t, PART.lines);
    lines.current?.scale.set(Math.max(l, 0.001), 1, Math.max(l, 0.001));
    show(lines.current, l);
    const n = prog(t, PART.net);
    net.current?.scale.set(1, Math.max(n, 0.001), 1);
    show(net.current, n);
    const w = prog(t, PART.walls);
    if (walls.current) { walls.current.position.y = (1 - w) * 6; walls.current.visible = w > 0.001; }
    const p = prog(t, PART.poles);
    poles.current?.scale.set(1, Math.max(p, 0.001), 1);
    show(poles.current, p);
    const k = prog(t, PART.lamps);
    // a short flicker as the lamps come on
    const flick = k > 0 && k < 1 ? (Math.sin(t * 60) > 0 ? 1 : 0.35) : 1;
    lamps.current.forEach((m) => { if (m) m.emissiveIntensity = (selected ? 1.6 : 0.6) * k * flick; });
    if (t > PART.lamps[1]) { done.current = true; setBuilt(true); }
  });
  const hl = L / 2;
  const surface = useMemo(() => new THREE.Color(green ? GREEN : BLUE).multiplyScalar(dim ? 0.55 : 1), [dim, green]);
  const outline = useMemo(
    () => [
      [-hw - 0.35, 0.03, -hl - 0.35],
      [hw + 0.35, 0.03, -hl - 0.35],
      [hw + 0.35, 0.03, hl + 0.35],
      [-hw - 0.35, 0.03, hl + 0.35],
      [-hw - 0.35, 0.03, -hl - 0.35],
    ] as [number, number, number][],
    [hw, hl],
  );
  return (
    <group
      position={[x, 0, z]}
      rotation-y={rot}
      onClick={(e) => {
        e.stopPropagation();
        onPick?.();
      }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <group ref={floor}>
      {/* surround */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <planeGeometry args={[W + 1, L + 1]} />
        <meshStandardMaterial color={green ? GREEN_DARK : BLUE_DARK} />
      </mesh>
      {/* surface */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial color={surface} roughness={0.9} />
      </mesh>
      </group>
      <group ref={lines}>
      {/* lines: service lines 6.95 m from the net, centre line between them */}
      <LinePlane w={W} d={0.05} z={-6.95} />
      <LinePlane w={W} d={0.05} z={6.95} />
      <LinePlane w={0.05} d={13.9} />
      </group>
      <group ref={net}>
      {/* net */}
      <mesh position={[0, 0.44, 0]}>
        <planeGeometry args={[W, 0.82, 40, 4]} />
        <meshBasicMaterial color={INK} wireframe transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <boxGeometry args={[W, 0.06, 0.03]} />
        <meshStandardMaterial color={WHITE} />
      </mesh>
      </group>
      <group ref={walls}>
      {/* back glass */}
      <Glass w={W} h={3} position={[0, 1.5, -hl]} />
      <Glass w={W} h={3} position={[0, 1.5, hl]} />
      {/* first 2 m of each side in glass */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Glass key={`${sx}${sz}`} w={2} h={3} position={[sx * hw, 1.5, sz * (hl - 1)]} rotationY={Math.PI / 2} />
        )),
      )}
      {/* fence above glass and along the middle of the sides */}
      <Fence w={W} h={1} position={[0, 3.5, -hl]} />
      <Fence w={W} h={1} position={[0, 3.5, hl]} />
      {[-1, 1].map((sx) => (
        <Fence key={sx} w={L - 4} h={3} position={[sx * hw, 1.5, 0]} rotationY={Math.PI / 2} />
      ))}
      {/* posts */}
      {[-hw, hw].map((px) => [-hl, -(hl - 2), hl - 2, hl].map((pz) => <Post key={`${px}${pz}`} x={px} z={pz} />))}
      </group>
      <group ref={poles}>
      {/* light poles */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`l${sx}${sz}`} position={[sx * (hw + 0.4), 0, sz * 5]}>
            <mesh position-y={3.2}>
              <cylinderGeometry args={[0.05, 0.06, 6.4, 8]} />
              <meshStandardMaterial color={INK} />
            </mesh>
            <mesh position={[-sx * 0.25, 6.4, 0]}>
              <boxGeometry args={[0.5, 0.12, 0.3]} />
              <meshStandardMaterial ref={(m: THREE.MeshStandardMaterial | null) => { if (m) lamps.current[(sx + 1) + (sz + 1) / 2] = m; }} color={WHITE} emissive={WHITE} emissiveIntensity={0} />
            </mesh>
          </group>
        )),
      )}
      </group>
      {selected && built ? <Line points={outline} color={NEON} lineWidth={3} /> : null}
    </group>
  );
}

const OVERVIEW = { pos: new THREE.Vector3(0, 30, 34), look: new THREE.Vector3(0, 0, 1) };

/**
 * Eagle eye: when a court is picked the camera flies up and over it and looks down onto the surface.
 * Once it lands, the visitor drags to look around it. "All courts" flies back out.
 */
function FlyTo({ x, z, focus, controls }: { x: number; z: number; focus: boolean; controls: RefObject<OrbitImpl | null> }) {
  const { camera } = useThree();
  const flying = useRef(true);
  const goal = useRef({ pos: OVERVIEW.pos.clone(), look: OVERVIEW.look.clone() });
  useEffect(() => {
    goal.current = focus
      ? { pos: new THREE.Vector3(x + 2.5, 16.5, z + 10.5), look: new THREE.Vector3(x, 0, z + 0.5) }
      : { pos: OVERVIEW.pos.clone(), look: OVERVIEW.look.clone() };
    flying.current = true;
  }, [x, z, focus]);
  // The moment the visitor grabs the view, the camera is theirs: stop flying.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => (flying.current = false);
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, [controls]);
  useFrame((_, raw) => {
    const c = controls.current;
    if (!flying.current || !c) return;
    const k = 1 - Math.exp(-3.2 * Math.min(raw, 0.05));
    camera.position.lerp(goal.current.pos, k);
    c.target.lerp(goal.current.look, k);
    c.update();
    if (camera.position.distanceTo(goal.current.pos) < 0.05 && c.target.distanceTo(goal.current.look) < 0.05) flying.current = false;
  });
  return null;
}

/** Runs the build clock once the canvas is up. Reduced motion skips straight to the finished courts. */
function BuildClock({ t }: { t: RefObject<number> }) {
  const el = useThree((st) => st.gl.domElement);
  const seen = useRef(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { seen.current = true; io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  useFrame((_, dt) => {
    if (seen.current && t.current < 20) t.current += Math.min(dt, 0.1);
  });
  return null;
}

export default function CourtScene({
  selected,
  focus = false,
  onPick,
}: {
  selected: number;
  focus?: boolean;
  onPick?: (i: number) => void;
  progress?: RefObject<number>;
}) {
  const controls = useRef<OrbitImpl | null>(null);
  const build = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 99 : -0.25);
  // Overview: drag with a mouse only, so a finger still scrolls the page and the wheel still scrolls it too.
  // Focused on a court: the view is the visitor's. Drag to orbit, scroll or pinch to zoom, right drag or two fingers to pan.
  const fine = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  return (
    <Canvas dpr={[1, 1.75]} shadows camera={{ position: [0, 30, 34], fov: 38 }} gl={{ alpha: true, antialias: true }} style={{ touchAction: focus ? "none" : "pan-y" }}>
      <hemisphereLight args={[WHITE, INK, 0.8]} />
      <directionalLight position={[12, 20, 8]} intensity={1.4} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 6, 0]} scale={[20, 20, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={0.8} position={[-10, 2, 0]} rotation-y={Math.PI / 2} scale={[30, 2, 1]} />
      </Environment>
      {LAYOUT.map((c, i) => (
        <Court key={i} x={c.x} z={c.z} rot={c.rot} green={c.green} selected={i === selected} dim={focus && i !== selected} onPick={() => onPick?.(i)} build={build} delay={i * STEP} />
      ))}
      <BuildClock t={build} />
      <ContactShadows position={[0, -0.02, 0]} scale={50} blur={2.4} opacity={0.4} far={8} />
      <OrbitControls
        ref={controls}
        makeDefault
        enabled={fine || focus}
        enableZoom={focus}
        enablePan={focus}
        screenSpacePanning={false}
        zoomSpeed={0.8}
        minDistance={5}
        maxDistance={48}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        minPolarAngle={0.12}
        maxPolarAngle={1.42}
      />
      <FlyTo x={LAYOUT[selected]?.x ?? 0} z={LAYOUT[selected]?.z ?? 0} focus={focus} controls={controls} />
    </Canvas>
  );
}
