import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const PLAY = { theta: 0.62, phi: 1.02, radius: 0.5, target: [0, 0.045, 0], fov: 42 };
const PODIUM = { theta: 0.2, phi: 1.08, radius: 1.05, target: [0, 0.08, 0], fov: 46 };

export async function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const cap = coarse ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(cap, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd5d8dc);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.003, 20);

  const hemi = new THREE.HemisphereLight(0xfff6ea, 0x93a4b4, 0.45);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff8ee, 2.35);
  sun.position.set(0.45, 1.35, 0.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const span = 0.55;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 0.2;
  sun.shadow.camera.far = 3.2;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    const hdr = await new RGBELoader().loadAsync(new URL('../assets/studio_small_09_1k.hdr', import.meta.url).href);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
  } catch {
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  pmrem.dispose();

  const tableMat = new THREE.MeshStandardMaterial({ color: 0xc4b29a, roughness: 0.86, metalness: 0 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 1.15), tableMat);
  table.position.y = -0.02;
  table.receiveShadow = true;
  scene.add(table);

  const rig = createRig(THREE, canvas, camera);
  rig.home('play');

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(cap, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();

  return { THREE, renderer, scene, camera, rig, resize, sun };
}

function createRig(THREE, canvas, camera) {
  const target = new THREE.Vector3(0, 0.045, 0);
  let theta = PLAY.theta;
  let phi = PLAY.phi;
  let radius = PLAY.radius;
  let homePose = PLAY;
  let enabled = true;
  let tapHandler = () => {};
  const pointers = new Map();
  let moved = 0;
  let downAt = 0;
  let orbiting = false;
  let pinch = null;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function apply() {
    const sin = Math.sin(phi);
    camera.position.set(
      target.x + radius * sin * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * sin * Math.cos(theta),
    );
    camera.lookAt(target);
  }

  function clampRadius(value) {
    return Math.max(0.16, Math.min(1.2, value));
  }

  function poseFrom(preset) {
    theta = preset.theta;
    phi = preset.phi;
    radius = preset.radius;
    target.set(preset.target[0], preset.target[1], preset.target[2]);
    camera.fov = preset.fov;
    camera.near = 0.003;
    camera.updateProjectionMatrix();
    apply();
  }

  function pointerList() {
    return [...pointers.values()];
  }

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button != null && event.button !== 0) return;
    canvas.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, ox: event.clientX, oy: event.clientY });
    if (pointers.size === 1) {
      moved = 0;
      downAt = performance.now();
      orbiting = false;
      pinch = null;
    } else {
      orbiting = true;
      const [a, b] = pointerList();
      pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        radius,
        tx: target.x,
        tz: target.z,
      };
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    const p = pointers.get(event.pointerId);
    if (!p || !enabled) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    p.x = event.clientX;
    p.y = event.clientY;
    moved = Math.max(moved, Math.hypot(event.clientX - p.ox, event.clientY - p.oy));
    if (pointers.size >= 2 && pinch) {
      const [a, b] = pointerList();
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      radius = clampRadius(pinch.radius / (dist / pinch.dist));
      const pan = radius * 0.0011;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      right.y = 0;
      if (right.lengthSq() > 1e-6) right.normalize();
      const forward = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 2);
      forward.y = 0;
      if (forward.lengthSq() > 1e-6) forward.normalize();
      target.x = pinch.tx - right.x * (mx - pinch.mx) * pan + forward.x * (my - pinch.my) * pan;
      target.z = pinch.tz - right.z * (mx - pinch.mx) * pan + forward.z * (my - pinch.my) * pan;
      target.x = Math.max(-0.18, Math.min(0.18, target.x));
      target.z = Math.max(-0.16, Math.min(0.16, target.z));
      apply();
      return;
    }
    if (pointers.size === 1 && moved > 8) {
      orbiting = true;
      theta -= dx * 0.0055;
      phi = Math.max(0.28, Math.min(1.22, phi + dy * 0.005));
      apply();
    }
  });
  const endPointer = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    const elapsed = performance.now() - downAt;
    if (pointers.size === 0 && !orbiting && moved < 8 && elapsed < 300 && enabled) {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      tapHandler(raycaster.ray);
    }
    if (pointers.size < 2) pinch = null;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  return {
    home(mode) {
      homePose = mode === 'podium' ? PODIUM : PLAY;
      poseFrom(homePose);
    },
    reset() { poseFrom(homePose); },
    setEnabled(value) { enabled = !!value; },
    onTap(fn) { tapHandler = fn; },
    // The results card covers the lower half of a phone. Park the lit bulbs in the top third.
    lift(points) {
      poseFrom(PLAY);
      const mid = new THREE.Vector3();
      if (points && points.length) {
        for (const p of points) mid.add(p);
        mid.multiplyScalar(1 / points.length);
      } else mid.set(0.04, 0.06, 0);
      camera.updateMatrixWorld();
      const screenUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      const screenRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      const dist = Math.max(0.2, camera.position.distanceTo(mid));
      const vHalf = Math.tan((camera.fov * Math.PI / 180) / 2);
      const right = mid.clone().sub(target).dot(screenRight);
      target.addScaledVector(screenRight, right * 0.7);
      target.addScaledVector(screenUp, -dist * vHalf * 0.62);
      apply();
      homePose = {
        theta, phi, radius,
        target: [target.x, target.y, target.z],
        fov: camera.fov,
      };
    },
    frame(points, { distance = 0.16, fov = 30 } = {}) {
      if (!points.length) return;
      const mid = new THREE.Vector3();
      for (const p of points) mid.add(p);
      mid.multiplyScalar(1 / points.length);
      const dir = new THREE.Vector3(-0.35, 0.32, 0.88).normalize();
      camera.position.copy(mid).addScaledVector(dir, distance);
      camera.near = 0.002;
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.lookAt(mid);
      target.copy(mid);
      enabled = false;
    },
    apply,
  };
}
