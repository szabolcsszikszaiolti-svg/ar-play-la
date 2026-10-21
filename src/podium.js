import * as THREE from 'three';

const PLACES = [
  { place: 1, x: 0, h: 0.102, z: 0 },
  { place: 2, x: -0.118, h: 0.07, z: 0 },
  { place: 3, x: 0.118, h: 0.05, z: 0 },
];
const STEP_W = 0.112;
const STEP_D = 0.1;

export function createPodium() {
  const root = new THREE.Group();
  root.name = 'podium';
  root.visible = false;

  const wood = new THREE.MeshPhysicalMaterial({
    color: 0xc4a67a,
    roughness: 0.32,
    metalness: 0,
    clearcoat: 0.78,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.62,
  });
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xf2c14d,
    metalness: 1,
    roughness: 0.14,
    clearcoat: 0.35,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.7,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.38,
    envMapIntensity: 1.15,
  });

  const steps = [];
  for (const spec of PLACES) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(STEP_W, spec.h, STEP_D), wood);
    mesh.position.y = spec.h / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const numeral = new THREE.Mesh(
      new THREE.PlaneGeometry(STEP_W * 0.62, spec.h * 0.46),
      new THREE.MeshBasicMaterial({ map: numeralTexture(spec.place), transparent: true, depthWrite: false }),
    );
    numeral.position.set(0, spec.h * 0.62, STEP_D / 2 + 0.001);
    group.add(numeral);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(STEP_W * 0.9, 0.016, 0.003), brass.clone());
    plate.position.set(0, 0.012, STEP_D / 2 + 0.0022);
    plate.castShadow = true;
    group.add(plate);

    group.position.set(spec.x, 0, spec.z);
    root.add(group);
    steps.push({ ...spec, group, plate, nameMap: null });
  }

  const trophy = makeTrophy(THREE, gold);
  root.add(trophy);

  const confetti = makeConfetti(THREE);
  root.add(confetti.mesh);

  let shown = '';

  function show(ranking) {
    root.visible = true;
    const top = ranking || [];
    const key = top.map((row) => `${row.place}:${row.nick}`).join('|');
    if (key === shown) return;
    shown = key;
    for (const step of steps) {
      const row = top[step.place - 1];
      step.group.visible = !!row;
      if (step.nameMap) {
        step.plate.material.map = null;
        step.nameMap.dispose();
        step.nameMap = null;
      }
      if (!row) continue;
      step.nameMap = plateTexture(row.nick);
      step.plate.material.map = step.nameMap;
      step.plate.material.needsUpdate = true;
    }
    const first = steps[0];
    trophy.visible = top.length > 0;
    trophy.position.set(first.x, first.h, first.z);
  }

  function hide() {
    root.visible = false;
    shown = '';
  }

  function update(dt) {
    if (!root.visible) return;
    confetti.update(dt);
  }

  const ready = loadWood(THREE).then((maps) => {
    wood.map = maps.albedo;
    wood.normalMap = maps.normal;
    wood.color.set(0xffffff);
    wood.needsUpdate = true;
  }).catch(() => {});

  return { root, show, hide, update, ready };
}

function makeTrophy(THREE, gold) {
  const cupPts = [
    new THREE.Vector2(0.022, 0),
    new THREE.Vector2(0.04, 0.005),
    new THREE.Vector2(0.034, 0.012),
    new THREE.Vector2(0.014, 0.022),
    new THREE.Vector2(0.016, 0.04),
    new THREE.Vector2(0.028, 0.058),
    new THREE.Vector2(0.048, 0.092),
    new THREE.Vector2(0.056, 0.118),
    new THREE.Vector2(0.048, 0.13),
    new THREE.Vector2(0.02, 0.136),
    new THREE.Vector2(0, 0.138),
  ];
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 48), gold);
  cup.castShadow = true;
  const handleGeo = new THREE.TorusGeometry(0.022, 0.0042, 10, 22);
  const left = new THREE.Mesh(handleGeo, gold);
  left.position.set(-0.052, 0.1, 0);
  left.castShadow = true;
  const right = new THREE.Mesh(handleGeo, gold);
  right.position.set(0.052, 0.1, 0);
  right.castShadow = true;
  const trophy = new THREE.Group();
  trophy.add(cup, left, right);
  return trophy;
}

function makeConfetti(THREE) {
  const count = 36;
  const geo = new THREE.BoxGeometry(0.0045, 0.007, 0.00035);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe8c15a, metalness: 1, roughness: 0.28, envMapIntensity: 1.3,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const bits = [];
  for (let i = 0; i < count; i++) bits.push(resetBit({}));
  function update(dt) {
    const step = Math.min(0.05, dt);
    for (let i = 0; i < count; i++) {
      const bit = bits[i];
      bit.vy -= 0.28 * step;
      bit.x += bit.vx * step;
      bit.y += bit.vy * step;
      bit.z += bit.vz * step;
      bit.rx += bit.vrx * step;
      bit.ry += bit.vry * step;
      if (bit.y < 0.004) resetBit(bit);
      dummy.position.set(bit.x, bit.y, bit.z);
      dummy.rotation.set(bit.rx, bit.ry, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { mesh, update };
}

function resetBit(bit) {
  bit.x = (Math.random() - 0.5) * 0.28;
  bit.y = 0.18 + Math.random() * 0.28;
  bit.z = (Math.random() - 0.5) * 0.16;
  bit.vx = (Math.random() - 0.5) * 0.06;
  bit.vy = -0.04 - Math.random() * 0.06;
  bit.vz = (Math.random() - 0.5) * 0.04;
  bit.rx = Math.random() * Math.PI;
  bit.ry = Math.random() * Math.PI;
  bit.vrx = (Math.random() - 0.5) * 2.4;
  bit.vry = (Math.random() - 0.5) * 2.4;
  return bit;
}

function numeralTexture(n) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 188px Georgia, "Times New Roman", serif';
  g.fillStyle = 'rgba(255, 236, 206, 0.35)';
  g.fillText(String(n), 128, 122);
  g.fillStyle = 'rgba(36, 22, 10, 0.88)';
  g.fillText(String(n), 128, 132);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function plateTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#c6a15a';
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = 'rgba(80, 52, 18, 0.18)';
  for (let y = 2; y < 96; y += 3) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 54;
  g.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  while (size > 26 && g.measureText(text).width > 470) {
    size -= 2;
    g.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  }
  g.fillStyle = 'rgba(255, 236, 200, 0.45)';
  g.fillText(text, 256, 44);
  g.fillStyle = '#3a2814';
  g.fillText(text, 256, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function loadWood(THREE) {
  const texLoader = new THREE.TextureLoader();
  const loadTex = (file, color) => new Promise((resolve, reject) => {
    texLoader.load(new URL('../assets/' + file, import.meta.url).href, (tex) => {
      tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      resolve(tex);
    }, undefined, reject);
  });
  return Promise.all([
    loadTex('wood_albedo.webp', true),
    loadTex('wood_normal.webp', false),
  ]).then(([albedo, normal]) => {
    albedo.repeat.set(0.6, 0.45);
    normal.repeat.set(0.6, 0.45);
    return { albedo, normal };
  });
}
