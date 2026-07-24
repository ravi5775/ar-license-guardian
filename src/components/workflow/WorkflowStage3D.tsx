import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture, useVideoTexture } from "@react-three/drei";
import * as THREE from "three";
import { workflowMedia } from "@/lib/workflow-media";

export type StageRef = { current: number };

const damp = (c: number, t: number, f: number) => c + (t - c) * f;
const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);

/**
 * Per-stage pose of the printed photograph in world space.
 * 0 upload · 1 compile · 2 print · 3 scan · 4 play
 */
const POSES = [
  { rx: -0.55, ry: 0.55, rz: 0.08, y: 0.16, z: -0.5, s: 0.82 },
  { rx: -0.02, ry: 0.0, rz: 0.0, y: 0.0, z: 0.0, s: 1.0 },
  { rx: -1.02, ry: 0.12, rz: -0.05, y: -0.16, z: 0.12, s: 0.95 },
  { rx: -0.18, ry: -0.34, rz: 0.04, y: 0.02, z: 0.3, s: 1.02 },
  { rx: 0.0, ry: 0.0, rz: 0.0, y: 0.0, z: 0.45, s: 1.12 },
];

function StageContent({ stage }: { stage: StageRef }) {
  const photo = useTexture(workflowMedia.weddingPhotoLarge);
  const video = useVideoTexture(workflowMedia.weddingVideo, {
    muted: true,
    loop: true,
    start: true,
    playsInline: true,
    crossOrigin: "anonymous",
  });

  const group = useRef<THREE.Group>(null);
  const photoMat = useRef<THREE.MeshStandardMaterial>(null);
  const videoMat = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useRef<THREE.Mesh>(null);
  const points = useRef<THREE.Points>(null);
  const scanBar = useRef<THREE.Mesh>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const tilt = useRef({ x: 0, y: 0 });
  const pose = useRef({ ...POSES[0] });

  const { viewport } = useThree();

  useEffect(() => {
    photo.colorSpace = THREE.SRGBColorSpace;
    video.colorSpace = THREE.SRGBColorSpace;
  }, [photo, video]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  /** Contain-fit the photo plane inside the canvas so it never crops or overflows. */
  const { w, h } = useMemo(() => {
    const img = photo.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 3 / 2;
    const maxH = viewport.height * 0.72;
    const maxW = viewport.width * 0.72;
    const height = Math.min(maxH, maxW / aspect);
    return { w: height * aspect, h: height };
  }, [photo, viewport.width, viewport.height]);

  /** Marker feature points scattered across the photo surface. */
  const featureGeom = useMemo(() => {
    const n = 180;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * w * 0.94;
      arr[i * 3 + 1] = (Math.random() - 0.5) * h * 0.94;
      arr[i * 3 + 2] = 0.012;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, [w, h]);

  useEffect(() => () => featureGeom.dispose(), [featureGeom]);

  useFrame((state, delta) => {
    const i = THREE.MathUtils.clamp(Math.round(stage.current), 0, POSES.length - 1);
    const target = POSES[i];
    const k = 1 - Math.pow(0.001, delta); // frame-rate independent easing

    (Object.keys(target) as (keyof typeof target)[]).forEach((key) => {
      pose.current[key] = damp(pose.current[key], target[key], k * 0.9);
    });

    const t = state.clock.elapsedTime;
    tilt.current.x = damp(tilt.current.x, pointer.current.y * 0.1, 0.05);
    tilt.current.y = damp(tilt.current.y, pointer.current.x * 0.12, 0.05);

    if (group.current) {
      group.current.rotation.x = pose.current.rx + tilt.current.x;
      group.current.rotation.y = pose.current.ry + tilt.current.y;
      group.current.rotation.z = pose.current.rz;
      group.current.position.y = pose.current.y + Math.sin(t * 0.7) * 0.02;
      group.current.position.z = pose.current.z;
      group.current.scale.setScalar(pose.current.s);
    }

    // compile stage → feature points bloom
    if (points.current) {
      const m = points.current.material as THREE.PointsMaterial;
      m.opacity = damp(m.opacity, i === 1 ? 0.95 : 0, k * 0.6);
      m.size = 0.012 + Math.sin(t * 3) * 0.002;
    }

    // scan stage → sweeping recognition bar
    if (scanBar.current) {
      const m = scanBar.current.material as THREE.MeshBasicMaterial;
      m.opacity = damp(m.opacity, i === 3 ? 0.8 : 0, k * 0.6);
      scanBar.current.position.y = ((t * 0.55) % 1) * h - h / 2;
    }

    // play stage → video replaces the still, portal glow opens
    if (videoMat.current) {
      videoMat.current.opacity = damp(videoMat.current.opacity, i === 4 ? 1 : 0, k * 0.5);
    }
    if (photoMat.current) {
      photoMat.current.opacity = damp(photoMat.current.opacity, i === 4 ? 0 : 1, k * 0.5);
    }
    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = damp(m.opacity, i >= 3 ? 0.55 : 0.12, k * 0.5);
      const s = damp(glow.current.scale.x, i === 4 ? 1.18 : 1.02, k * 0.5);
      glow.current.scale.set(s, s, 1);
    }
    void clamp01;
  });

  return (
    <group ref={group}>
      <mesh ref={glow} position={[0, 0, -0.09]}>
        <planeGeometry args={[w * 1.12, h * 1.14]} />
        <meshBasicMaterial color="#f2b968" transparent opacity={0.12} />
      </mesh>

      {/* the video that lives inside the print */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          ref={videoMat}
          map={video}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>

      {/* the printed photograph */}
      <mesh castShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          ref={photoMat}
          map={photo}
          transparent
          roughness={0.68}
          metalness={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>

      <points ref={points} geometry={featureGeom}>
        <pointsMaterial color="#f2b968" size={0.012} transparent opacity={0} sizeAttenuation />
      </points>

      <mesh ref={scanBar} position={[0, 0, 0.02]}>
        <planeGeometry args={[w * 1.02, 0.035]} />
        <meshBasicMaterial color="#f2b968" transparent opacity={0} />
      </mesh>
    </group>
  );
}

/**
 * WebGL stage for the workflow walkthrough. The same printed photo travels
 * through every step in real 3D space instead of swapping flat screenshots.
 */
export default function WorkflowStage3D({ stage }: { stage: StageRef }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 3.1], fov: 42 }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[2.5, 3.5, 3]} intensity={1.5} />
      <directionalLight position={[-3, 1, 2]} intensity={0.5} color="#ffd9a8" />
      <StageContent stage={stage} />
    </Canvas>
  );
}
