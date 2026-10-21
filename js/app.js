import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createVolcanoExperiment } from '../experiments/volcano.js';
import { createCircuitExperiment } from '../experiments/circuit.js';

const $ = (id) => document.getElementById(id);
const hint = $('hint');
const arBtn = $('arBtn');
const eruptBtn = $('eruptBtn');
const resetBtn = $('resetBtn');
const exitBtn = $('exitBtn');
const muteBtn = $('muteBtn');
const card = $('card');
const overlay = $('overlay');
const picker = $('picker');
const loader = $('loader');
const loaderText = $('loaderText');
const loadBar = $('loadBar');
const touch = $('touch');
const switcher = $('switcher');
const switchBtn = $('switchBtn');
const electronsBtn = $('electronsBtn');
const circuitResetBtn = $('circuitResetBtn');

function setHint(text) { if (hint.textContent !== text) hint.textContent = text; }

const HINT_LIFT = 'Ține telefonul puțin mai sus și mișcă-l încet';
const HINT_SCAN = 'Mișcă încet telefonul deasupra mesei… 👀';

const dprCap = Math.min(window.devicePixelRatio || 1, 1.5);
const renderer = new THREE.WebGLRenderer({
  antialias: dprCap <= 1.25,
  alpha: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(dprCap);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearAlpha(0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.xr.enabled = true;
renderer.xr.setFramebufferScaleFactor(0.9);
document.body.insertBefore(renderer.domElement, document.body.firstChild);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.004, 20);
const hemi = new THREE.HemisphereLight(0xfff4e8, 0x5c5640, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dd, 7.5);
sun.position.set(0.6, 1.4, 0.4);
scene.add(sun);
const HEMI_IDLE = hemi.intensity;
const SUN_IDLE = sun.intensity;

let fallbackEnv = null;
try {
  const pmrem = new THREE.PMREMGenerator(renderer);
  fallbackEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = fallbackEnv;
} catch (e) { /* direct lights still shade the rock */ }

const ctx = {
  THREE, GLTFLoader, MeshoptDecoder, scene, camera, renderer, card, muteBtn,
  setHint,
  getControls: () => controls,
};
const factories = {
  volcano: () => createVolcanoExperiment(ctx),
  circuit: () => createCircuitExperiment(ctx),
};
const experiments = {};
let active = null;
let placedPose = null;

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.055, 0.075, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false }),
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);
const reticleDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.012, 16).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xfff4b0, toneMapped: false, depthTest: false }),
);
reticle.add(reticleDot);
const smoothedPos = new THREE.Vector3();
const smoothedNor = new THREE.Vector3(0, 1, 0);
const targetPos = new THREE.Vector3();
const targetNor = new THREE.Vector3(0, 1, 0);
const basisX = new THREE.Vector3();
const basisZ = new THREE.Vector3();
let reticleHave = false, reticleMiss = 0, reticleShown = 0;

function showReticle(pos, nor, dt, time) {
  targetPos.copy(pos);
  targetNor.copy(nor).normalize();
  if (!reticleHave) { smoothedPos.copy(targetPos); smoothedNor.copy(targetNor); reticleHave = true; }
  else {
    const k = 1 - Math.exp(-12 * dt);
    smoothedPos.lerp(targetPos, k);
    smoothedNor.lerp(targetNor, k).normalize();
  }
  const pulse = 1 + 0.05 * Math.sin(time * 5);
  basisX.set(1, 0, 0);
  if (Math.abs(smoothedNor.y) > 0.95) basisX.set(1, 0, 0);
  else basisX.set(0, 1, 0);
  basisX.cross(smoothedNor).normalize().multiplyScalar(pulse);
  basisZ.crossVectors(smoothedNor, basisX);
  reticle.matrix.makeBasis(basisX, smoothedNor, basisZ);
  reticle.matrix.setPosition(smoothedPos);
  reticle.visible = true;
  reticleMiss = 0;
  reticleShown += dt;
}
function hideReticle(dt) {
  reticleMiss += dt;
  reticleShown = 0;
  if (reticleMiss > 0.45) { reticle.visible = false; reticleHave = false; }
}

const MIN_PLANE_AREA = 0.1;
const vA = new THREE.Vector3(), vC = new THREE.Vector3();
const rayOrigin = new THREE.Vector3(), rayDir = new THREE.Vector3(), forward = new THREE.Vector3();
const hitPoint = new THREE.Vector3();
const qCam = new THREE.Quaternion();

function polygonAreaXZ(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) * 0.5;
}
function pointInPolyXZ(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, zi = poly[i].z, xj = poly[j].x, zj = poly[j].z;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-8) + xi) inside = !inside;
  }
  return inside;
}
function distPointSeg(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1e-8)));
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}
function distToPolyXZ(x, z, poly) {
  if (pointInPolyXZ(x, z, poly)) return 0;
  let best = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    best = Math.min(best, distPointSeg(x, z, a.x, a.z, b.x, b.z));
  }
  return best;
}

const RAY_DEFS = [[0, 0], [16, 0], [28, 0], [40, 0], [24, -16], [24, 16]];
function viewerDir(pitchDeg, yawDeg, target) {
  const p = pitchDeg * Math.PI / 180, y = yawDeg * Math.PI / 180;
  return target.set(Math.sin(y) * Math.cos(p), -Math.sin(p), -Math.cos(y) * Math.cos(p)).applyQuaternion(qCam).normalize();
}
const PLANE_HITS = Array.from({ length: 24 }, () => ({
  point: new THREE.Vector3(), t: 0, normal: new THREE.Vector3(), plane: null, center: false,
}));
function considerPlaneRay(info, pitch, yaw, center, hitCount) {
  if (hitCount >= PLANE_HITS.length) return hitCount;
  viewerDir(pitch, yaw, rayDir);
  const normal = info.normal;
  let nSign = 1;
  let denom = normal.dot(rayDir);
  if (denom > 0) { denom = -denom; nSign = -1; }
  if (denom > -1e-4) return hitCount;
  const t = (
    nSign * normal.x * (info.origin.x - rayOrigin.x) +
    nSign * normal.y * (info.origin.y - rayOrigin.y) +
    nSign * normal.z * (info.origin.z - rayOrigin.z)
  ) / denom;
  if (t < 0.28 || t > 2.15) return hitCount;
  hitPoint.copy(rayOrigin).addScaledVector(rayDir, t);
  const lx = (hitPoint.x - info.origin.x) * info.xAxis.x + (hitPoint.y - info.origin.y) * info.xAxis.y + (hitPoint.z - info.origin.z) * info.xAxis.z;
  const lz = (hitPoint.x - info.origin.x) * info.zAxis.x + (hitPoint.y - info.origin.y) * info.zAxis.y + (hitPoint.z - info.origin.z) * info.zAxis.z;
  if (distToPolyXZ(lx, lz, info.poly) > 0.05) return hitCount;
  const slot = PLANE_HITS[hitCount];
  slot.point.copy(hitPoint);
  slot.t = t;
  slot.normal.copy(normal);
  slot.plane = info.plane;
  slot.center = center;
  return hitCount + 1;
}

let stickyPlane = null;
const HIT_POOL = Array.from({ length: 12 }, () => ({ p: new THREE.Vector3(), n: new THREE.Vector3(), dist: 0, ray: 0 }));
let lockedY = null, highOnly = 0, agreeTime = 0;
const lastCand = new THREE.Vector3();

function resetPlacement() {
  stickyPlane = null; lockedY = null; highOnly = 0; agreeTime = 0;
  reticle.visible = false; reticleHave = false; reticleMiss = 1; reticleShown = 0;
}
function eachPlane(set, fn) {
  if (!set) return;
  if (typeof set.forEach === 'function') set.forEach(fn);
  else for (const plane of set) fn(plane);
}
function collectLargePlanes(frame, refSpace) {
  const out = [];
  eachPlane(frame.detectedPlanes, (plane) => {
    try {
      const poly = plane.polygon;
      if (!poly || poly.length < 3) return;
      const label = String(plane.semanticLabel || '').toLowerCase();
      if (/ceiling|wall|window|door|screen|monitor/.test(label)) return;
      const pose = frame.getPose(plane.planeSpace, refSpace);
      if (!pose) return;
      const e = pose.transform.matrix;
      vA.set(e[4], e[5], e[6]);
      if (plane.orientation === 'vertical') return;
      if (plane.orientation !== 'horizontal' && Math.abs(vA.y) < 0.82) return;
      if (vA.y < 0) return;
      const area = polygonAreaXZ(poly);
      if (area < MIN_PLANE_AREA) return;
      out.push({
        plane, area, poly,
        origin: new THREE.Vector3(e[12], e[13], e[14]),
        xAxis: new THREE.Vector3(e[0], e[1], e[2]),
        zAxis: new THREE.Vector3(e[8], e[9], e[10]),
        normal: vA.clone(),
      });
    } catch (err) { /* plane ended this frame */ }
  });
  return out;
}
function countTrackedPlanes(frame) {
  let n = 0;
  eachPlane(frame.detectedPlanes, () => { n++; });
  return n;
}
function pickPlaneHit(planes) {
  let n = 0;
  for (const info of planes) {
    for (let r = 0; r < RAY_DEFS.length; r++) {
      n = considerPlaneRay(info, RAY_DEFS[r][0], RAY_DEFS[r][1], r === 0, n);
    }
  }
  if (!n) return null;
  let yMax = -Infinity;
  for (let i = 0; i < n; i++) if (PLANE_HITS[i].t < 1.6) yMax = Math.max(yMax, PLANE_HITS[i].point.y);
  if (yMax === -Infinity) yMax = PLANE_HITS[0].point.y;
  let best = null, sticky = null, center = null;
  for (let i = 0; i < n; i++) {
    const h = PLANE_HITS[i];
    if (h.point.y < yMax - 0.05) continue;
    if (h.plane === stickyPlane) sticky = h;
    if (h.center && (!center || h.t < center.t)) center = h;
    if (!best || h.t < best.t) best = h;
  }
  const chosen = (center && (!best || center.t < best.t + 0.35)) ? center : (sticky && best && best.t > sticky.t - 0.12 ? sticky : best);
  if (chosen) stickyPlane = chosen.plane;
  return chosen;
}
function pickHitTest(frame, refSpace, sources, shallow) {
  let n = 0, minY = Infinity;
  for (let s = 0; s < sources.length; s++) {
    const results = frame.getHitTestResults(sources[s].source);
    if (!results || !results.length) continue;
    const pose = results[0].getPose(refSpace);
    if (!pose) continue;
    const e = pose.transform.matrix;
    const slot = HIT_POOL[n];
    slot.p.set(e[12], e[13], e[14]);
    slot.n.set(e[4], e[5], e[6]);
    if (slot.n.y < 0.75) continue;
    slot.dist = slot.p.distanceTo(rayOrigin);
    if (slot.dist < 0.28 || slot.dist > 2.15) continue;
    slot.ray = sources[s].pitch;
    if (slot.p.y < minY) minY = slot.p.y;
    n++;
    if (n >= HIT_POOL.length) break;
  }
  if (!n) return null;
  const low = [];
  for (let i = 0; i < n; i++) if (HIT_POOL[i].p.y <= minY + 0.04) low.push(HIT_POOL[i]);
  if (lockedY !== null) {
    const good = [];
    for (let i = 0; i < n; i++) {
      const h = HIT_POOL[i];
      if (h.p.y < lockedY - 0.03 || Math.abs(h.p.y - lockedY) <= 0.035) good.push(h);
    }
    if (!good.length) return null;
    good.sort((a, b) => a.dist - b.dist);
    if (good[0].p.y < lockedY - 0.03) lockedY = good[0].p.y;
    return good[0];
  }
  let span = 0;
  for (let i = 0; i < low.length; i++) {
    for (let j = i + 1; j < low.length; j++) {
      const dx = low[i].p.x - low[j].p.x, dz = low[i].p.z - low[j].p.z;
      span = Math.max(span, Math.hypot(dx, dz));
    }
  }
  if (shallow && (low.length < 2 || span < 0.16)) return null;
  low.sort((a, b) => a.dist - b.dist);
  lockedY = low[0].p.y;
  return low[0];
}

let controls = null, previewGroup = null;
function applyPreviewCamera(exp) {
  const p = exp.preview;
  camera.fov = p.fov;
  camera.near = p.near;
  camera.updateProjectionMatrix();
  camera.position.set(p.position[0], p.position[1], p.position[2]);
  controls.target.set(p.target[0], p.target[1], p.target[2]);
  controls.minDistance = p.minDistance;
  controls.maxDistance = p.maxDistance;
  controls.maxPolarAngle = p.maxPolarAngle;
  controls.update();
}
function startPreview() {
  if (!active) return;
  scene.background = new THREE.Color(0xc5e6f6);
  scene.environment = fallbackEnv;
  hemi.intensity = HEMI_IDLE;
  sun.intensity = SUN_IDLE;
  sun.position.set(0.6, 1.4, 0.4);
  sun.color.setHex(0xfff1dd);
  if (previewGroup) scene.remove(previewGroup);
  previewGroup = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.78),
    new THREE.MeshStandardMaterial({ color: 0xc4926a, roughness: 0.72, metalness: 0.02 }));
  table.position.y = -0.02;
  previewGroup.add(table);
  scene.add(previewGroup);
  active.root.position.set(0, 0, 0);
  active.root.rotation.set(0, 0, 0);
  active.root.visible = true;
  if (controls) controls.dispose();
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  applyPreviewCamera(active);
  syncButtons();
  setHint(active.hints.preview);
  active.onPlaced?.();
}
function stopPreview() {
  if (previewGroup) { scene.remove(previewGroup); previewGroup = null; }
  if (controls) { controls.dispose(); controls = null; }
  scene.background = null;
  scene.environment = null;
}

let hitSources = [], xrSession = null, planeDetectionOn = false, lightProbe = null;
const xrLightProbe = new THREE.LightProbe();
xrLightProbe.intensity = 0;

function makeOffsetRay(pitchDeg, yawDeg) {
  const p = pitchDeg * Math.PI / 180, y = yawDeg * Math.PI / 180;
  const dir = {
    x: Math.sin(y) * Math.cos(p),
    y: -Math.sin(p),
    z: -Math.cos(y) * Math.cos(p),
    w: 0,
  };
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  dir.x /= len; dir.y /= len; dir.z /= len;
  return new XRRay({ x: 0, y: 0, z: 0, w: 1 }, dir);
}
function rememberPose() {
  if (!active?.root.visible) { placedPose = null; return; }
  placedPose = {
    position: active.root.position.clone(),
    rotation: active.root.rotation.clone(),
  };
}
async function startAR() {
  let session;
  try {
    session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'local-floor', 'plane-detection', 'light-estimation'],
      domOverlay: { root: overlay },
    });
  } catch (e) {
    setHint('Nu am putut porni AR 😕 (' + (e && e.message ? e.message : e) + ')');
    return;
  }
  xrSession = session;
  stopPreview();
  active?.onLift?.();
  if (active) active.root.visible = false;
  resetPlacement();
  placedPose = null;
  eruptBtn.hidden = true; arBtn.hidden = true; exitBtn.hidden = false; card.hidden = true;
  resetBtn.hidden = true;
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  if (active?.wantsEnvironment) scene.environment = fallbackEnv;
  setHint(HINT_LIFT);
  syncButtons();

  const features = session.enabledFeatures ? Array.from(session.enabledFeatures) : [];
  planeDetectionOn = features.includes('plane-detection');
  const viewerSpace = await session.requestReferenceSpace('viewer');
  hitSources = [];
  for (const [pitch, yaw] of RAY_DEFS) {
    try {
      const source = await session.requestHitTestSource({
        space: viewerSpace,
        entityTypes: ['plane'],
        offsetRay: pitch === 0 && yaw === 0 ? undefined : makeOffsetRay(pitch, yaw),
      });
      hitSources.push({ source, pitch });
    } catch (e) { /* this ray is not supported */ }
  }
  if (!hitSources.length) {
    try {
      const source = await session.requestHitTestSource({ space: viewerSpace });
      hitSources.push({ source, pitch: 0 });
    } catch (e) { /* placement will wait */ }
  }
  if (features.includes('light-estimation') && session.requestLightProbe) {
    try { lightProbe = await session.requestLightProbe(); } catch (e) { lightProbe = null; }
  }

  overlay.querySelectorAll('button, #touch').forEach((b) => {
    b.addEventListener('beforexrselect', (ev) => ev.preventDefault());
  });
  session.addEventListener('select', () => {
    if (!active || active.root.visible || !reticle.visible || reticleShown < 0.12) return;
    active.root.position.copy(smoothedPos);
    const camPos = new THREE.Vector3().setFromMatrixPosition(renderer.xr.getCamera().matrixWorld);
    active.root.rotation.set(0, Math.atan2(camPos.x - active.root.position.x, camPos.z - active.root.position.z), 0);
    active.root.visible = true;
    reticle.visible = false;
    rememberPose();
    syncButtons();
    setHint(active.hints.placed);
    active.onPlaced?.();
  });
  session.addEventListener('end', () => {
    for (const s of hitSources) { try { s.source.cancel(); } catch (e) { /* already ended */ } }
    hitSources = []; xrSession = null; lightProbe = null; planeDetectionOn = false;
    scene.remove(xrLightProbe); xrLightProbe.intensity = 0;
    reticle.visible = false; exitBtn.hidden = true; resetBtn.hidden = true; arBtn.hidden = false;
    touch.hidden = true;
    renderer.setAnimationLoop(null);
    startPreview();
    renderer.setAnimationLoop(loop);
  });
}

function applyLightEstimate(est) {
  const sh = est.sphericalHarmonicsCoefficients;
  if (sh && sh.length >= 27) {
    xrLightProbe.sh.fromArray(sh);
    xrLightProbe.intensity = 1;
    if (!xrLightProbe.parent) scene.add(xrLightProbe);
  }
  const ix = est.primaryLightIntensity.x, iy = est.primaryLightIntensity.y, iz = est.primaryLightIntensity.z;
  const scale = Math.max(1, ix, iy, iz);
  sun.color.setRGB(ix / scale, iy / scale, iz / scale);
  sun.intensity = scale;
  sun.position.set(est.primaryLightDirection.x, est.primaryLightDirection.y, est.primaryLightDirection.z);
  hemi.intensity = 0.18;
}

function updatePlacement(frame, dt, time) {
  if (!frame || !active || active.root.visible) return;
  const refSpace = renderer.xr.getReferenceSpace();
  const viewer = frame.getViewerPose(refSpace);
  if (!viewer) { hideReticle(dt); setHint(HINT_LIFT); return; }
  const o = viewer.transform.orientation, p = viewer.transform.position;
  qCam.set(o.x, o.y, o.z, o.w);
  rayOrigin.set(p.x, p.y, p.z);
  forward.set(0, 0, -1).applyQuaternion(qCam);
  const shallow = forward.y > -0.45;

  let placed = null;
  let sawPlanes = false;
  if (planeDetectionOn && frame.detectedPlanes) {
    sawPlanes = countTrackedPlanes(frame) > 0;
    const planes = collectLargePlanes(frame, refSpace);
    const hit = planes.length ? pickPlaneHit(planes) : null;
    if (hit) {
      placed = hit;
      lockedY = hit.point.y;
    }
  }
  const allowHitTest = !planeDetectionOn || !sawPlanes;
  if (!placed && allowHitTest && hitSources.length) {
    const hit = pickHitTest(frame, refSpace, hitSources, shallow);
    if (hit && (lockedY === null || hit.p.y <= lockedY + 0.035)) {
      if (lastCand.distanceTo(hit.p) < 0.06) agreeTime += dt; else agreeTime = 0;
      lastCand.copy(hit.p);
      if (!shallow || agreeTime > 0.12) placed = { point: hit.p, normal: hit.n };
    } else if (lockedY !== null) {
      highOnly += dt;
      if (highOnly > 1.1) { lockedY = null; highOnly = 0; }
    }
  }
  if (placed) {
    const pos = placed.point || placed.p;
    const nor = placed.normal || placed.n;
    vC.copy(pos).addScaledVector(nor, 0.005);
    showReticle(vC, nor, dt, time);
    setHint(active.hints.found);
  } else {
    hideReticle(dt);
    if (!reticle.visible) setHint(shallow || planeDetectionOn ? HINT_LIFT : HINT_SCAN);
  }
}

function syncButtons() {
  const exp = active;
  const inAR = !!xrSession;
  const showing = !!(exp && exp.root.visible);
  eruptBtn.hidden = !(exp && exp.primaryLabel && showing);
  if (exp?.primaryLabel) eruptBtn.textContent = exp.primaryLabel;
  resetBtn.hidden = !(inAR && showing);
  if (exp) resetBtn.textContent = exp.moveLabel;
  const circuit = exp?.id === 'circuit' && showing;
  electronsBtn.hidden = !circuit;
  circuitResetBtn.hidden = !circuit;
  switchBtn.hidden = !exp;
  muteBtn.hidden = exp?.id === 'circuit';
  touch.hidden = !(inAR && circuit);
  const title = exp?.id === 'circuit' ? '💡 AR Play Lab' : exp?.id === 'volcano' ? '🌋 AR Play Lab' : '🔬 AR Play Lab';
  $('title').textContent = title;
  if (exp?.id === 'circuit') card.hidden = true;
}

function applyEnvironmentFor(exp) {
  if (!xrSession) return;
  scene.environment = exp?.wantsEnvironment ? fallbackEnv : null;
}

async function selectExperiment(id) {
  if (!factories[id]) return;
  switcher.hidden = true;
  picker.hidden = true;
  if (active?.id === id && experiments[id]) {
    syncButtons();
    return;
  }
  const previous = active;
  const keepPose = previous?.root.visible ? {
    position: previous.root.position.clone(),
    rotation: previous.root.rotation.clone(),
  } : placedPose;
  if (previous) {
    previous.onLeave?.();
    previous.root.visible = false;
  }
  loader.hidden = false;
  loaderText.textContent = 'Se încarcă…';
  loadBar.style.width = '8%';
  try {
    if (!experiments[id]) experiments[id] = factories[id]();
    const exp = experiments[id];
    loaderText.textContent = exp.loaderText;
    await exp.load((t) => { loadBar.style.width = Math.round(t * 100) + '%'; });
    active = exp;
    applyEnvironmentFor(exp);
    if (xrSession) {
      if (keepPose) {
        exp.root.position.copy(keepPose.position);
        exp.root.rotation.copy(keepPose.rotation);
        exp.root.visible = true;
        placedPose = keepPose;
        reticle.visible = false;
        syncButtons();
        setHint(exp.hints.placed);
        exp.onPlaced?.();
      } else {
        exp.root.visible = false;
        resetPlacement();
        syncButtons();
        setHint(HINT_LIFT);
      }
    } else {
      startPreview();
      if (arOK) {
        arBtn.hidden = false;
        if (exp.hints.ready && exp.id === 'volcano') setHint(exp.hints.ready);
      } else if (!window.isSecureContext) {
        setHint('AR are nevoie de HTTPS. Deocamdată, joacă-te în modul 3D 👇');
      }
    }
  } catch (e) {
    setHint('Nu am putut încărca experimentul. Reîncarcă pagina.');
    if (previous && !xrSession) {
      active = previous;
      startPreview();
    }
  } finally {
    loader.hidden = true;
  }
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function rayFromEvent(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  ndc.set(x, y);
  let cam = camera;
  if (renderer.xr.isPresenting) {
    const xrCam = renderer.xr.getCamera();
    cam = xrCam.cameras && xrCam.cameras.length ? xrCam.cameras[0] : xrCam;
  }
  raycaster.setFromCamera(ndc, cam);
  return raycaster;
}
function pointerDown(ev) {
  if (!active?.onPointerDown) return;
  if (active.onPointerDown(rayFromEvent(ev))) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.currentTarget.setPointerCapture) {
      try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
    }
    if (controls) controls.enabled = false;
  }
}
function pointerMove(ev) {
  if (!active?.onPointerMove) return;
  if (active.onPointerMove(rayFromEvent(ev))) ev.preventDefault();
}
function pointerUp(ev) {
  if (!active?.onPointerUp) return;
  active.onPointerUp();
  if (controls && !xrSession) controls.enabled = true;
}
renderer.domElement.addEventListener('pointerdown', pointerDown, true);
touch.addEventListener('pointerdown', pointerDown);
touch.addEventListener('pointermove', pointerMove);
touch.addEventListener('pointerup', pointerUp);
touch.addEventListener('pointercancel', pointerUp);
renderer.domElement.addEventListener('pointermove', pointerMove);
renderer.domElement.addEventListener('pointerup', pointerUp);

const clock = new THREE.Clock();
function loop(timeMs, frame) {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (frame && lightProbe) {
    try {
      const est = frame.getLightEstimate(lightProbe);
      if (est) applyLightEstimate(est);
    } catch (e) { /* probe not ready */ }
  }
  if (xrSession && active && !active.root.visible) updatePlacement(frame, dt, timeMs * 0.001);
  if (controls && controls.enabled) controls.update();
  if (active) active.update(dt, timeMs * 0.001);
  renderer.render(scene, camera);
}

eruptBtn.addEventListener('click', () => active?.onPrimary?.());
arBtn.addEventListener('click', startAR);
exitBtn.addEventListener('click', () => xrSession && xrSession.end());
$('cardClose').addEventListener('click', () => { card.hidden = true; });
resetBtn.addEventListener('click', () => {
  if (!active) return;
  active.onLift?.();
  active.root.visible = false;
  placedPose = null;
  resetPlacement();
  card.hidden = true;
  syncButtons();
  setHint(active.hints.move);
});
circuitResetBtn.addEventListener('click', () => active?.reset?.());
electronsBtn.addEventListener('click', () => {
  if (!active?.toggleElectrons) return;
  const on = active.toggleElectrons();
  electronsBtn.classList.toggle('on', on);
  electronsBtn.textContent = on ? '✦ Electroni: pornit' : '✦ Electroni';
});
switchBtn.addEventListener('click', () => { switcher.hidden = !switcher.hidden; });
$('switchStay').addEventListener('click', () => { switcher.hidden = true; });
picker.addEventListener('click', (ev) => {
  const id = ev.target.closest('button')?.dataset.exp;
  if (id) selectExperiment(id);
});
switcher.addEventListener('click', (ev) => {
  const id = ev.target.closest('button')?.dataset.exp;
  if (id) selectExperiment(id);
});
window.addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let arOK = false;
async function init() {
  try { arOK = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch (e) { arOK = false; }
  renderer.setAnimationLoop(loop);
  window.__arPlayLab = {
    arOK,
    choose: selectExperiment,
    erupt: () => experiments.volcano?.onPrimary?.(),
    particles: () => experiments.volcano?.particles?.() ?? 0,
    focusCrater: () => experiments.volcano?.focusCrater?.(),
    focusRim: () => experiments.volcano?.focusRim?.(),
    focusSide: () => experiments.volcano?.focusSide?.(),
    focusCircuit: (mode) => experiments.circuit?.focus?.(camera, controls, mode || 'wide'),
    connectCircuit: () => experiments.circuit?.connectAll?.(),
    debugCircuit: () => experiments.circuit?.debugState?.(),
    resetCircuit: () => experiments.circuit?.reset?.(),
  };
}
init();
