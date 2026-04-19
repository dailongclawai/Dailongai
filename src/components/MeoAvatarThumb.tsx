'use client';

import { useEffect, useRef, useState } from 'react';

// Renders VRM avatar face as a static thumbnail image
const CACHE_KEY = 'meo-avatar-thumb-v1';

export default function MeoAvatarThumb({ size = 56 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem(CACHE_KEY); } catch { return null; }
    }
    return null;
  });

  useEffect(() => {
    if (imageUrl) return; // Already have cached image
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');

        if (cancelled) return;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(2);
        renderer.setSize(size, size);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        const scene = new THREE.Scene();
        scene.background = null;

        // Camera framed for face/upper body
        const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 10);

        // Lighting
        scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.2));
        const key = new THREE.DirectionalLight(0xffffff, 1.8);
        key.position.set(1, 2, 2);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xaacfff, 0.6);
        fill.position.set(-1.5, 1, 1);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffccaa, 0.5);
        rim.position.set(0, 1.5, -2);
        scene.add(rim);

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        const gltf = await loader.loadAsync('/assets/avatar-meo.vrm');
        const vrm = gltf.userData.vrm;
        if (!vrm || cancelled) { renderer.dispose(); return; }

        VRMUtils.rotateVRM0(vrm);
        vrm.scene.traverse((obj: any) => { obj.frustumCulled = false; });
        scene.add(vrm.scene);

        // Frame camera on head
        vrm.scene.updateMatrixWorld(true);
        const headBone = vrm.humanoid?.getNormalizedBoneNode('head');
        if (headBone) {
          headBone.updateWorldMatrix(true, false);
          const headPos = new THREE.Vector3();
          headPos.setFromMatrixPosition(headBone.matrixWorld);
          // Position camera slightly above and in front of head
          camera.position.set(headPos.x, headPos.y + 0.05, headPos.z + 0.45);
          camera.lookAt(headPos.x, headPos.y + 0.02, headPos.z);
        } else {
          // Fallback: full body
          const box = new THREE.Box3().setFromObject(vrm.scene);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          camera.position.set(center.x, center.y + size.y * 0.3, center.z + 0.5);
          camera.lookAt(center.x, center.y + size.y * 0.3, center.z);
        }

        // Render one frame and capture
        vrm.update(0);
        renderer.render(scene, camera);
        const dataUrl = canvas.toDataURL('image/png');

        if (!cancelled) {
          setImageUrl(dataUrl);
          try { localStorage.setItem(CACHE_KEY, dataUrl); } catch {}
        }

        // Cleanup
        renderer.dispose();
        scene.clear();
      } catch (e) {
        console.warn('[meo-thumb] Failed to render avatar thumbnail:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [size, imageUrl]);

  return (
    <>
      {/* Hidden canvas for rendering */}
      {!imageUrl && <canvas ref={canvasRef} width={size} height={size} style={{ display: 'none' }} />}
      {/* Show captured image or fallback */}
      {imageUrl ? (
        <img src={imageUrl} alt="Meo Meo" width={size} height={size} loading="lazy" decoding="async" className="rounded-full object-cover" />
      ) : (
        <span className="text-2xl">🐱</span>
      )}
    </>
  );
}
