import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useImageTexture, useDirectVideoTexture } from "@/hooks/use-three-texture";
import * as THREE from "three";
import { workflowMedia } from "@/lib/workflow-media";

type ProgressRef = { current: number };

const damp = (current: number, target: number, factor: number) =>
  current + (target - current) * factor;

/** One half of the printed photo, hinged at the centre seam. */
function CardHalf({
  side,
  texture,
  progress,
}: {
  side: -1 | 1;
  texture: THREE.Texture;
  progress: ProgressRef;
}) {
  const pivot = useRef<THREE.Group>(null);
  const rimRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const p = progress.current;
    // Frame 1 (0–15%): edges lift. Frame 2–3 (15–70%): halves swing apart.
    const lift = THREE.MathUtils.clamp(p / 0.15, 0, 1) * 0.12;
    const open = THREE.MathUtils.clamp((p - 0.15) / 0.55, 0, 1);
    const eased = open * open * (3 - 2 * open);
    if (pivot.current) {
      pivot.current.rotation.y = -side * (lift + eased * THREE.MathUtils.degToRad(130));
    }
    if (rimRef.current) {
      const m = rimRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.25 + eased * 0.6;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <group ref={pivot}>
        <mesh position={[(side * 0.6) / 1, 0, 0]} castShadow>
          <planeGeometry args={[0.6, 1.5]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.65}
            metalness={0.05}
            side={THREE.DoubleSide}
            // each half samples one side of the photo
            onBeforeCompile={(shader) => {
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <map_fragment>",
                `#ifdef USE_MAP
                   vec2 uvHalf = vec2(vMapUv.x * 0.5 + ${side === -1 ? "0.0" : "0.5"}, vMapUv.y);
                   vec4 sampledDiffuseColor = texture2D( map, uvHalf );
                   diffuseColor *= sampledDiffuseColor;
                 #endif`,
              );
            }}
          />
        </mesh>
        {/* warm rim light along the seam */}
        <mesh ref={rimRef} position={[side * 0.02, 0, 0.002]}>
          <planeGeometry args={[0.035, 1.5]} />
          <meshBasicMaterial color="#f0c07a" transparent opacity={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function PortalContent({ progress }: { progress: ProgressRef }) {
  const photo = useImageTexture(workflowMedia.weddingPhotoLarge);
  const video = useDirectVideoTexture(workflowMedia.weddingVideo, {
    muted: true,
    loop: true,
    playsInline: true,
  });
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const videoMat = useRef<THREE.MeshBasicMaterial>(null);
  const { camera, size } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const tilt = useRef({ x: 0, y: 0 });

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

  useFrame((state) => {
    const p = progress.current;
    const t = state.clock.elapsedTime;

    // Frame 0 — idle breathing float + damped cursor parallax
    tilt.current.x = damp(tilt.current.x, pointer.current.y * 0.16, 0.05);
    tilt.current.y = damp(tilt.current.y, pointer.current.x * 0.18, 0.05);
    if (group.current) {
      const idle = 1 - THREE.MathUtils.clamp(p / 0.15, 0, 1);
      group.current.position.y = Math.sin(t * (Math.PI / 4)) * 0.05 * idle;
      group.current.rotation.x = tilt.current.x * idle;
      group.current.rotation.y = tilt.current.y * idle;
    }

    // Frames 2–4 — scroll position IS the camera position (scrub 1:1)
    camera.position.z = THREE.MathUtils.lerp(2.6, -0.6, THREE.MathUtils.clamp(p, 0, 1));
    camera.position.y = THREE.MathUtils.lerp(0.35, 0, THREE.MathUtils.clamp(p / 0.7, 0, 1));
    camera.lookAt(0, 0, 0);

    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = THREE.MathUtils.clamp((p - 0.1) / 0.4, 0, 1) * 0.85;
      glow.current.scale.setScalar(1 + THREE.MathUtils.clamp(p, 0, 1) * 0.5);
    }
    if (videoMat.current) {
      videoMat.current.opacity = THREE.MathUtils.clamp((p - 0.25) / 0.2, 0, 1);
    }
    void size;
  });

  const glowGeom = useMemo(() => new THREE.PlaneGeometry(1.6, 1.9), []);

  return (
    <group ref={group}>
      {/* portal glow behind the opening card */}
      <mesh ref={glow} geometry={glowGeom} position={[0, 0, -0.35]}>
        <meshBasicMaterial color="#f2b968" transparent opacity={0} />
      </mesh>

      {/* the video revealed inside the portal */}
      <mesh position={[0, 0, -0.12]}>
        <planeGeometry args={[1.15, 1.45]} />
        <meshBasicMaterial ref={videoMat} map={video} transparent opacity={0} toneMapped={false} />
      </mesh>

      <CardHalf side={-1} texture={photo} progress={progress} />
      <CardHalf side={1} texture={photo} progress={progress} />
    </group>
  );
}

export default function PortalScene({ progress }: { progress: ProgressRef }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.35, 2.6], fov: 42 }}
      style={{ pointerEvents: "none" }}
    >
      {/* basic three-point lighting, no postprocessing */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 1, 2]} intensity={0.5} color="#ffd9a8" />
      <PortalContent progress={progress} />
    </Canvas>
  );
}
