// Tabletop battery, switch and bulb. Parts are built in three.js so the
// filament, glass and stripped copper still read from a few centimetres away.
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
  let haloWide = null;
  let heat = 0;
  let electronsOn = false;
  let drag = null;
  let built = false;
  const dots = [];
  const filamentLocal = new THREE.Vector3();
  const clipLocal = new THREE.Vector3();
  let boardMesh = null;

  const brass = new THREE.MeshStandardMaterial({ color: 0xc6a15e, metalness: 1, roughness: 0.28, envMapIntensity: 1 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb4683c, metalness: 1, roughness: 0.18, envMapIntensity: 1.15 });
  const nickel = new THREE.MeshStandardMaterial({ color: 0xb7bcc4, metalness: 1, roughness: 0.32, envMapIntensity: 1 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8e949c, metalness: 1, roughness: 0.38, envMapIntensity: 0.8 });
  const absBlack = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, metalness: 0.04, roughness: 0.52 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xe6e0d4, metalness: 0, roughness: 0.62 });
  const pvc = {
    red: new THREE.MeshStandardMaterial({ color: 0x8e1d22, metalness: 0, roughness: 0.46 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x1d3f86, metalness: 0, roughness: 0.46 }),
    black: new THREE.MeshStandardMaterial({ color: 0x161616, metalness: 0, roughness: 0.5 }),
  };
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85, metalness: 0 });

  function anisotropy(tex) {
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    return tex;
  }
  function add(mesh) { root.add(mesh); return mesh; }

  function post(x, z, colorMat, id) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0028, 0.008, 16), colorMat);
    stem.position.y = 0.004;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0054, 0.0054, 0.0042, 24), nickel);
    head.position.y = 0.0092;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.0062, 0.00055, 0.00085), absBlack);
    slot.position.y = 0.0112;
    g.add(stem, head, slot);
    g.position.set(x, TOP, z);
    add(g);
    head.material = nickel.clone();
    const t = { id, x, z, y: TOP + 0.0092, mesh: head, mat: head.material };
    t.base = head.material.emissive.clone();
    terminals.push(t);
    return t;
  }

  function makeLabel() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#f3ead7';
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 1800; i++) {
      const v = 210 + Math.random() * 30;
      g.fillStyle = `rgba(${v},${v - 12},${v - 28},0.18)`;
      g.fillRect(Math.random() * 512, Math.random() * 256, 2, 1);
    }
    g.strokeStyle = '#7d1e22';
    g.lineWidth = 8;
    g.strokeRect(16, 16, 480, 224);
    g.fillStyle = '#1c1c1c';
    g.textAlign = 'center';
    g.font = 'bold 54px Georgia, "Times New Roman", serif';
    g.fillText('PILĂ USCATĂ', 256, 108);
    g.fillStyle = '#8d1f24';
    g.font = 'bold 62px Georgia, "Times New Roman", serif';
    g.fillText('1,5 V', 256, 176);
    g.fillStyle = '#333';
    g.font = '28px Georgia, serif';
    g.fillText('AA  ·  nealcalină', 256, 214);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
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
    const plus = new THREE.Mesh(new THREE.CylinderGeometry(0.0064, 0.0066, 0.0032, 28), nickel);
    plus.rotation.z = Math.PI / 2;
    plus.position.x = 0.0242;
    const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.003, 0.0016, 16), brass);
    nub.rotation.z = Math.PI / 2;
    nub.position.x = 0.0264;
    const minus = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.0014, 28), steel);
    minus.rotation.z = Math.PI / 2;
    minus.position.x = -0.0236;
    const plusMark = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.0004, 0.0008), absBlack);
    plusMark.position.set(0.0273, 0, 0);
    const plusMark2 = plusMark.clone();
    plusMark2.rotation.x = Math.PI / 2;
    const minusMark = new THREE.Mesh(new THREE.BoxGeometry(0.0005, 0.0032, 0.0008), absBlack);
    minusMark.position.set(-0.0245, 0, 0);
    g.add(body, plus, nub, minus, plusMark, plusMark2, minusMark);
    g.position.set(x, TOP + 0.012, z);
    add(g);
  }

  function makeBulb(x, z) {
    const g = new THREE.Group();
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.034), ceramic);
    foot.position.y = 0.004;
    g.add(foot);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0064, 0.014, 28), brass);
    shell.position.y = 0.015;
    g.add(shell);
    for (let i = 0; i < 5; i++) {
      const thread = new THREE.Mesh(new THREE.TorusGeometry(0.0065, 0.00055, 6, 28), brass);
      thread.rotation.x = Math.PI / 2;
      thread.position.y = 0.010 + i * 0.0024;
      g.add(thread);
    }
    const pts = [
      [0.0044, 0.020], [0.0052, 0.024], [0.0074, 0.030], [0.0086, 0.037],
      [0.0082, 0.044], [0.0062, 0.050], [0.0034, 0.054], [0.0011, 0.056],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.045,
      transmission: 1,
      thickness: 0.0014,
      ior: 1.52,
      transparent: true,
      attenuationColor: new THREE.Color(0xf4f7f8),
      attenuationDistance: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.2,
      side: THREE.FrontSide,
    });
    const glass = new THREE.Mesh(new THREE.LatheGeometry(pts, 56), glassMat);
    g.add(glass);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0015, 0.016, 12),
      new THREE.MeshPhysicalMaterial({
        color: 0xe7f2f1, roughness: 0.15, transmission: 0.85, thickness: 0.0008, transparent: true, opacity: 1,
      }));
    stem.position.y = 0.030;
    g.add(stem);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 12, 10), stem.material);
    bead.position.y = 0.038;
    g.add(bead);

    const supports = [];
    function supportWire(x0, z0) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x0, 0.022, z0),
        new THREE.Vector3(x0 * 0.7, 0.034, z0 * 0.4),
        new THREE.Vector3(x0 * 0.35, 0.040, 0),
      ]);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.00022, 6, false), steel);
      g.add(mesh);
      supports.push(mesh);
      return curve.getPoint(1);
    }
    const left = supportWire(-0.0032, 0.0004);
    const right = supportWire(0.0032, -0.0004);
    const coilPts = [];
    const turns = 12;
    const coilH = 0.008;
    for (let i = 0; i <= turns * 12; i++) {
      const t = i / (turns * 12);
      const a = t * turns * Math.PI * 2;
      coilPts.push(new THREE.Vector3(
        Math.cos(a) * 0.00125,
        0.039 + t * coilH,
        Math.sin(a) * 0.00125,
      ));
    }
    coilPts[0].copy(left);
    coilPts[coilPts.length - 1].copy(right);
    filamentMat = new THREE.MeshStandardMaterial({
      color: 0x2a211c, emissive: new THREE.Color(0x2a0904), emissiveIntensity: 0.15,
      roughness: 0.55, metalness: 0.35,
    });
    const filament = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), turns * 12, 0.00022, 6, false), filamentMat);
    g.add(filament);
    filamentLocal.set(x, TOP + 0.043, z);

    const glowTex = softDisc();
    halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffb060, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, toneMapped: true, opacity: 0,
    }));
    halo.position.y = 0.043;
    halo.scale.set(0.03, 0.038, 1);
    g.add(halo);
    haloWide = new THREE.Sprite(halo.material.clone());
    haloWide.position.y = 0.043;
    haloWide.scale.set(0.048, 0.06, 1);
    haloWide.material.opacity = 0;
    g.add(haloWide);

    bulbLight = new THREE.PointLight(0xffb56a, 0, 0.34, 2);
    bulbLight.position.set(0, 0.043, 0);
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
        // Hollow so the coil stays visible: brightest in a ring, clear in the middle.
        const ring = Math.exp(-((d - 0.42) ** 2) / 0.08);
        const a = d > 1 ? 0 : ring * (1 - d * 0.35);
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

  function makeClip(bootMat) {
    const g = new THREE.Group();
    const clipMetal = new THREE.MeshStandardMaterial({ color: 0x8d98a4, metalness: 0.9, roughness: 0.46, envMapIntensity: 0.65 });
    const jawGeo = new THREE.BoxGeometry(0.0036, 0.00105, 0.02);
    jawGeo.translate(0, 0, 0.009);
    const lower = new THREE.Mesh(jawGeo, clipMetal);
    const upper = new THREE.Mesh(jawGeo, clipMetal);
    upper.position.y = 0.0031;
    upper.rotation.x = -0.28;
    lower.rotation.x = 0.28;
    g.userData.jaws = [lower, upper];
    for (const jaw of [lower, upper]) {
      for (let i = 0; i < 4; i++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0007, 0.0007), steel);
        tooth.position.set(0, jaw === upper ? -0.0007 : 0.0007, 0.0155 - i * 0.0025);
        jaw.add(tooth);
      }
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.005, 10), steel);
    pin.rotation.z = Math.PI / 2;
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.0016, 0.012), nickel);
    lever.position.set(0, 0.0022, -0.004);
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0048, 0.016, 16), bootMat);
    boot.rotation.x = Math.PI / 2;
    boot.position.z = -0.026;
    g.add(lower, upper, pin, lever, boot);
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + 0.3;
      const pts = [];
      for (let k = 0; k <= 7; k++) {
        const t = k / 7;
        pts.push(new THREE.Vector3(
          Math.cos(ang + t * 0.55) * (0.0004 + t * 0.0024),
          Math.sin(ang + t * 0.4) * (0.00035 + t * 0.0016),
          -0.003 - t * 0.016,
        ));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.00045, 5, false), copper));
    }
    const grab = new THREE.Mesh(
      new THREE.SphereGeometry(0.013, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    grab.position.z = -0.006;
    g.add(grab);
    g.userData.grab = grab;
    return g;
  }

  function makeWire(name, bootMat, insulation, ax, az, bx, bz) {
    const y = TOP + 0.006;
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
    const bite = end.snap ? 0.011 : 0.004;
    end.clip.position.copy(tip).addScaledVector(away, -bite);
    end.clip.position.y = end.snap ? tip.y - 0.0015 : TOP + 0.006;
    root.updateMatrixWorld();
    // Object3D.lookAt aims +Z at the target. Jaws are built along +Z, so aim them at the post.
    const look = end.clip.position.clone().add(away);
    root.localToWorld(look);
    end.clip.up.set(0, 1, 0);
    end.clip.lookAt(look);
    const open = end.snap ? 0.02 : 0.42;
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
    const start = wire.a.clip.localToWorld(new THREE.Vector3(0, 0, -0.032));
    const end = wire.b.clip.localToWorld(new THREE.Vector3(0, 0, -0.032));
    root.worldToLocal(start);
    root.worldToLocal(end);
    const lift = start.clone().lerp(end, 0.33);
    const lift2 = start.clone().lerp(end, 0.66);
    const rise = Math.min(0.008, start.distanceTo(end) * 0.035);
    lift.y = Math.max(start.y, end.y) + rise;
    lift2.y = Math.max(start.y, end.y) + rise * 0.7;
    // Snapped leads stay low and route behind the bulb so the glass stays clear.
    let pts = [start, lift, lift2, end];
    if (wire.a.snap && wire.b.snap && wire.name === 'black') {
      pts = [
        start,
        new THREE.Vector3(0.145, TOP + 0.008, 0.02),
        new THREE.Vector3(0.145, TOP + 0.008, -0.095),
        new THREE.Vector3(-0.13, TOP + 0.008, -0.095),
        end,
      ];
    } else if (wire.a.snap && wire.b.snap && wire.name === 'red') {
      pts = [
        start,
        new THREE.Vector3(-0.125, TOP + 0.009, 0.03),
        new THREE.Vector3(-0.1, TOP + 0.009, -0.02),
        end,
      ];
    } else if (wire.a.snap && wire.b.snap) {
      lift.y = TOP + 0.008;
      lift2.y = TOP + 0.008;
      pts = [start, lift, lift2, end];
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    wire.curve = curve;
    if (wire.mesh.geometry) wire.mesh.geometry.dispose();
    const dist = start.distanceTo(end);
    const segs = Math.max(8, Math.min(36, Math.round(dist * 90)));
    wire.mesh.geometry = dist < 0.012
      ? new THREE.BufferGeometry()
      : new THREE.TubeGeometry(curve, segs, 0.0017, 8, false);
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
    knife.position.set(left.x, TOP + 0.0115, left.z);
    knife.rotation.z = switchOn ? -0.02 : 0.92;
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
      const cold = new THREE.Color(0x2a0904);
      const red = new THREE.Color(0xff3a08);
      const em = cold.clone();
      if (h < 0.45) em.lerp(red, h / 0.45);
      else em.copy(red).lerp(new THREE.Color(0xffb03a), (h - 0.45) / 0.55);
      filamentMat.emissive.copy(em);
      filamentMat.emissiveIntensity = 0.12 + h * 0.48;
      filamentMat.color.copy(em).multiplyScalar(0.35);
    }
    if (glassMat) {
      glassMat.emissive.setRGB(1, 0.45, 0.12);
      glassMat.emissiveIntensity = h * 0.2;
      glassMat.attenuationColor.setRGB(0.96, 0.97 - h * 0.25, 0.97 - h * 0.45);
      glassMat.attenuationDistance = 0.06;
    }
    if (bulbLight) {
      bulbLight.intensity = h * 0.42;
      bulbLight.color.setRGB(1, 0.62 + h * 0.15, 0.32);
    }
    if (halo) halo.material.opacity = h * 0.16;
    if (haloWide) haloWide.material.opacity = h * 0.06;
    updateElectrons(dt, lit);
  }

  function focus(camera, controls, mode) {
    camera.near = 0.002;
    camera.fov = mode === 'wide' ? 42 : mode === 'clip' ? 38 : 24;
    camera.updateProjectionMatrix();
    root.updateMatrixWorld(true);
    const origin = new THREE.Vector3();
    const look = new THREE.Vector3();
    let alreadyWorld = false;
    if (mode === 'bulb') {
      origin.set(filamentLocal.x - 0.028, filamentLocal.y + 0.01, filamentLocal.z + 0.026);
      look.copy(filamentLocal);
      look.y += 0.002;
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

    const holder = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.012, 0.036), absBlack);
    holder.position.set(-0.075, TOP + 0.006, 0);
    add(holder);
    cell(-0.075, -0.008);
    cell(-0.075, 0.008);
    const plusCap = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.012, 0.03), new THREE.MeshStandardMaterial({ color: 0x9a2430, roughness: 0.5 }));
    plusCap.position.set(-0.04, TOP + 0.01, 0);
    const minusCap = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.028), absBlack);
    minusCap.position.set(-0.11, TOP + 0.01, 0);
    add(plusCap); add(minusCap);
    post(-0.04, 0.082, brass, 'bat+');
    post(-0.11, 0.082, nickel, 'bat-');
    polarityMark('+', -0.04, 0.064, '#9a2430');
    polarityMark('−', -0.11, 0.064, '#1c1c1c');
    clipLocal.set(-0.04, TOP + 0.009, 0.082);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.008, 0.028), ceramic);
    base.position.set(0, TOP + 0.004, -0.045);
    add(base);
    post(-0.02, -0.045, brass, 'swL');
    post(0.02, -0.045, brass, 'swR');
    const bladeGeo = new THREE.BoxGeometry(0.048, 0.0016, 0.01);
    bladeGeo.translate(0.02, 0, 0);
    knife = new THREE.Mesh(bladeGeo, brass);
    knife.userData.knife = true;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.01, 12), absBlack);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.04, 0, 0);
    handle.userData.knife = true;
    knife.add(handle);
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
