// Geometry and materials carried over from the approved circuit (cbfeac7).
// Each bulb owns its filament, glass, halo and point light so series bulbs can dim apart.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TOP = 0.018;
const WIRE_R = 0.00125;

export function createFactory(THREE, renderer) {
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a45, metalness: 1, roughness: 0.32, envMapIntensity: 1.05 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xd4894a, metalness: 1, roughness: 0.16, envMapIntensity: 1.35 });
  const nickel = new THREE.MeshStandardMaterial({ color: 0xc5c8ce, metalness: 1, roughness: 0.28, envMapIntensity: 1.1 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa7adb4, metalness: 1, roughness: 0.35, envMapIntensity: 1.05 });
  const absBlack = new THREE.MeshPhysicalMaterial({ color: 0x1a1c1f, metalness: 0.02, roughness: 0.42, clearcoat: 0.18, clearcoatRoughness: 0.4 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xa89880, metalness: 0, roughness: 0.62, envMapIntensity: 0.3 });
  const phenolic = new THREE.MeshStandardMaterial({ color: 0x241c18, metalness: 0.04, roughness: 0.48, envMapIntensity: 0.25 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85, metalness: 0 });
  function pvcMat(color) {
    return new THREE.MeshPhysicalMaterial({
      color, metalness: 0, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.22, envMapIntensity: 0.4,
    });
  }
  const pvc = { red: pvcMat(0x9a1f24), blue: pvcMat(0x1a3f86), black: pvcMat(0x141414) };
  const tungsten = new THREE.Color(0x8a8d91);
  const heatRed = new THREE.Color(0x7a0c04);
  const heatOrange = new THREE.Color(0xff4e0c);
  const heatWhite = new THREE.Color(0xfff6df);

  const ringGeo = new THREE.TorusGeometry(0.02, 0.0022, 6, 22);
  let labelTex = null;
  let discTex = null;
  let jawLower = null;
  let jawUpper = null;
  let springGeo = null;
  let strandGeo = null;
  let bootGeo = null;

  function anisotropy(tex) {
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    return tex;
  }

  function makeRing() {
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffd23f, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    }));
    mesh.visible = false;
    mesh.rotation.x = Math.PI / 2;
    mesh.raycast = () => {};
    return mesh;
  }

  function labelTexture() {
    if (labelTex) return labelTex;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#f4efe4';
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 900; i++) {
      const v = 220 + Math.random() * 25;
      g.fillStyle = `rgba(${v - 8},${v - 16},${v - 28},0.16)`;
      g.fillRect(Math.random() * 512, Math.random() * 256, 2, 1);
    }
    g.strokeStyle = '#8e1d22';
    g.lineWidth = 10;
    g.strokeRect(18, 18, 476, 220);
    g.fillStyle = '#1a1a1a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const cx of [78, 334]) {
      g.save();
      g.translate(cx, 128);
      g.rotate(Math.PI / 2);
      g.font = 'bold 86px Georgia, "Times New Roman", serif';
      g.fillText('1.5V', 0, -6);
      g.font = 'bold 58px Georgia, serif';
      g.fillText('AA', 0, 58);
      g.restore();
    }
    labelTex = new THREE.CanvasTexture(c);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    labelTex.wrapS = THREE.RepeatWrapping;
    anisotropy(labelTex);
    labelTex.flipY = true;
    return labelTex;
  }

  function cell(parent, x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.00715, 0.00715, 0.046, 36),
      new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.72, metalness: 0.02 }),
    );
    body.rotation.z = Math.PI / 2;
    const plus = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0067, 0.0024, 28), nickel);
    plus.rotation.z = Math.PI / 2;
    plus.position.x = 0.0238;
    const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0025, 0.0015, 18), nickel);
    nub.rotation.z = Math.PI / 2;
    nub.position.x = 0.0256;
    const plusMark = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.00025, 0.00055), absBlack);
    plusMark.position.set(0.0264, 0, 0);
    const plusMark2 = plusMark.clone();
    plusMark2.rotation.x = Math.PI / 2;
    const minus = new THREE.Mesh(new THREE.CylinderGeometry(0.00705, 0.00705, 0.0011, 28), steel);
    minus.rotation.z = Math.PI / 2;
    minus.position.x = -0.0234;
    const minusMark = new THREE.Mesh(new THREE.BoxGeometry(0.00035, 0.0026, 0.0005), absBlack);
    minusMark.position.set(-0.0241, 0, 0);
    g.add(body, plus, nub, minus, plusMark, plusMark2, minusMark);
    g.position.set(x, TOP + 0.012, z);
    parent.add(g);
  }

  function polarity(parent, text, x, z, color) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = color;
    g.font = 'bold 110px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.014, 0.014),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, TOP + 0.0006, z);
    m.raycast = () => {};
    parent.add(m);
  }

  function post(parent, x, z, colorMat, id) {
    const g = new THREE.Group();
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.00205, 0.00205, 0.0062, 20), colorMat);
    stud.position.y = 0.0031;
    g.add(stud);
    for (let i = 0; i < 4; i++) {
      const thread = new THREE.Mesh(new THREE.TorusGeometry(0.00235, 0.0002, 5, 18), colorMat);
      thread.rotation.x = Math.PI / 2;
      thread.position.y = 0.0014 + i * 0.00125;
      g.add(thread);
    }
    const headMat = colorMat.clone();
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0043, 0.0043, 0.0017, 28), headMat);
    head.position.y = 0.0069;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.0054, 0.00035, 0.00065), absBlack);
    slot.position.y = 0.00775;
    g.add(head, slot);
    g.position.set(x, TOP, z);
    parent.add(g);
    const ring = makeRing();
    ring.position.y = 0.015;
    g.add(ring);
    return {
      id, x, z, y: TOP + 0.0069, mesh: head, mat: headMat, ring, group: g,
    };
  }

  function pearProfile() {
    const pts = [];
    const cy = 0.036;
    const rx = 0.0152;
    const ry = 0.0168;
    const neckR = 0.00525;
    const neckY = 0.0132;
    const phiJoin = -Math.acos(Math.min(1, neckR / rx));
    const yJoin = cy + Math.sin(phiJoin) * ry;
    pts.push(new THREE.Vector2(neckR, neckY));
    pts.push(new THREE.Vector2(neckR, yJoin));
    const n = 48;
    for (let i = 1; i <= n; i++) {
      const phi = phiJoin + (i / n) * (Math.PI / 2 - phiJoin);
      const r = i === n ? 0 : rx * Math.cos(phi);
      const y = cy + ry * Math.sin(phi);
      pts.push(new THREE.Vector2(Math.max(0, r), y));
    }
    return pts;
  }

  function coilAlong(path, turns, coilR, tubeR) {
    const spine = new THREE.CatmullRomCurve3(path);
    const steps = turns * 8;
    const pts = [];
    const side = new THREE.Vector3();
    const bin = new THREE.Vector3();
    const up = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = spine.getPointAt(t);
      const tan = spine.getTangentAt(t).normalize();
      side.crossVectors(tan, up);
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
      side.normalize();
      bin.crossVectors(tan, side).normalize();
      const a = t * turns * Math.PI * 2;
      p.addScaledVector(side, Math.cos(a) * coilR);
      p.addScaledVector(bin, Math.sin(a) * coilR);
      pts.push(p);
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, tubeR, 4, false);
  }

  function softDisc() {
    if (discTex) return discTex;
    const s = 64;
    const data = new Uint8Array(s * s * 4);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const d = Math.hypot((x + 0.5) / s * 2 - 1, (y + 0.5) / s * 2 - 1);
        const a = Math.exp(-d * d * 3.2);
        const i = (y * s + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.min(255, a * 255);
      }
    }
    discTex = new THREE.DataTexture(data, s, s);
    discTex.colorSpace = THREE.SRGBColorSpace;
    discTex.needsUpdate = true;
    return discTex;
  }

  function addBulb(parent, x, z, id) {
    const g = new THREE.Group();
    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.008, 0.032, 3, 0.0016), ceramic);
    foot.position.y = 0.004;
    foot.castShadow = true;
    g.add(foot);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.00555, 0.0057, 0.011, 36), brass);
    shell.position.y = 0.0095;
    g.add(shell);
    for (let i = 0; i < 5; i++) {
      const thread = new THREE.Mesh(new THREE.TorusGeometry(0.00585, 0.00032, 6, 32), brass);
      thread.rotation.x = Math.PI / 2;
      thread.position.y = 0.0052 + i * 0.0017;
      g.add(thread);
    }
    const contact = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0024, 0.0012, 16), nickel);
    contact.position.y = 0.0036;
    g.add(contact);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.16,
      transmission: 1,
      thickness: 0.0011,
      ior: 1.5,
      transparent: true,
      attenuationColor: new THREE.Color(0xf7f8f8),
      attenuationDistance: 0.09,
      clearcoat: 0.85,
      clearcoatRoughness: 0.55,
      envMapIntensity: 0.5,
      specularIntensity: 0.45,
      side: THREE.FrontSide,
    });
    const glassGeo = new THREE.LatheGeometry(pearProfile(), 80);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.castShadow = false;
    g.add(glass);
    const rim = new THREE.Mesh(glassGeo, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: true,
      uniforms: {
        tint: { value: new THREE.Color(0xd7e4ee) },
        power: { value: 1.45 },
        strength: { value: 0.92 },
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vP;
        void main() {
          vec3 p = position + normal * 0.0004;
          vec4 world = modelMatrix * vec4(p, 1.0);
          vP = world.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        varying vec3 vN;
        varying vec3 vP;
        uniform vec3 tint;
        uniform float power;
        uniform float strength;
        void main() {
          float ndv = abs(dot(normalize(vN), normalize(cameraPosition - vP)));
          float fres = pow(1.0 - ndv, power);
          gl_FragColor = vec4(tint, fres * strength);
        }
      `,
    }));
    rim.renderOrder = 3;
    rim.raycast = () => {};
    g.add(rim);

    const stemMat = new THREE.MeshPhysicalMaterial({
      color: 0xe8f1f0, roughness: 0.08, transmission: 0.92, thickness: 0.0006, transparent: true, ior: 1.5,
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.00115, 0.016, 16), stemMat);
    stem.position.y = 0.026;
    g.add(stem);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0017, 16, 12), stemMat);
    bead.position.y = 0.0342;
    g.add(bead);

    const leadR = 0.00016;
    const leadMat = new THREE.MeshStandardMaterial({
      color: 0x9aa0a8, metalness: 0.7, roughness: 0.58, envMapIntensity: 0.28,
    });
    const lead = (points) => {
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, leadR, 5, false), leadMat));
    };
    const leftTip = new THREE.Vector3(-0.0064, 0.0432, 0);
    const rightTip = new THREE.Vector3(0.0064, 0.0432, 0);
    const mid = new THREE.Vector3(0, 0.0414, 0);
    lead([
      new THREE.Vector3(-0.0007, 0.022, 0),
      new THREE.Vector3(-0.0007, 0.036, 0),
      new THREE.Vector3(-0.0032, 0.041, 0),
      leftTip,
    ]);
    lead([
      new THREE.Vector3(0.0007, 0.022, 0),
      new THREE.Vector3(0.0007, 0.036, 0),
      new THREE.Vector3(0.0032, 0.041, 0),
      rightTip,
    ]);
    lead([
      new THREE.Vector3(0, 0.0342, 0),
      new THREE.Vector3(0, 0.0396, 0.0004),
      new THREE.Vector3(0.0005, 0.0416, 0),
      mid,
    ]);

    const filamentMat = new THREE.MeshStandardMaterial({
      color: tungsten.clone(),
      metalness: 1,
      roughness: 0.34,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
      envMapIntensity: 1,
    });
    g.add(new THREE.Mesh(coilAlong([leftTip, mid, rightTip], 42, 0.0004, 0.00013), filamentMat));

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDisc(), color: 0xffe2b0, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, toneMapped: false, opacity: 0,
    }));
    halo.position.y = 0.0422;
    halo.scale.set(0.012, 0.012, 1);
    halo.visible = false;
    g.add(halo);

    const light = new THREE.PointLight(0xffc48a, 0, 0.16, 2);
    light.position.set(0, 0.0422, 0);
    g.add(light);

    g.position.set(x, TOP, z);
    parent.add(g);
    const termA = post(parent, x - 0.027, z, brass, id + 'A');
    const termB = post(parent, x + 0.027, z, brass, id + 'B');
    return {
      id, group: g, filamentMat, glassMat, halo, light, heat: 0,
      terminals: [termA, termB],
    };
  }

  function paintBulb(bulb, h) {
    const { filamentMat, glassMat, light, halo } = bulb;
    const clamped = Math.max(0, Math.min(1, h));
    if (clamped < 0.015) {
      filamentMat.color.copy(tungsten);
      filamentMat.emissive.setRGB(0, 0, 0);
      filamentMat.emissiveIntensity = 0;
    } else if (clamped < 0.4) {
      filamentMat.emissive.copy(heatRed).lerp(heatOrange, clamped / 0.4);
      filamentMat.emissiveIntensity = 0.8 + clamped * 2.2;
      filamentMat.color.set(0x3a2a28);
    } else if (clamped < 0.75) {
      filamentMat.emissive.copy(heatOrange).lerp(heatWhite, (clamped - 0.4) / 0.35);
      filamentMat.emissiveIntensity = 1.6 + clamped * 2.4;
      filamentMat.color.copy(filamentMat.emissive).multiplyScalar(0.3);
    } else {
      filamentMat.emissive.copy(heatWhite);
      filamentMat.emissiveIntensity = 2.4 + clamped * 1.6;
      filamentMat.color.set(0xfff3d4);
    }
    glassMat.emissive.setRGB(1, 0.55, 0.22);
    glassMat.emissiveIntensity = clamped * 0.02;
    glassMat.attenuationColor.setRGB(1, 0.97 - clamped * 0.12, 0.92 - clamped * 0.28);
    light.intensity = clamped * 0.05;
    light.color.setRGB(1, 0.72 + clamped * 0.12, 0.45);
    halo.visible = clamped > 0.02;
    halo.material.color.setHex(0xffb56a);
    halo.material.opacity = clamped * 0.32;
    const s = 0.007 + clamped * 0.007;
    halo.scale.set(s, s, 1);
  }

  function jawGeometry(sign) {
    const s = new THREE.Shape();
    const body = -0.00085 * sign;
    const inner = 0.00012 * sign;
    const tooth = 0.00048 * sign;
    s.moveTo(0, body);
    s.lineTo(0.022, body * 0.72);
    s.lineTo(0.022, inner);
    let x = 0.0205;
    for (let i = 0; i < 6; i++) {
      s.lineTo(x, tooth);
      s.lineTo(x - 0.00055, tooth);
      s.lineTo(x - 0.0009, inner);
      s.lineTo(x - 0.0017, inner);
      x -= 0.0017;
    }
    s.lineTo(0.004, inner);
    s.lineTo(0, inner * 1.4);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.0052, bevelEnabled: true, bevelThickness: 0.00012, bevelSize: 0.00012, bevelSegments: 1,
    });
    geo.translate(0, 0, -0.0026);
    geo.rotateY(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const len = pos.getZ(i);
      const taper = 1 - 0.38 * Math.max(0, Math.min(1, len / 0.022));
      pos.setX(i, pos.getX(i) * taper);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function clipParts() {
    if (jawLower) return;
    jawLower = jawGeometry(1);
    jawUpper = jawGeometry(-1);
    const springPts = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const a = t * Math.PI * 2 * 3.2;
      springPts.push(new THREE.Vector3((t - 0.5) * 0.0042, Math.cos(a) * 0.00215, Math.sin(a) * 0.00215));
    }
    springGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 28, 0.00026, 5, false);
    const strands = [];
    const count = 18;
    for (let i = 0; i < count; i++) {
      const ang0 = (i / count) * Math.PI * 2 + 0.2;
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const twist = ang0 + t * Math.PI * 1.5;
        const bundle = 0.00035 + (1 - t) * 0.00115;
        pts.push(new THREE.Vector3(Math.cos(twist) * bundle, Math.sin(twist) * bundle, -0.0032 - t * 0.0075));
      }
      strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.00016, 4, false));
    }
    strandGeo = mergeGeometries(strands, false);
    strands.forEach((g) => g.dispose());
    bootGeo = new THREE.CylinderGeometry(0.00205, 0.00155, 0.0067, 18);
    bootGeo.rotateX(Math.PI / 2);
  }

  function makeClip(bootMat) {
    clipParts();
    const g = new THREE.Group();
    const lower = new THREE.Mesh(jawLower, steel);
    const upper = new THREE.Mesh(jawUpper, steel);
    g.userData.jaws = [lower, upper];
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.00115, 0.00115, 0.0062, 12), steel);
    pin.rotation.z = Math.PI / 2;
    const spring = new THREE.Mesh(springGeo, steel);
    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.z = -0.00985;
    const strands = new THREE.Mesh(strandGeo, copper);
    g.add(lower, upper, pin, spring, boot, strands);
    return g;
  }

  function addBattery(parent, x, z) {
    const holderMat = absBlack.clone();
    const holder = new THREE.Mesh(new RoundedBoxGeometry(0.082, 0.011, 0.038, 3, 0.0014), holderMat);
    holder.position.set(x, TOP + 0.0055, z);
    holder.castShadow = true;
    holder.receiveShadow = true;
    parent.add(holder);
    cell(parent, x, z - 0.008);
    cell(parent, x, z + 0.008);
    for (const zc of [z - 0.008, z + 0.008]) {
      const springPts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const a = t * Math.PI * 2 * 3;
        const p = new THREE.Vector3(x - 0.037 + t * 0.004, TOP + 0.012, zc);
        p.y += Math.cos(a) * 0.0016;
        p.z += Math.sin(a) * 0.0016;
        springPts.push(p);
      }
      parent.add(new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 16, 0.00035, 5, false),
        copper,
      ));
    }
    const plus = post(parent, x + 0.035, z + 0.082, brass, 'bat+');
    const minus = post(parent, x - 0.035, z + 0.082, nickel, 'bat-');
    polarity(parent, '+', x + 0.035, z + 0.064, '#9a2430');
    polarity(parent, '−', x - 0.035, z + 0.064, '#1c1c1c');
    return { holder, holderMat, terminals: [plus, minus] };
  }

  function addSwitch(parent, x, z) {
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.007, 0.03, 3, 0.0015), ceramic);
    base.position.set(x, TOP + 0.0036, z);
    base.castShadow = true;
    parent.add(base);
    const left = post(parent, x - 0.02, z, brass, 'swL');
    const right = post(parent, x + 0.02, z, brass, 'swR');
    const bladeGeo = new THREE.BoxGeometry(0.046, 0.00105, 0.008);
    bladeGeo.translate(0.02, 0, 0);
    const knife = new THREE.Mesh(bladeGeo, brass);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.012, 16), phenolic);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.042, 0, 0);
    knife.add(handle);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0023, 0.0023, 0.014, 16), brass);
    barrel.rotation.x = Math.PI / 2;
    knife.add(barrel);
    const ring = makeRing();
    ring.position.set(0.022, 0.012, 0);
    knife.add(ring);
    parent.add(knife);
    return { knife, ring, terminals: [left, right], left };
  }

  function layoutKnife(sw, on) {
    if (!sw) return;
    sw.knife.position.set(sw.left.x, TOP + 0.0082, sw.left.z);
    sw.knife.rotation.z = on ? -0.03 : 0.68;
  }

  function makeWire(parent, spec, index) {
    const boot = pvc[spec.color] || pvc.black;
    const y = TOP + 0.0042;
    const a = { pos: new THREE.Vector3(spec.ax, y, spec.az), snap: null, clip: makeClip(boot) };
    const b = { pos: new THREE.Vector3(spec.bx, y, spec.bz), snap: null, clip: makeClip(boot) };
    a.rest = a.pos.clone();
    b.rest = b.pos.clone();
    a.which = 'a';
    b.which = 'b';
    a.wireName = spec.name;
    b.wireName = spec.name;
    for (const end of [a, b]) {
      end.ring = makeRing();
      end.ring.position.y = 0.012;
      end.clip.add(end.ring);
      parent.add(end.clip);
    }
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), boot);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    parent.add(mesh);
    return { name: spec.name, a, b, mesh, slack: (index % 2 === 0 ? 1 : -1) * (0.012 + index * 0.004) };
  }

  function approachFor(id) {
    if (id.endsWith('+') || id.endsWith('-')) return new THREE.Vector3(0, 0, 1);
    if (id.endsWith('A') || id.endsWith('L')) return new THREE.Vector3(1, 0, 0);
    if (id.endsWith('B') || id.endsWith('R')) return new THREE.Vector3(-1, 0, 0);
    return new THREE.Vector3(0, 0, 1);
  }

  function orientClip(root, end, other) {
    const tip = end.pos;
    const away = end.snap ? approachFor(end.snap).clone() : tip.clone().sub(other);
    away.y = 0;
    if (away.lengthSq() < 1e-8) away.set(0, 0, 1);
    away.normalize();
    const bite = end.snap ? 0.015 : 0.003;
    end.clip.position.copy(tip).addScaledVector(away, -bite);
    end.clip.position.y = end.snap ? tip.y : TOP + 0.0042;
    root.updateMatrixWorld();
    const look = end.clip.position.clone().add(away);
    root.localToWorld(look);
    end.clip.up.set(0, 1, 0);
    end.clip.lookAt(look);
    const open = end.snap ? 0.07 : 0.52;
    const jaws = end.clip.userData.jaws;
    if (jaws) {
      jaws[0].rotation.x = open;
      jaws[1].rotation.x = -open;
    }
  }

  function rebuildWire(root, wire) {
    orientClip(root, wire.a, wire.b.pos);
    orientClip(root, wire.b, wire.a.pos);
    root.updateMatrixWorld(true);
    const start = wire.a.clip.localToWorld(new THREE.Vector3(0, 0, -0.014));
    const end = wire.b.clip.localToWorld(new THREE.Vector3(0, 0, -0.014));
    root.worldToLocal(start);
    root.worldToLocal(end);
    const boardY = TOP + WIRE_R;
    const anchors = [start];
    if (wire.a.snap && wire.b.snap) {
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const len = Math.hypot(dx, dz) || 1;
      const sx = (-dz / len) * wire.slack;
      const sz = (dx / len) * wire.slack;
      const m1 = new THREE.Vector3().lerpVectors(start, end, 0.35);
      const m2 = new THREE.Vector3().lerpVectors(start, end, 0.65);
      m1.x += sx; m1.z += sz; m1.y = boardY;
      m2.x += sx; m2.z += sz; m2.y = boardY;
      anchors.push(m1, m2);
    }
    anchors.push(end);
    const pts = [];
    for (let s = 0; s < anchors.length - 1; s++) {
      const steps = 5;
      for (let i = 0; i < steps; i++) pts.push(new THREE.Vector3().lerpVectors(anchors[s], anchors[s + 1], i / steps));
    }
    pts.push(anchors[anchors.length - 1].clone());
    for (let i = 1; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1);
      const edge = Math.min(1, Math.min(t, 1 - t) / 0.14);
      pts[i].y = THREE.MathUtils.lerp(pts[i].y, boardY, edge);
    }
    pts[0].copy(start);
    pts[pts.length - 1].copy(end);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    if (wire.mesh.geometry) wire.mesh.geometry.dispose();
    const dist = start.distanceTo(end);
    const segs = Math.max(8, Math.min(48, Math.round(dist * 120)));
    wire.mesh.geometry = dist < 0.012
      ? new THREE.BufferGeometry()
      : new THREE.TubeGeometry(curve, segs, WIRE_R, 8, false);
  }

  async function loadWood() {
    const texLoader = new THREE.TextureLoader();
    const loadTex = (file, color) => new Promise((resolve, reject) => {
      texLoader.load(new URL('../../assets/' + file, import.meta.url).href, (tex) => {
        tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        anisotropy(tex);
        resolve(tex);
      }, undefined, reject);
    });
    const [albedo, normal, rough] = await Promise.all([
      loadTex('wood_albedo.webp', true),
      loadTex('wood_normal.webp', false),
      loadTex('wood_rough.webp', false),
    ]);
    return { albedo, normal, rough };
  }

  function addBoard(parent, wood, width, depth) {
    const mat = new THREE.MeshStandardMaterial({
      map: wood.albedo, normalMap: wood.normal, roughnessMap: wood.rough,
      roughness: 0.92, metalness: 0, envMapIntensity: 0.35,
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(width, 0.014, depth), mat);
    const uv = board.geometry.attributes.uv;
    for (let i = 8; i < 12; i++) uv.setXY(i, uv.getX(i) * 2.4, uv.getY(i) * 1.6);
    uv.needsUpdate = true;
    board.position.y = 0.011;
    board.castShadow = true;
    board.receiveShadow = true;
    parent.add(board);
    const hx = width * 0.42;
    const hz = depth * 0.38;
    for (const [x, z] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.004, 16), rubber);
      foot.position.set(x, 0.002, z);
      parent.add(foot);
    }
    return board;
  }

  return {
    pvc, addBulb, paintBulb, addBattery, addSwitch, layoutKnife, makeWire, rebuildWire, loadWood, addBoard, makeRing,
  };
}
