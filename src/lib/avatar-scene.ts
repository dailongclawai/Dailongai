/**
 * AvatarScene — TypeScript port of Sen Voice avatar-three.js
 * Drives a VRM avatar with lip-sync, blink, idle sway, and speech gestures.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import type { VRM } from '@pixiv/three-vrm';
import { AudioAnalyser } from './audio-analyser';

interface ArmBones {
  lUpperArm: THREE.Object3D | null;
  rUpperArm: THREE.Object3D | null;
  lLowerArm: THREE.Object3D | null;
  rLowerArm: THREE.Object3D | null;
}

interface APose {
  z: number;
  x: number;
  elbow: number;
}

export class AvatarScene {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private vrm: VRM | null;
  private analyser: AudioAnalyser;
  private audioAttached: boolean;
  private smoothedRms: number;
  private smoothedBins: [number, number, number, number];
  private nextBlinkAt: number;
  private blinkPhase: number;
  private blinkStart: number;
  private _boundResize: () => void;
  private _raf: number;
  private _bones: ArmBones | null;
  private _aPose: APose | null;
  private _spkAmp: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 1.35, 2.2);
    this.camera.lookAt(0, 1.35, 0);

    this._setupLights();

    this.clock = new THREE.Clock();
    this.vrm = null;
    this.analyser = new AudioAnalyser();
    this.audioAttached = false;
    this.smoothedRms = 0;
    this.smoothedBins = [0, 0, 0, 0];
    this.nextBlinkAt = 2 + Math.random() * 2;
    this.blinkPhase = 0;
    this.blinkStart = 0;
    this._raf = 0;
    this._bones = null;
    this._aPose = null;
    this._spkAmp = 0;

    this._boundResize = () => this._resize();
    window.addEventListener('resize', this._boundResize);
    this._resize();
  }

  private _setupLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.0));

    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(1.5, 2.5, 2.0);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xaacfff, 0.55);
    fill.position.set(-2.0, 1.0, 1.5);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffccaa, 0.7);
    rim.position.set(0, 1.5, -3.0);
    this.scene.add(rim);
  }

  async load(url: string): Promise<void> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('GLB does not contain a VRM avatar');

    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false;
    });
    this.scene.add(vrm.scene);
    this.vrm = vrm;

    const lUpperArm = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm') ?? null;
    const rUpperArm = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm') ?? null;
    const lLowerArm = vrm.humanoid?.getNormalizedBoneNode('leftLowerArm') ?? null;
    const rLowerArm = vrm.humanoid?.getNormalizedBoneNode('rightLowerArm') ?? null;

    const A_POSE = 1.05;
    const A_FWD = 0.18;
    const ELBOW = 0.80;

    if (lUpperArm) {
      lUpperArm.rotation.z = -A_POSE;
      lUpperArm.rotation.x = A_FWD;
    }
    if (rUpperArm) {
      rUpperArm.rotation.z = A_POSE;
      rUpperArm.rotation.x = A_FWD;
    }
    if (lLowerArm) {
      lLowerArm.rotation.x = ELBOW;
      lLowerArm.rotation.y = 0.08;
    }
    if (rLowerArm) {
      rLowerArm.rotation.x = ELBOW;
      rLowerArm.rotation.y = -0.08;
    }

    this._bones = { lUpperArm, rUpperArm, lLowerArm, rLowerArm };
    this._aPose = { z: A_POSE, x: A_FWD, elbow: ELBOW };

    vrm.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const height = size.y || 1.6;
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const distance = (height * 1.15 / 2) / Math.tan(fovRad / 2);
    this.camera.position.set(center.x, center.y, center.z + distance);
    this.camera.lookAt(center.x, center.y, center.z);
  }

  attachAudioStream(mediaStream: MediaStream): void {
    try {
      this.analyser.attachStream(mediaStream);
      if (this.analyser.context && this.analyser.context.state === 'suspended') {
        this.analyser.context.resume().catch(() => {});
      }
      this.audioAttached = true;
    } catch (err) {
      console.warn('[avatar] attachAudioStream failed:', err);
    }
  }

  private _updateLipSync(_dt: number): void {
    if (!this.vrm?.expressionManager) return;

    let rms = 0;
    let bins: [number, number, number, number] = [0, 0, 0, 0];

    if (this.audioAttached) {
      const s = this.analyser.sample();
      rms = s.rms || 0;
      bins = s.bins || [0, 0, 0, 0];
    }

    const a = rms > this.smoothedRms ? 0.5 : 0.15;
    this.smoothedRms += (rms - this.smoothedRms) * a;

    for (let i = 0; i < 4; i++) {
      const ba = bins[i] > this.smoothedBins[i] ? 0.5 : 0.2;
      this.smoothedBins[i] += (bins[i] - this.smoothedBins[i]) * ba;
    }

    const level = Math.max(0, (this.smoothedRms - 0.02) * 1.6);
    const amp = Math.min(level, 1.0);

    const bass = Math.min(this.smoothedBins[0] * 1.4, 1);
    const lowmid = Math.min(this.smoothedBins[1] * 1.4, 1);
    const highmid = Math.min(this.smoothedBins[2] * 1.4, 1);
    const treble = Math.min(this.smoothedBins[3] * 1.4, 1);

    const em = this.vrm.expressionManager;
    em.setValue('aa', amp * (0.55 + lowmid * 0.35));
    em.setValue('oh', amp * bass * 0.45);
    em.setValue('ou', amp * bass * 0.25);
    em.setValue('ih', amp * highmid * 0.30);
    em.setValue('ee', amp * treble * 0.25);
  }

  private _updateBlink(dt: number): void {
    if (!this.vrm?.expressionManager) return;

    this.nextBlinkAt -= dt;
    if (this.nextBlinkAt <= 0 && this.blinkPhase === 0) {
      this.blinkPhase = 1;
      this.blinkStart = this.clock.elapsedTime;
    }

    if (this.blinkPhase > 0) {
      const t = this.clock.elapsedTime - this.blinkStart;
      const closeDur = 0.08;
      const holdDur = 0.05;
      const openDur = 0.12;
      let blink = 0;

      if (t < closeDur) {
        blink = t / closeDur;
      } else if (t < closeDur + holdDur) {
        blink = 1;
      } else if (t < closeDur + holdDur + openDur) {
        blink = 1 - (t - closeDur - holdDur) / openDur;
      } else {
        blink = 0;
        this.blinkPhase = 0;
        this.nextBlinkAt = 2.5 + Math.random() * 3.5;
      }

      this.vrm.expressionManager.setValue('blink', blink);
    }
  }

  start(): void {
    const loop = (): void => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.1);

      if (this.vrm) {
        const t = this.clock.elapsedTime;
        const Ap = this._aPose || { z: 1.05, x: 0.18, elbow: 0.80 };

        this._updateLipSync(dt);
        this._updateBlink(dt);

        const rawSpk = Math.min(Math.max(0, this.smoothedRms - 0.025) * 6, 1);
        this._spkAmp = this._spkAmp * 0.94 + rawSpk * 0.06;
        const spk = this._spkAmp;

        // Body sway
        this.vrm.scene.rotation.y = Math.sin(t * 0.35) * (0.05 + spk * 0.03);
        this.vrm.scene.position.y = Math.sin(t * 1.6) * 0.008;

        // Arm animations
        const armSway = Math.sin(t * 0.9) * 0.04;

        if (this._bones?.lUpperArm) {
          this._bones.lUpperArm.rotation.z = -Ap.z - armSway;
          this._bones.lUpperArm.rotation.x = Ap.x + spk * (0.12 + Math.sin(t * 2.7) * 0.06);
          this._bones.lUpperArm.rotation.y = spk * Math.sin(t * 1.8) * 0.06;
        }
        if (this._bones?.rUpperArm) {
          this._bones.rUpperArm.rotation.z = Ap.z + armSway;
          this._bones.rUpperArm.rotation.x = Ap.x + spk * (0.12 + Math.sin(t * 2.7 + 1.6) * 0.06);
          this._bones.rUpperArm.rotation.y = spk * Math.sin(t * 1.8 + 1.6) * -0.06;
        }

        const elbowIdle = Math.sin(t * 0.7) * 0.06;
        const elbowSpk = spk * (0.15 + Math.sin(t * 2.1) * 0.10);

        if (this._bones?.lLowerArm) {
          this._bones.lLowerArm.rotation.x = Ap.elbow + elbowIdle + elbowSpk;
          this._bones.lLowerArm.rotation.y = 0.08 + spk * Math.sin(t * 1.9) * 0.10;
        }
        if (this._bones?.rLowerArm) {
          this._bones.rLowerArm.rotation.x = Ap.elbow + elbowIdle + elbowSpk;
          this._bones.rLowerArm.rotation.y = -0.08 - spk * Math.sin(t * 1.9 + 1.4) * 0.10;
        }

        // Head movement
        const headBone = this.vrm.humanoid?.getNormalizedBoneNode('head');
        if (headBone) {
          headBone.rotation.y = Math.sin(t * 0.5) * 0.08 + spk * Math.sin(t * 2.3) * 0.12;
          headBone.rotation.x = Math.sin(t * 0.3) * 0.04 + spk * Math.sin(t * 3.1) * 0.08;
        }

        // Spine & chest breathing
        const spine = this.vrm.humanoid?.getNormalizedBoneNode('spine');
        if (spine) {
          spine.rotation.y = Math.sin(t * 0.7) * 0.015 + spk * Math.sin(t * 1.5) * 0.03;
          spine.rotation.x = spk * Math.sin(t * 2.1) * 0.015;
        }

        const chest = this.vrm.humanoid?.getNormalizedBoneNode('chest');
        if (chest) {
          chest.rotation.x = Math.sin(t * 1.4) * 0.015;
        }

        this.vrm.update(dt);
      }

      this.renderer.render(this.scene, this.camera);
    };

    loop();
  }

  private _resize(): void {
    const c = this.canvas;
    const w = c.clientWidth || c.parentElement?.clientWidth || 512;
    const h = c.clientHeight || c.parentElement?.clientHeight || 512;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    window.removeEventListener('resize', this._boundResize);
    cancelAnimationFrame(this._raf);
    this.analyser.dispose();

    // Clear the scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    this.renderer.dispose();
    this.vrm = null;
    this._bones = null;
    this._aPose = null;
  }
}
