import { useEffect, useState } from "react";
import * as THREE from "three";

/**
 * Lightweight native Three.js texture hook.
 * Avoids pulling in the massive @react-three/drei package.
 */
export function useImageTexture(url: string): THREE.Texture {
  const [texture, setTexture] = useState<THREE.Texture>(() => {
    if (typeof window === "undefined") return new THREE.Texture();
    const loader = new THREE.TextureLoader();
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loader = new THREE.TextureLoader();
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
    });
  }, [url]);

  return texture;
}

export function useDirectVideoTexture(
  url: string,
  opts?: { muted?: boolean; loop?: boolean; playsInline?: boolean },
): THREE.VideoTexture {
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture>(() => {
    if (typeof window === "undefined") {
      return new THREE.VideoTexture({} as HTMLVideoElement);
    }
    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.loop = opts?.loop ?? true;
    video.muted = opts?.muted ?? true;
    video.playsInline = opts?.playsInline ?? true;
    video.autoplay = true;
    video.play().catch(() => {});
    const vt = new THREE.VideoTexture(video);
    vt.colorSpace = THREE.SRGBColorSpace;
    return vt;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.loop = opts?.loop ?? true;
    video.muted = opts?.muted ?? true;
    video.playsInline = opts?.playsInline ?? true;
    video.autoplay = true;
    video.play().catch(() => {});
    const vt = new THREE.VideoTexture(video);
    vt.colorSpace = THREE.SRGBColorSpace;
    setVideoTexture(vt);

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      vt.dispose();
    };
  }, [url]);

  return videoTexture;
}
