import * as THREE from 'three';

export function createPodium() {
  const root = new THREE.Group();
  root.name = 'podium';
  root.visible = false;

  const gold = new THREE.MeshStandardMaterial({ color: 0xffd56a, metalness: 1, roughness: 0.28, envMapIntensity: 1.1 });
  const cloth = [
    new THREE.MeshStandardMaterial({ color: 0xf4d35e, roughness: 0.55, metalness: 0.08 }),
    new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.6, metalness: 0.12 }),
    new THREE.MeshStandardMaterial({ color: 0xd0894f, roughness: 0.62, metalness: 0.1 }),
  ];
  const places = [
    { place: 1, x: 0, h: 0.09, z: 0.01 },
    { place: 2, x: -0.105, h: 0.055, z: 0.02 },
    { place: 3, x: 0.105, h: 0.04, z: 0.02 },
  ];
  const steps = [];
  for (const spec of places) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, spec.h, 0.13), cloth[spec.place - 1]);
    mesh.position.set(spec.x, spec.h / 2, spec.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    const label = makeLabel(THREE, String(spec.place));
    label.position.set(spec.x, spec.h + 0.012, spec.z + 0.066);
    root.add(label);
    steps.push({ ...spec, mesh, name: null });
  }

  const cupPts = [
    new THREE.Vector2(0.012, 0),
    new THREE.Vector2(0.02, 0.006),
    new THREE.Vector2(0.016, 0.016),
    new THREE.Vector2(0.009, 0.026),
    new THREE.Vector2(0.016, 0.04),
    new THREE.Vector2(0.03, 0.058),
    new THREE.Vector2(0.031, 0.068),
    new THREE.Vector2(0.012, 0.074),
    new THREE.Vector2(0, 0.078),
  ];
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 40), gold);
  cup.castShadow = true;
  const handleGeo = new THREE.TorusGeometry(0.014, 0.0032, 8, 18);
  const left = new THREE.Mesh(handleGeo, gold);
  left.position.set(-0.028, 0.05, 0);
  const right = new THREE.Mesh(handleGeo, gold);
  right.position.set(0.028, 0.05, 0);
  const trophy = new THREE.Group();
  trophy.add(cup, left, right);
  root.add(trophy);

  function show(ranking) {
    root.visible = true;
    const top = ranking || [];
    for (const step of steps) {
      const row = top[step.place - 1];
      step.mesh.visible = !!row;
      if (step.name) {
        root.remove(step.name);
        step.name.material.map?.dispose();
        step.name.material.dispose();
        step.name = null;
      }
      if (!row) continue;
      const sprite = makeLabel(THREE, row.nick, 512, 128, 56);
      sprite.position.set(step.x, step.h + (step.place === 1 ? 0.18 : 0.11), step.z);
      sprite.scale.set(0.1, 0.028, 1);
      root.add(sprite);
      step.name = sprite;
    }
    const first = steps[0];
    trophy.visible = top.length > 0;
    trophy.position.set(first.x, first.h, first.z);
  }

  function hide() {
    root.visible = false;
  }

  return { root, show, hide };
}

function makeLabel(THREE, text, w = 128, h = 128, size = 80) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#1c2430';
  g.font = `bold ${size}px Trebuchet MS, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.05, 0.05, 1);
  return sprite;
}
