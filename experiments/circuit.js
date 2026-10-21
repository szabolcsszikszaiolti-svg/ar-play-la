// Tabletop battery, switch and bulb. Parts are built in three.js so the
// filament, glass and stripped copper still read from a few centimetres away.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createCircuitExperiment(ctx) {
  const { THREE, scene, renderer } = ctx;
  const TOP = 0.018;
  const root = new THREE.Group();
  root.name = 'circuit';
  root.visible = false;
  scene.add(root);

  const terminals = [];
  const wires = [];
  let switchOn = false;
  let knife = null;
  let filamentMat = null;
  let glassMat = null;
  let bulbLight = null;
  let halo = null;
  let heat = 0;
  let electronsOn = false;
  let drag = null;
  let built = false;
  const dots = [];
  const filamentLocal = new THREE.Vector3();
  const clipLocal = new THREE.Vector3();
  let boardMesh = null;

  const WIRE_R = 0.00125;
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a45, metalness: 1, roughness: 0.32, envMapIntensity: 1.05 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xd4894a, metalness: 1, roughness: 0.16, envMapIntensity: 1.35 });
  const nickel = new THREE.MeshStandardMaterial({ color: 0xc5c8ce, metalness: 1, roughness: 0.28, envMapIntensity: 1.1 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa7adb4, metalness: 1, roughness: 0.35, envMapIntensity: 1.05 });
  const absBlack = new THREE.MeshPhysicalMaterial({ color: 0x1a1c1f, metalness: 0.02, roughness: 0.42, clearcoat: 0.18, clearcoatRoughness: 0.4 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xa89880, metalness: 0, roughness: 0.62, envMapIntensity: 0.3 });
  const phenolic = new THREE.MeshStandardMaterial({ color: 0x241c18, metalness: 0.04, roughness: 0.48, envMapIntensity: 0.25 });
  function pvcMat(color) {
    return new THREE.MeshPhysicalMaterial({
      color, metalness: 0, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.22, envMapIntensity: 0.4,
    });
  }
  const pvc = { red: pvcMat(0x9a1f24), blue: pvcMat(0x1a3f86), black: pvcMat(0x141414) };
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85, metalness: 0 });
  const tungsten = new THREE.Color(0x8a8d91);
  const heatRed = new THREE.Color(0x7a0c04);
  const heatOrange = new THREE.Color(0xff4e0c);
  const heatWhite = new THREE.Color(0xfff6df);

  function anisotropy(tex) {
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    return tex;
  }
  function add(mesh) { root.add(mesh); return mesh; }

  function post(x, z, colorMat, id) {
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
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0043, 0.0043, 0.0017, 28), colorMat);
    head.position.y = 0.0069;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.0054, 0.00035, 0.00065), absBlack);
    slot.position.y = 0.00775;
    g.add(head, slot);
    g.position.set(x, TOP, z);
    add(g);
    head.material = colorMat.clone();
    const t = { id, x, z, y: TOP + 0.0069, mesh: head, mat: head.material };
    t.base = head.material.emissive.clone();
    terminals.push(t);
    return t;
  }

  function makeLabel() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
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
      g.rotate(-Math.PI / 2);
      g.font = 'bold 86px Georgia, "Times New Roman", serif';
      g.fillText('1.5V', 0, -6);
      g.font = 'bold 58px Georgia, serif';
      g.fillText('AA', 0, 58);
      g.restore();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    anisotropy(tex);
    return tex;
  }

  function polarityMark(text, x, z, color) {
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
    add(m);
  }

  function cell(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.00715, 0.00715, 0.046, 36),
      new THREE.MeshStandardMaterial({ map: makeLabel(), roughness: 0.72, metalness: 0.02 }));
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
    add(g);
  }

  function pearProfile() {
    const pts = [];
    const cy = 0.036;
    const rx = 0.0152;
    const ry = 0.0168;
    const neckR = 0.00525;
    const neckY = 0.0132;
    const dyJoin = -Math.sqrt(Math.max(0, 1 - (neckR / rx) ** 2));
    const yJoin = cy + dyJoin * ry;
    pts.push(new THREE.Vector2(neckR, neckY));
    pts.push(new THREE.Vector2(neckR, yJoin));
    const n = 40;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const y = yJoin + u * (cy + ry - yJoin);
      const dy = (y - cy) / ry;
      const r = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      pts.push(new THREE.Vector2(Math.max(0.0004, r), y));
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

  function makeBulb(x, z) {
    const g = new THREE.Group();
    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.008, 0.032, 3, 0.0016), ceramic);
    foot.position.y = 0.004;
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

    glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.025,
      transmission: 1,
      thickness: 0.0011,
      ior: 1.5,
      transparent: true,
      attenuationColor: new THREE.Color(0xf7f8f8),
      attenuationDistance: 0.09,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.45,
      specularIntensity: 1,
      side: THREE.FrontSide,
    });
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pearProfile(), 80), glassMat));

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
    function lead(points) {
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, leadR, 5, false), nickel));
    }
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

    filamentMat = new THREE.MeshStandardMaterial({
      color: tungsten.clone(),
      metalness: 1,
      roughness: 0.34,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
      envMapIntensity: 1,
    });
    const filament = new THREE.Mesh(coilAlong([leftTip, mid, rightTip], 42, 0.0004, 0.00013), filamentMat);
    g.add(filament);
    const filY = 0.0422;
    filamentLocal.set(x, TOP + filY, z);

    halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDisc(), color: 0xffe2b0, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, toneMapped: false, opacity: 0,
    }));
    halo.position.y = filY;
    halo.scale.set(0.012, 0.012, 1);
    g.add(halo);

    bulbLight = new THREE.PointLight(0xffc48a, 0, 0.16, 2);
    bulbLight.position.set(0, filY, 0);
    g.add(bulbLight);

    g.position.set(x, TOP, z);
    add(g);
  }

  function softDisc() {
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
    const tex = new THREE.DataTexture(data, s, s);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function jawGeometry(sign) {
    const s = new THREE.Shape();
    const body = -0.00085 * sign;
    const inner = 0.00012 * sign;
    const tooth = 0.00048 * sign;
    s.moveTo(0, body);
    s.lineTo(0.022, body * 0.72);
    s.lineTo(0.022, inner);
    // Serrations walk back from the tip toward the hinge.
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

  let sharedJawLower = null;
  let sharedJawUpper = null;
  let sharedSpring = null;
  let sharedStrands = null;
  let sharedBoot = null;

  function clipParts() {
    if (sharedJawLower) return;
    sharedJawLower = jawGeometry(1);
    sharedJawUpper = jawGeometry(-1);
    const springPts = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const a = t * Math.PI * 2 * 3.2;
      springPts.push(new THREE.Vector3((t - 0.5) * 0.0042, Math.cos(a) * 0.00215, Math.sin(a) * 0.00215));
    }
    sharedSpring = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 28, 0.00026, 5, false);
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
    sharedStrands = mergeGeometries(strands, false);
    strands.forEach((g) => g.dispose());
    sharedBoot = new THREE.CylinderGeometry(0.0033, 0.0014, 0.008, 18);
    sharedBoot.rotateX(Math.PI / 2);
  }

  function makeClip(bootMat) {
    clipParts();
    const g = new THREE.Group();
    const lower = new THREE.Mesh(sharedJawLower, steel);
    const upper = new THREE.Mesh(sharedJawUpper, steel);
    g.userData.jaws = [lower, upper];
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.00115, 0.00115, 0.0062, 12), steel);
    pin.rotation.z = Math.PI / 2;
    const spring = new THREE.Mesh(sharedSpring, steel);
    const boot = new THREE.Mesh(sharedBoot, bootMat);
    boot.position.z = -0.0095;
    const strands = new THREE.Mesh(sharedStrands, copper);
    const grab = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    grab.position.z = -0.004;
    g.add(lower, upper, pin, spring, boot, strands, grab);
    g.userData.grab = grab;
    return g;
  }

  function makeWire(name, bootMat, insulation, ax, az, bx, bz) {
    const y = TOP + 0.0042;
    const a = { pos: new THREE.Vector3(ax, y, az), snap: null, clip: makeClip(bootMat) };
    const b = { pos: new THREE.Vector3(bx, y, bz), snap: null, clip: makeClip(bootMat) };
    a.rest = a.pos.clone();
    b.rest = b.pos.clone();
    a.clip.userData.end = a;
    b.clip.userData.end = b;
    a.clip.userData.grab.userData.end = a;
    b.clip.userData.grab.userData.end = b;
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), insulation);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    add(mesh);
    add(a.clip);
    add(b.clip);
    const wire = { name, a, b, mesh, insulation };
    wires.push(wire);
    rebuildWire(wire);
    return wire;
  }

  // Jaw direction when a lead is snapped. The clip sits on this side of the post
  // so the lead leaves away from the glass instead of across it.
  const APPROACH = {
    'bat+': new THREE.Vector3(0, 0, 1),
    'bat-': new THREE.Vector3(0, 0, 1),
    swL: new THREE.Vector3(1, 0, 0),
    swR: new THREE.Vector3(-1, 0, 0),
    bulbA: new THREE.Vector3(1, 0, 0),
    bulbB: new THREE.Vector3(-1, 0, 0),
  };

  function orientClip(end, other) {
    const tip = end.pos;
    const away = (end.snap && APPROACH[end.snap])
      ? APPROACH[end.snap].clone()
      : tip.clone().sub(other);
    away.y = 0;
    if (away.lengthSq() < 1e-8) away.set(0, 0, 1);
    away.normalize();
    // Jaw teeth sit about 10 mm in front of the clip origin. Pull back so they bite the post.
    const bite = end.snap ? 0.015 : 0.003;
    end.clip.position.copy(tip).addScaledVector(away, -bite);
    end.clip.position.y = end.snap ? tip.y : TOP + 0.0042;
    root.updateMatrixWorld();
    // Object3D.lookAt aims +Z at the target. Jaws are built along +Z, so aim them at the post.
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

  function rebuildWire(wire) {
    const a = wire.a.pos;
    const b = wire.b.pos;
    orientClip(wire.a, b);
    orientClip(wire.b, a);
    root.updateMatrixWorld(true);
    const start = wire.a.clip.localToWorld(new THREE.Vector3(0, 0, -0.014));
    const end = wire.b.clip.localToWorld(new THREE.Vector3(0, 0, -0.014));
    root.worldToLocal(start);
    root.worldToLocal(end);
    const boardY = TOP + WIRE_R;
    let anchors = [start, end];
    if (wire.a.snap && wire.b.snap && wire.name === 'black') {
      anchors = [
        start,
        new THREE.Vector3(0.142, boardY, 0.02),
        new THREE.Vector3(0.142, boardY, -0.09),
        new THREE.Vector3(-0.125, boardY, -0.09),
        end,
      ];
    } else if (wire.a.snap && wire.b.snap && wire.name === 'red') {
      anchors = [
        start,
        new THREE.Vector3(-0.13, boardY, 0.04),
        new THREE.Vector3(-0.12, boardY, -0.02),
        end,
      ];
    }
    const pts = [];
    for (let s = 0; s < anchors.length - 1; s++) {
      const steps = 5;
      for (let i = 0; i < steps; i++) {
        pts.push(new THREE.Vector3().lerpVectors(anchors[s], anchors[s + 1], i / steps));
      }
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
    wire.curve = curve;
    if (wire.mesh.geometry) wire.mesh.geometry.dispose();
    const dist = start.distanceTo(end);
    const segs = Math.max(8, Math.min(48, Math.round(dist * 120)));
    wire.mesh.geometry = dist < 0.012
      ? new THREE.BufferGeometry()
      : new THREE.TubeGeometry(curve, segs, WIRE_R, 8, false);
  }

  function terminalById(id) { return terminals.find((t) => t.id === id); }

  function nearestTerminal(pos, ignore) {
    let best = null;
    let bestD = 0.018;
    for (const t of terminals) {
      if (ignore && ignore.has(t.id)) continue;
      const d = Math.hypot(pos.x - t.x, pos.z - t.z);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  function takenTerminals(exceptEnd) {
    const ids = new Set();
    for (const w of wires) {
      for (const e of [w.a, w.b]) {
        if (e !== exceptEnd && e.snap) ids.add(e.snap);
      }
    }
    return ids;
  }

  function setSnap(end, terminal) {
    end.snap = terminal ? terminal.id : null;
    if (terminal) {
      end.pos.set(terminal.x, terminal.y, terminal.z);
    }
  }

  function highlightNear(pos, exceptEnd) {
    const near = pos ? nearestTerminal(pos, takenTerminals(exceptEnd)) : null;
    for (const t of terminals) {
      const on = near && t === near;
      t.mat.emissive.setHex(on ? 0x8a5a12 : 0x000000);
      t.mat.emissiveIntensity = on ? 0.45 : 0;
    }
  }

  function snapEnd(end) {
    const t = nearestTerminal(end.pos, takenTerminals(end));
    if (!t) return false;
    setSnap(end, t);
    return true;
  }

  function wireOf(end) {
    return wires.find((w) => w.a === end || w.b === end);
  }

  function layoutKnife() {
    if (!knife) return;
    const left = terminalById('swL');
    knife.position.set(left.x, TOP + 0.0082, left.z);
    knife.rotation.z = switchOn ? -0.03 : 0.68;
  }

  function graphClosed() {
    const adj = {};
    const ids = terminals.map((t) => t.id);
    for (const id of ids) adj[id] = [];
    const link = (a, b, tag) => {
      if (!adj[a] || !adj[b]) return;
      adj[a].push({ n: b, tag });
      adj[b].push({ n: a, tag });
    };
    for (const w of wires) if (w.a.snap && w.b.snap) link(w.a.snap, w.b.snap, 'wire');
    if (switchOn) link('swL', 'swR', 'switch');
    link('bulbA', 'bulbB', 'bulb');
    const seen = new Set();
    const q = [{ n: 'bat+', bulb: false }];
    seen.add('bat+|0');
    let through = false;
    let around = false;
    while (q.length) {
      const cur = q.shift();
      if (cur.n === 'bat-') {
        if (cur.bulb) through = true;
        else around = true;
        continue;
      }
      for (const e of adj[cur.n] || []) {
        const bulb = cur.bulb || e.tag === 'bulb';
        const key = e.n + '|' + (bulb ? '1' : '0');
        if (seen.has(key)) continue;
        seen.add(key);
        q.push({ n: e.n, bulb });
      }
    }
    return through && !around;
  }

  function refreshHint() {
    if (!root.visible || !ctx.setHint) return;
    if (graphClosed()) ctx.setHint('Circuit închis! Curentul trece prin filament și îl încălzește.');
    else if (switchOn) ctx.setHint('Întrerupătorul e închis, dar mai lipsește o legătură.');
    else ctx.setHint('Leagă firele ca să aprinzi becul!');
  }

  function endFromHit(hit) {
    let o = hit.object;
    while (o) {
      if (o.userData && o.userData.end) return o.userData.end;
      if (o.userData && o.userData.knife) return 'knife';
      o = o.parent;
    }
    return null;
  }

  function boardPoint(raycaster) {
    const hits = boardMesh ? raycaster.intersectObject(boardMesh, false) : [];
    const local = new THREE.Vector3();
    if (hits.length) {
      local.copy(hits[0].point);
      root.worldToLocal(local);
    } else {
      const normal = new THREE.Vector3(0, 1, 0).transformDirection(root.matrixWorld);
      const origin = new THREE.Vector3(0, TOP, 0).applyMatrix4(root.matrixWorld);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      local.copy(hit);
      root.worldToLocal(local);
    }
    local.x = Math.max(-0.16, Math.min(0.16, local.x));
    local.z = Math.max(-0.11, Math.min(0.11, local.z));
    local.y = TOP + 0.012;
    return local;
  }

  function onPointerDown(raycaster) {
    if (!built || !root.visible) return false;
    const hits = raycaster.intersectObject(root, true);
    for (const hit of hits) {
      const found = endFromHit(hit);
      if (found === 'knife') {
        switchOn = !switchOn;
        layoutKnife();
        refreshHint();
        click(680);
        return true;
      }
      if (found && found.pos) {
        found.snap = null;
        drag = found;
        highlightNear(found.pos, found);
        return true;
      }
    }
    return false;
  }

  function onPointerMove(raycaster) {
    if (!drag) return false;
    const p = boardPoint(raycaster);
    if (!p) return true;
    drag.pos.copy(p);
    highlightNear(drag.pos, drag);
    const w = wireOf(drag);
    if (w) rebuildWire(w);
    return true;
  }

  function onPointerUp() {
    if (!drag) return false;
    const ok = snapEnd(drag);
    const w = wireOf(drag);
    if (w) rebuildWire(w);
    highlightNear(null);
    drag = null;
    if (ok) click(420);
    refreshHint();
    return true;
  }

  let audioCtx = null;
  function click(freq) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.07);
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.08);
    } catch (e) { /* autoplay or missing audio */ }
  }

  function connectEnd(end, id) {
    const t = terminalById(id);
    setSnap(end, t);
  }

  function connectAll() {
    const red = wires.find((w) => w.name === 'red');
    const blue = wires.find((w) => w.name === 'blue');
    const black = wires.find((w) => w.name === 'black');
    connectEnd(red.a, 'bat+');
    connectEnd(red.b, 'swL');
    connectEnd(blue.a, 'swR');
    connectEnd(blue.b, 'bulbA');
    connectEnd(black.a, 'bulbB');
    connectEnd(black.b, 'bat-');
    for (const w of wires) rebuildWire(w);
    switchOn = true;
    layoutKnife();
    refreshHint();
  }

  function resetCircuit() {
    switchOn = false;
    for (const w of wires) {
      for (const e of [w.a, w.b]) {
        e.snap = null;
        e.pos.copy(e.rest);
      }
      rebuildWire(w);
    }
    layoutKnife();
    highlightNear(null);
    refreshHint();
  }

  function updateElectrons(dt, lit) {
    const live = electronsOn && lit;
    let slot = 0;
    for (const w of wires) {
      const use = live && w.a.snap && w.b.snap && w.curve;
      for (let i = 0; i < 3; i++) {
        const dot = dots[slot++];
        if (!use) { dot.visible = false; continue; }
        dot.visible = true;
        const t = ((performance.now() * 0.00008) + i / 3) % 1;
        // Flow from the end closer to the positive terminal toward the other.
        const forward = (w.a.snap === 'bat+' || w.a.snap === 'swL' || w.a.snap === 'bulbA') ? t : 1 - t;
        w.curve.getPoint(forward, dot.position);
      }
    }
  }

  function update(dt) {
    if (!built) return;
    const lit = graphClosed();
    const target = lit ? 1 : 0;
    const tau = target > heat ? 0.12 : 0.42;
    heat += (target - heat) * (1 - Math.exp(-Math.min(0.05, dt) / tau));
    if (heat < 0.001) heat = 0;
    const flick = heat > 0.35 ? 1 + Math.sin(performance.now() * 0.047) * 0.025 + Math.sin(performance.now() * 0.091) * 0.015 : 1;
    const h = Math.max(0, Math.min(1, heat * flick));
    if (filamentMat) {
      if (h < 0.015) {
        filamentMat.color.copy(tungsten);
        filamentMat.emissive.setRGB(0, 0, 0);
        filamentMat.emissiveIntensity = 0;
      } else if (h < 0.4) {
        filamentMat.emissive.copy(heatRed).lerp(heatOrange, h / 0.4);
        filamentMat.emissiveIntensity = 0.8 + h * 2.2;
        filamentMat.color.set(0x3a2a28);
      } else if (h < 0.75) {
        filamentMat.emissive.copy(heatOrange).lerp(heatWhite, (h - 0.4) / 0.35);
        filamentMat.emissiveIntensity = 1.6 + h * 2.4;
        filamentMat.color.copy(filamentMat.emissive).multiplyScalar(0.3);
      } else {
        filamentMat.emissive.copy(heatWhite);
        filamentMat.emissiveIntensity = 2.4 + h * 1.6;
        filamentMat.color.set(0xfff3d4);
      }
    }
    if (glassMat) {
      glassMat.emissive.setRGB(1, 0.55, 0.22);
      glassMat.emissiveIntensity = h * 0.02;
      glassMat.attenuationColor.setRGB(1, 0.97 - h * 0.12, 0.92 - h * 0.28);
      glassMat.attenuationDistance = 0.09;
    }
    if (bulbLight) {
      bulbLight.intensity = h * 0.05;
      bulbLight.color.setRGB(1, 0.72 + h * 0.12, 0.45);
    }
    if (halo) {
      halo.material.color.setHex(0xffb56a);
      halo.material.opacity = h * 0.32;
      const s = 0.007 + h * 0.007;
      halo.scale.set(s, s, 1);
    }
    updateElectrons(dt, lit);
  }

  function focus(camera, controls, mode) {
    camera.near = 0.002;
    camera.fov = mode === 'wide' ? 42 : mode === 'clip' ? 36 : 32;
    camera.updateProjectionMatrix();
    root.updateMatrixWorld(true);
    const origin = new THREE.Vector3();
    const look = new THREE.Vector3();
    let alreadyWorld = false;
    if (mode === 'bulb') {
      const dir = new THREE.Vector3(-0.42, 0.22, 0.88).normalize().multiplyScalar(0.05);
      origin.copy(filamentLocal).add(dir);
      look.copy(filamentLocal);
    } else if (mode === 'clip') {
      const clip = wires.find((w) => w.name === 'red')?.a.clip;
      if (clip) {
        origin.set(0.04, 0.022, 0.034);
        look.set(0, 0.001, 0.006);
        clip.localToWorld(origin);
        clip.localToWorld(look);
        alreadyWorld = true;
      } else {
        origin.set(clipLocal.x + 0.04, clipLocal.y + 0.02, clipLocal.z + 0.02);
        look.copy(clipLocal);
      }
    } else {
      origin.set(0.22, 0.2, 0.28);
      look.set(0, 0.03, 0);
      camera.fov = 42;
      camera.updateProjectionMatrix();
    }
    if (!alreadyWorld) {
      origin.applyMatrix4(root.matrixWorld);
      look.applyMatrix4(root.matrixWorld);
    }
    camera.position.copy(origin);
    camera.lookAt(look);
    if (controls) {
      controls.enabled = false;
      controls.target.copy(look);
    }
  }

  async function load(onProgress) {
    if (built) return;
    if (onProgress) onProgress(0.2);
    const texLoader = new THREE.TextureLoader();
    const loadTex = (file, color) => new Promise((resolve, reject) => {
      texLoader.load(new URL('../assets/' + file, import.meta.url).href, (tex) => {
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
    if (onProgress) onProgress(0.85);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.014, 0.20), new THREE.MeshStandardMaterial({
      map: albedo, normalMap: normal, roughnessMap: rough, roughness: 0.92, metalness: 0, envMapIntensity: 0.35,
    }));
    const uv = board.geometry.attributes.uv;
    for (let i = 8; i < 12; i++) uv.setXY(i, uv.getX(i) * 2.4, uv.getY(i) * 1.6);
    uv.needsUpdate = true;
    board.position.y = 0.004 + 0.007;
    boardMesh = board;
    add(board);
    for (const [x, z] of [[-0.13, -0.08], [0.13, -0.08], [-0.13, 0.08], [0.13, 0.08]]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.004, 16), rubber);
      foot.position.set(x, 0.002, z);
      add(foot);
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.28), new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false,
    }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    add(shadow);

    const holder = new THREE.Mesh(new RoundedBoxGeometry(0.082, 0.011, 0.038, 3, 0.0014), absBlack);
    holder.position.set(-0.075, TOP + 0.0055, 0);
    add(holder);
    cell(-0.075, -0.008);
    cell(-0.075, 0.008);
    for (const zc of [-0.008, 0.008]) {
      const springPts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const a = t * Math.PI * 2 * 3;
        springPts.push(new THREE.Vector3(-0.112 + t * 0.004, TOP + 0.012, zc + Math.sin(a) * 0.0016));
        springPts[springPts.length - 1].y += Math.cos(a) * 0.0016;
      }
      add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 16, 0.00035, 5, false), copper));
    }
    post(-0.04, 0.082, brass, 'bat+');
    post(-0.11, 0.082, nickel, 'bat-');
    polarityMark('+', -0.04, 0.064, '#9a2430');
    polarityMark('−', -0.11, 0.064, '#1c1c1c');
    clipLocal.set(-0.04, TOP + 0.009, 0.082);

    const base = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.007, 0.03, 3, 0.0015), ceramic);
    base.position.set(0, TOP + 0.0036, -0.045);
    add(base);
    post(-0.02, -0.045, brass, 'swL');
    post(0.02, -0.045, brass, 'swR');
    const bladeGeo = new THREE.BoxGeometry(0.046, 0.00105, 0.008);
    bladeGeo.translate(0.02, 0, 0);
    knife = new THREE.Mesh(bladeGeo, brass);
    knife.userData.knife = true;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.012, 16), phenolic);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.042, 0, 0);
    handle.userData.knife = true;
    knife.add(handle);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0023, 0.0023, 0.014, 16), brass);
    barrel.rotation.x = Math.PI / 2;
    knife.add(barrel);
    add(knife);
    layoutKnife();

    makeBulb(0.085, 0.012);
    post(0.058, 0.012, brass, 'bulbA');
    post(0.112, 0.012, brass, 'bulbB');

    makeWire('red', pvc.red, pvc.red, 0.02, 0.09, 0.13, 0.055);
    makeWire('blue', pvc.blue, pvc.blue, 0.125, 0.01, 0.11, -0.06);
    makeWire('black', pvc.black, pvc.black, 0.02, -0.09, 0.13, -0.075);

    for (let i = 0; i < 9; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0015, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x6a5346, metalness: 0.8, roughness: 0.35, emissive: 0x3a2418, emissiveIntensity: 0.4 }));
      dot.visible = false;
      add(dot);
      dots.push(dot);
    }
    built = true;
    if (onProgress) onProgress(1);
  }

  return {
    id: 'circuit',
    root,
    load,
    update,
    onPrimary: null,
    onLift() {},
    onLeave() { drag = null; highlightNear(null); },
    onPlaced: refreshHint,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    reset: resetCircuit,
    toggleElectrons() { electronsOn = !electronsOn; return electronsOn; },
    electronsOn: () => electronsOn,
    connectAll,
    focus,
    debugState() {
      return {
        heat,
        switchOn,
        electronsOn,
        snaps: wires.map((w) => [w.name, w.a.snap, w.b.snap]),
        dots: dots.filter((d) => d.visible).length,
      };
    },
    preview: {
      position: [0.24, 0.2, 0.3],
      target: [0, 0.03, 0],
      minDistance: 0.03,
      maxDistance: 1.4,
      maxPolarAngle: Math.PI * 0.49,
      fov: 42,
      near: 0.003,
    },
    hints: {
      preview: 'Leagă firele ca să aprinzi becul!',
      found: 'Am găsit masa! Atinge ecranul ca să pui circuitul 💡',
      placed: 'Leagă firele ca să aprinzi becul!',
      move: 'Caută un loc nou pe masă și atinge ecranul 👆',
      ready: 'Telefonul tău știe AR! Apasă „Pornește AR” și pune circuitul pe masă. (Sau încearcă aici în 3D.)',
    },
    primaryLabel: '',
    moveLabel: '↺ Mută',
    loaderText: 'Se încarcă circuitul…',
    wantsEnvironment: true,
  };
}
