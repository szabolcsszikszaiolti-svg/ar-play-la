// Volcano experiment, moved unchanged from the approved page (475e1f0).
// Only the module wrapper and the asset path differ.
export function createVolcanoExperiment(ctx) {
  const { THREE, GLTFLoader, MeshoptDecoder, scene, camera, renderer, card, muteBtn } = ctx;
  const getControls = () => (ctx.getControls ? ctx.getControls() : null);
  const assetURL = (name) => new URL('../../assets/' + name, import.meta.url).href;

let H = 0.176;
let poolSurface = 0.11;
let paths = [];
let pool = null;
let rockMat = null;
const uErupt = { value: 0.32 };
const uTime = { value: 0 };
const uHot = { value: 0.4 };
const uFront = { value: 0 };
const uFlowAmt = { value: 0 };
const flowMapUniform = { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) };
flowMapUniform.value.colorSpace = THREE.NoColorSpace;
flowMapUniform.value.needsUpdate = true;

function softDisc() {
  const s = 64, data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (x + 0.5) / s * 2 - 1, dy = (y + 0.5) / s * 2 - 1;
      const d = Math.hypot(dx, dy);
      const a = Math.pow(Math.max(0, 1 - d), 1.7);
      const i = (y * s + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.min(255, a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, s, s);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
const softTex = softDisc();
function shadowTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.62)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.32)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// Top-down mask of the flank flows. The rock shader paints this onto the mesh,
// so the lava is the surface itself and cannot float or bridge the crater.
function buildFlowMask(allPaths) {
  const N = 512;
  const SPAN = 0.44;
  const HALF = SPAN * 0.5;
  const data = new Uint8Array(N * N * 4);
  const cols = 12;
  const rowN = cols + 1;
  function toPx(x, z) {
    return [(x + HALF) / SPAN * (N - 1), (z + HALF) / SPAN * (N - 1)];
  }
  function paint(points) {
    const pts = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (Math.hypot(p.x, p.z) < 0.047) continue;
      pts.push(p);
    }
    const n = pts.length;
    if (n < 2) return;
    const xs = new Float32Array(n * rowN);
    const zs = new Float32Array(n * rowN);
    const along = new Float32Array(n * rowN);
    const across = new Float32Array(n * rowN);
    const side = new THREE.Vector3();
    const tang = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const p = pts[i];
      const nxt = pts[Math.min(n - 1, i + 1)];
      const prv = pts[Math.max(0, i - 1)];
      tang.subVectors(nxt, prv);
      if (tang.lengthSq() < 1e-8) tang.set(0, -1, 0);
      tang.normalize();
      side.set(-tang.z, 0, tang.x);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      const lobe = 0.78 + 0.28 * Math.sin(t * 7.5 + 0.5) + 0.16 * Math.sin(t * 16.0 + 1.3);
      const open = Math.min(1, t / 0.1);
      const w = (0.055 * (1 - t) + 0.026 * t) * Math.max(0.7, lobe) * (0.45 + 0.55 * open);
      for (let c = 0; c <= cols; c++) {
        const s = (c / cols) * 2 - 1;
        const jag = 0.8 + 0.2 * Math.sin(t * 13.0 + c * 1.9);
        const k = i * rowN + c;
        xs[k] = p.x + side.x * w * s * jag;
        zs[k] = p.z + side.z * w * s * jag;
        along[k] = t;
        across[k] = Math.abs(s);
      }
    }
    function rast(i0, i1, i2) {
      const x0 = xs[i0], z0 = zs[i0], x1 = xs[i1], z1 = zs[i1], x2 = xs[i2], z2 = zs[i2];
      const p0 = toPx(x0, z0);
      const p1 = toPx(x1, z1);
      const p2 = toPx(x2, z2);
      const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
      const maxX = Math.min(N - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
      const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
      const maxY = Math.min(N - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
      const area = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
      if (Math.abs(area) < 0.5) return;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((p1[1] - p2[1]) * (px - p2[0]) + (p2[0] - p1[0]) * (py - p2[1])) / area;
          const w1 = ((p2[1] - p0[1]) * (px - p2[0]) + (p0[0] - p2[0]) * (py - p2[1])) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue;
          const a = along[i0] * w0 + along[i1] * w1 + along[i2] * w2;
          const e = across[i0] * w0 + across[i1] * w1 + across[i2] * w2;
          const idx = (y * N + x) * 4;
          if (data[idx + 2] > 0 && data[idx + 1] <= e * 255) continue;
          data[idx] = Math.max(0, Math.min(255, Math.round(a * 255)));
          data[idx + 1] = Math.max(0, Math.min(255, Math.round(e * 255)));
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        }
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let c = 0; c < cols; c++) {
        const a = i * rowN + c;
        const d = a + rowN;
        rast(a, d, a + 1);
        rast(a + 1, d, d + 1);
      }
    }
  }
  for (const path of allPaths) paint(path);
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}
function makeLavaMaterial(edgeFade, soft) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: null },
      uEmit: { value: null },
      uTime,
      uHot,
      uBoil: { value: 0 },
      uEdge: { value: edgeFade },
      uScroll: { value: edgeFade > 0.5 ? 0.04 : 0.3 },
      uFront: { value: edgeFade > 0.5 ? 0 : 1 },
    },
    toneMapped: false,
    transparent: !!soft,
    depthWrite: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: `
      uniform float uTime;
      uniform float uBoil;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float ripple = sin(p.x * 620.0 + uTime * 11.0) * cos(p.y * 540.0 - uTime * 9.0);
        ripple += 0.55 * sin((p.x + p.y) * 380.0 + uTime * 7.0);
        p.z += ripple * uBoil;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uColor;
      uniform sampler2D uEmit;
      uniform float uTime;
      uniform float uHot;
      uniform float uEdge;
      uniform float uScroll;
      uniform float uFront;
      varying vec2 vUv;
      void main() {
        vec2 uv = vec2(fract(vUv.x * 1.4), fract(vUv.y * 1.5 - uTime * uScroll));
        uv.x = fract(uv.x + sin(vUv.y * 9.0 + uTime * uScroll * 1.6) * 0.03);
        vec3 crust = texture2D(uColor, uv).rgb;
        vec3 glow = texture2D(uEmit, vec2(uv.x * 1.2, fract(uv.y + uTime * uScroll * 0.4))).rgb;
        float cracks = clamp(glow.r * 1.35 + crust.r * 0.35, 0.0, 1.4);
        float across = abs(vUv.x - 0.5) * 2.0;
        float lobe = 0.9 + 0.14 * sin(vUv.y * 6.2) + 0.08 * sin(vUv.y * 15.0 + 1.1) + 0.05 * sin(vUv.y * 31.0);
        float edge = across / max(0.8, lobe);
        float side = smoothstep(1.25, 0.5, edge);
        float head = smoothstep(0.0, 0.16, vUv.y);
        float toe = 1.0 - smoothstep(1.35, 1.7, vUv.y);
        float core = smoothstep(0.72, 0.05, edge);
        cracks *= mix(1.0, 0.3 + 0.7 * core, uEdge);
        vec3 crustCol = crust * vec3(0.28, 0.08, 0.03);
        vec3 magma = vec3(1.0, 0.36, 0.04);
        vec3 whiteHot = vec3(1.0, 0.82, 0.35);
        vec3 col = mix(crustCol, magma, 0.78 + 0.22 * smoothstep(0.08, 0.5, cracks));
        col = mix(col, whiteHot, smoothstep(0.4, 0.9, cracks) * (0.4 + uHot * 0.35) * mix(0.7, core, uEdge));
        float crustBand = uEdge * smoothstep(0.62, 0.92, edge);
        col = mix(col, crustCol, crustBand);
        float along = vUv.y / 1.7;
        float frontFade = smoothstep(uFront, uFront - 0.08, along);
        float alpha = mix(1.0, side * head * toe * frontFade, uEdge);
        if (alpha < 0.45) discard;
        gl_FragColor = vec4(col * (0.9 + cracks * (0.45 + uHot * 0.25)), 1.0);
      }
    `,
  });
}
function prepTexture(tex, colorSpace) {
  tex.colorSpace = colorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

const volcano = new THREE.Group();
const shake = new THREE.Group();
volcano.add(shake);
const craterLight = new THREE.PointLight(0xff6a20, 0.012, 0.12, 2);
craterLight.position.y = H - 0.02;
shake.add(craterLight);
const craterGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: softTex, color: 0xff5a12, transparent: true, blending: THREE.AdditiveBlending,
  depthWrite: false, toneMapped: false, opacity: 0.55,
}));
craterGlow.position.y = 0.11;
craterGlow.scale.set(0.028, 0.02, 1);
shake.add(craterGlow);
const outerGlow = craterGlow.clone();
outerGlow.material = craterGlow.material.clone();
outerGlow.material.opacity = 0.18;
outerGlow.scale.set(0.055, 0.04, 1);
shake.add(outerGlow);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), new THREE.MeshBasicMaterial({
  map: shadowTex(), transparent: true, depthWrite: false, toneMapped: false,
}));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.003;
shadow.renderOrder = -1;
volcano.add(shadow);
volcano.visible = false;
scene.add(volcano);

async function loadVolcano() {
  const bar = document.getElementById('loadBar');
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    if (bar && total) bar.style.width = Math.round((loaded / total) * 100) + '%';
  };
  const texLoader = new THREE.TextureLoader(manager);
  const gltfLoader = new GLTFLoader(manager);
  if (MeshoptDecoder.ready) await MeshoptDecoder.ready;
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  const [gltf, albedo, normal, rough, lavaColor, lavaEmit, meta] = await Promise.all([
    gltfLoader.loadAsync(assetURL('volcano.glb')),
    texLoader.loadAsync(assetURL('rock_albedo.webp')),
    texLoader.loadAsync(assetURL('rock_normal.webp')),
    texLoader.loadAsync(assetURL('rock_rough.webp')),
    texLoader.loadAsync(assetURL('lava_color.webp')),
    texLoader.loadAsync(assetURL('lava_emit.webp')),
    fetch(assetURL('volcano.json')).then((r) => { if (!r.ok) throw new Error('meta'); return r.json(); }),
  ]);
  prepTexture(albedo, THREE.SRGBColorSpace);
  prepTexture(normal, THREE.NoColorSpace);
  prepTexture(rough, THREE.NoColorSpace);
  prepTexture(lavaColor, THREE.SRGBColorSpace);
  prepTexture(lavaEmit, THREE.NoColorSpace);

  H = meta.height;
  poolSurface = meta.poolY;
  paths = meta.paths.map((path) => path.map((p) => new THREE.Vector3(p[0], p[1], p[2])));

  rockMat = new THREE.MeshStandardMaterial({
    map: albedo,
    normalMap: normal,
    roughnessMap: rough,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.92,
    metalness: 0.02,
    envMapIntensity: 0.4,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 1,
  });
  rockMat.onBeforeCompile = (shader) => {
    shader.uniforms.uErupt = uErupt;
    shader.uniforms.uRockScale = { value: 4.2 };
    shader.uniforms.uFlowMap = flowMapUniform;
    shader.uniforms.uFront = uFront;
    shader.uniforms.uFlowAmt = uFlowAmt;
    shader.uniforms.uTime = uTime;
    shader.uniforms.uHot = uHot;
    shader.uniforms.uLavaColor = { value: lavaColor };
    shader.uniforms.uLavaEmit = { value: lavaEmit };
    shader.vertexShader = shader.vertexShader
      .replace('#include <uv_pars_vertex>', '#include <uv_pars_vertex>\nattribute vec2 uv1;\nvarying float vHeat;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nvarying vec3 vLocal;\nvarying vec3 vLocalN;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvHeat = uv1.x;')
      .replace('#include <normal_vertex>', '#include <normal_vertex>\n\tvWNrm = normalize(mat3(modelMatrix) * objectNormal);\n\tvWPos = (modelMatrix * vec4(position, 1.0)).xyz;\n\tvLocal = position;\n\tvLocalN = normalize(objectNormal);');
    shader.fragmentShader = `
uniform float uErupt;
uniform float uRockScale;
uniform sampler2D uFlowMap;
uniform sampler2D uLavaColor;
uniform sampler2D uLavaEmit;
uniform float uFront;
uniform float uFlowAmt;
uniform float uTime;
uniform float uHot;
varying float vHeat;
varying vec3 vWPos;
varying vec3 vWNrm;
varying vec3 vLocal;
varying vec3 vLocalN;
vec3 rockBlend(vec3 n) {
  vec3 b = pow(abs(n), vec3(4.0));
  return b / (b.x + b.y + b.z + 1e-4);
}
` + shader.fragmentShader
      .replace('#include <normal_fragment_maps>', `
        vec3 nrmW = normalize(vWNrm);
        vec3 bN = rockBlend(nrmW);
        vec3 axisX = vec3(nrmW.x >= 0.0 ? 1.0 : -1.0, 0.0, 0.0);
        vec3 axisY = vec3(0.0, nrmW.y >= 0.0 ? 1.0 : -1.0, 0.0);
        vec3 axisZ = vec3(0.0, 0.0, nrmW.z >= 0.0 ? 1.0 : -1.0);
        vec3 mx = texture2D(normalMap, vWPos.yz * uRockScale).xyz * 2.0 - 1.0;
        vec3 my = texture2D(normalMap, vWPos.xz * uRockScale).xyz * 2.0 - 1.0;
        vec3 mz = texture2D(normalMap, vWPos.xy * uRockScale).xyz * 2.0 - 1.0;
        mx.xy *= normalScale; my.xy *= normalScale; mz.xy *= normalScale;
        vec3 nX = normalize(vec3(0.0, 0.0, 1.0) * mx.x + vec3(0.0, 1.0, 0.0) * mx.y + axisX * mx.z);
        vec3 nY = normalize(vec3(1.0, 0.0, 0.0) * my.x + vec3(0.0, 0.0, 1.0) * my.y + axisY * my.z);
        vec3 nZ = normalize(vec3(1.0, 0.0, 0.0) * mz.x + vec3(0.0, 1.0, 0.0) * mz.y + axisZ * mz.z);
        normal = normalize(mat3(viewMatrix) * normalize(nX * bN.x + nY * bN.y + nZ * bN.z));
      `)
      .replace('#include <map_fragment>', `
        vec3 bC = rockBlend(normalize(vWNrm));
        vec4 sampledDiffuseColor = texture2D(map, vWPos.yz * uRockScale) * bC.x
          + texture2D(map, vWPos.xz * uRockScale) * bC.y
          + texture2D(map, vWPos.xy * uRockScale) * bC.z;
        diffuseColor *= sampledDiffuseColor;
      `)
      .replace('#include <roughnessmap_fragment>', `
        vec3 bR = rockBlend(normalize(vWNrm));
        float roughTex = dot(vec3(
          texture2D(roughnessMap, vWPos.yz * uRockScale).g,
          texture2D(roughnessMap, vWPos.xz * uRockScale).g,
          texture2D(roughnessMap, vWPos.xy * uRockScale).g
        ), bR);
        float roughnessFactor = roughness * roughTex;
      `)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float heat = smoothstep(0.7, 1.0, clamp(vHeat, 0.0, 1.0));
        totalEmissiveRadiance += vec3(0.45, 0.12, 0.015) * heat * uErupt;`)
      .replace('#include <colorspace_fragment>', `#include <colorspace_fragment>
        vec2 flowUv = vLocal.xz * ${(1 / 0.44).toFixed(6)} + 0.5;
        vec4 fm = texture2D(uFlowMap, flowUv);
        float along = fm.r;
        float across = fm.g;
        float cover = fm.b;
        vec3 nLoc = normalize(vLocalN);
        float rad = length(vLocal.xz);
        // Coat the outer rock, including steep gully walls. Skip the inner bowl and overhangs.
        float facing = dot(nLoc.xz, normalize(vLocal.xz + vec2(1e-4)));
        float bowl = step(0.075, vLocal.y) * step(rad, 0.072) * step(facing, 0.2);
        float flank = step(0.047, rad) * (1.0 - bowl) * step(-0.2, nLoc.y);
        float revealed = 1.0 - smoothstep(uFront - 0.01, uFront + 0.07, along);
        float mask = smoothstep(0.42, 0.72, cover) * (1.0 - smoothstep(0.86, 1.02, across)) * smoothstep(0.15, 0.5, revealed);
        if (mask > 0.04 && flank > 0.5 && uFlowAmt > 0.02) {
          vec2 uv = vec2(fract(across * 1.4), fract(along * 1.5 - uTime * 0.04));
          uv.x = fract(uv.x + sin(along * 9.0 + uTime * 0.064) * 0.03);
          vec3 crust = texture2D(uLavaColor, uv).rgb;
          vec3 glow = texture2D(uLavaEmit, vec2(uv.x * 1.2, fract(uv.y + uTime * 0.016))).rgb;
          float cracks = clamp(glow.r * 1.35 + crust.r * 0.35, 0.0, 1.4);
          float core = smoothstep(0.72, 0.05, across);
          vec3 crustCol = vec3(0.22, 0.055, 0.012);
          vec3 magma = vec3(1.0, 0.36, 0.04);
          vec3 whiteHot = vec3(1.0, 0.82, 0.35);
          vec3 col = mix(crustCol, magma, 0.72 + 0.28 * smoothstep(0.08, 0.5, cracks));
          col = mix(col, whiteHot, smoothstep(0.45, 0.92, cracks) * (0.35 + uHot * 0.3) * core);
          col = mix(col, crustCol, smoothstep(0.78, 1.0, across) * 0.55);
          float lambert = 0.62 + 0.38 * clamp(dot(nLoc, normalize(vec3(0.35, 0.86, 0.28))), 0.0, 1.0);
          col *= lambert * (0.92 + cracks * 0.35) * mix(0.7, 1.0, uFlowAmt);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, col, mask);
        }`);
  };
  rockMat.customProgramCacheKey = () => 'volcano-triplanar-v6-flow';

  // Meshopt quantization stores the sculpt in a normalized box and puts the
  // real tabletop size on the node. The geometry alone is several times too big.
  gltf.scene.updateMatrixWorld(true);
  let rockGeo = null;
  gltf.scene.traverse((obj) => {
    if (obj.isMesh && !rockGeo) {
      rockGeo = obj.geometry.clone();
      rockGeo.applyMatrix4(obj.matrixWorld);
    }
  });
  if (!rockGeo) throw new Error('mesh');
  // The compressed normal accessor is a normalized integer. Writing unit
  // floats into it truncates to 0 and the rock renders unlit.
  rockGeo.deleteAttribute('normal');
  rockGeo.computeVertexNormals();
  try { rockGeo.computeTangents(); } catch (e) { /* derivative normals still shade */ }
  const rock = new THREE.Mesh(rockGeo, rockMat);
  shake.add(rock);

  const poolMat = makeLavaMaterial(0, false);
  poolMat.uniforms.uColor.value = lavaColor;
  poolMat.uniforms.uEmit.value = lavaEmit;
  flowMapUniform.value = buildFlowMask(paths);
  pool = new THREE.Mesh(new THREE.CircleGeometry(meta.poolR * 1.65, 56), poolMat);
  bombMat.uniforms.uColor.value = lavaColor;
  bombMat.uniforms.uEmit.value = lavaEmit;
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = meta.poolY;
  pool.renderOrder = 2;
  shake.add(pool);
  craterLight.position.y = meta.poolY + 0.01;
  craterGlow.position.y = meta.poolY + 0.012;
  outerGlow.position.y = meta.poolY + 0.014;
}

// ---------- Ejecta (irregular bombs, streak sparks, soft ash) ----------
const tmpM = new THREE.Matrix4();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const rollQ = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);
const camQ = new THREE.Quaternion();
const parentQ = new THREE.Quaternion();
const localQ = new THREE.Quaternion();
function makeBombGeo() {
  const geo = new THREE.SphereGeometry(1, 18, 14);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    x /= len; y /= len; z /= len;
    const lump = 0.82
      + 0.14 * Math.sin(x * 2.4 + 0.5) * Math.cos(y * 2.0 + z)
      + 0.08 * Math.sin(z * 3.1 + y);
    p.setXYZ(i, x * lump * 1.12, y * lump * 0.78, z * lump);
  }
  geo.computeVertexNormals();
  return geo;
}
function makeStreakGeo() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.16, 0, 0, 0.16, 0, 0, -0.5, 1, 0, 0.5, 1, 0,
  ], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 0, 1, 1, 1,
  ], 2));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  return geo;
}
function quatAlongY(dir, roll, target) {
  tmpDir.copy(dir);
  if (tmpDir.lengthSq() < 1e-8) tmpDir.set(0, 1, 0);
  else tmpDir.normalize();
  target.setFromUnitVectors(yAxis, tmpDir);
  if (roll) {
    rollQ.setFromAxisAngle(tmpDir, roll);
    target.premultiply(rollQ);
  }
}
const BOMB_N = 42;
const SPARK_N = 48;
const bombGeo = makeBombGeo();
const bombHeat = new THREE.InstancedBufferAttribute(new Float32Array(BOMB_N), 1);
bombGeo.setAttribute('aHeat', bombHeat);
const bombMat = new THREE.ShaderMaterial({
  toneMapped: false,
  depthWrite: true,
  uniforms: { uColor: { value: null }, uEmit: { value: null }, uTime },
  vertexShader: `
    attribute float aHeat;
    varying float vH;
    varying vec3 vN;
    varying vec2 vUv;
    void main() {
      vH = aHeat;
      vUv = uv + vec2(float(gl_InstanceID) * 0.17, 0.0);
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform sampler2D uColor;
    uniform sampler2D uEmit;
    uniform float uTime;
    varying float vH;
    varying vec3 vN;
    varying vec2 vUv;
    void main() {
      vec2 uv = fract(vUv * vec2(1.6, 1.2) + vec2(0.0, -uTime * 0.12));
      vec3 crust = texture2D(uColor, uv).rgb;
      vec3 glow = texture2D(uEmit, fract(uv * 1.35 + 0.2)).rgb;
      float h = clamp(vH, 0.0, 1.0);
      float crack = smoothstep(0.42, 0.82, glow.r);
      vec3 dark = vec3(0.045, 0.042, 0.04);
      vec3 hotCrust = vec3(0.11, 0.035, 0.015);
      vec3 col = mix(dark, hotCrust, h);
      col = mix(col, vec3(1.0, 0.28, 0.03), crack * h);
      col += vec3(1.0, 0.45, 0.08) * pow(crack, 2.0) * h;
      float shade = 0.62 + 0.38 * clamp(dot(normalize(vN), vec3(0.3, 0.84, 0.28)), 0.0, 1.0);
      float fade = smoothstep(0.0, 0.22, h);
      if (fade < 0.04) discard;
      if (fade < 0.97) {
        float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        if (dither > fade) discard;
      }
      gl_FragColor = vec4(col * shade, 1.0);
    }
  `,
});
const bombsMesh = new THREE.InstancedMesh(bombGeo, bombMat, BOMB_N);
bombsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
bombsMesh.frustumCulled = false;
shake.add(bombsMesh);
const bombs = Array.from({ length: BOMB_N }, () => ({
  alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(),
  life: 0, max: 6, s: 0.01, sx: 1, sz: 1, heat: 1, roll: 0, spin: 1, bounces: 0,
}));
const streakGeo = makeStreakGeo();
const sparkHeat = new THREE.InstancedBufferAttribute(new Float32Array(SPARK_N), 1);
const trailHeat = new THREE.InstancedBufferAttribute(new Float32Array(BOMB_N), 1);
function makeStreakMesh(heatAttr, n) {
  const geo = streakGeo.clone();
  geo.setAttribute('aHeat', heatAttr);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute float aHeat;
      varying float vH;
      varying vec2 vUv;
      void main() {
        vH = aHeat;
        vUv = uv;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vH;
      varying vec2 vUv;
      void main() {
        float across = smoothstep(0.0, 0.28, vUv.x) * smoothstep(1.0, 0.72, vUv.x);
        float along = smoothstep(0.0, 0.35, vUv.y);
        float a = across * along * clamp(vH, 0.0, 1.0);
        if (a < 0.02) discard;
        vec3 col = mix(vec3(0.8, 0.16, 0.02), vec3(1.0, 0.92, 0.5), pow(vUv.y, 1.15));
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  shake.add(mesh);
  return mesh;
}
const sparksMesh = makeStreakMesh(sparkHeat, SPARK_N);
const trailsMesh = makeStreakMesh(trailHeat, BOMB_N);
const sparks = Array.from({ length: SPARK_N }, () => ({
  alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 0.45, heat: 1,
}));

const PUFF_N = 48;
const puffGeo = new THREE.PlaneGeometry(1, 1);
const puffOp = new THREE.InstancedBufferAttribute(new Float32Array(PUFF_N), 1);
const puffCol = new THREE.InstancedBufferAttribute(new Float32Array(PUFF_N * 3), 3);
puffGeo.setAttribute('aOpacity', puffOp);
puffGeo.setAttribute('aColor', puffCol);
const puffMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: { uMap: { value: softTex }, uHot },
  vertexShader: `
    attribute float aOpacity;
    attribute vec3 aColor;
    varying float vO;
    varying vec3 vC;
    varying vec2 vUv;
    void main() {
      vO = aOpacity;
      vC = aColor;
      vUv = uv;
      vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform sampler2D uMap;
    uniform float uHot;
    varying float vO;
    varying vec3 vC;
    varying vec2 vUv;
    void main() {
      vec2 q = vUv * 2.0 - 1.0;
      float r = length(q);
      float grain = 0.5 + 0.5 * sin(q.x * 8.0 + q.y * 6.0);
      float ash = smoothstep(0.28, 0.16, vC.r);
      float dens = smoothstep(mix(1.02, 1.35, ash), 0.0, r + (grain - 0.5) * 0.16);
      float core = smoothstep(0.85, 0.05, r);
      float under = smoothstep(0.05, 0.95, 1.0 - vUv.y);
      vec3 cool = vec3(0.34, 0.35, 0.37);
      vec3 warm = vec3(1.0, 0.4, 0.07);
      float lit = clamp(vC.b, 0.0, 1.0);
      float warmMix = clamp(lit * (0.12 + 0.88 * under) * (0.5 + 0.35 * uHot) * (1.0 - ash * 0.75), 0.0, 1.0);
      vec3 col = mix(cool, warm, warmMix);
      col += warm * lit * under * 0.32 * (1.0 - ash);
      col *= (0.75 + 0.5 * core);
      float a = dens * vO * mix(0.35 + 0.65 * core, 0.22, ash);
      if (a < 0.02) discard;
      gl_FragColor = vec4(col, a);
    }
  `,
});
const puffs = new THREE.InstancedMesh(puffGeo, puffMat, PUFF_N);
puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
puffs.frustumCulled = false;
puffs.renderOrder = 2;
shake.add(puffs);
const puffParts = Array.from({ length: PUFF_N }, (_, i) => ({
  alive: false, ash: i >= 32, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 2.4, s: 0.05,
}));
const hiddenM = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < PUFF_N; i++) puffs.setMatrixAt(i, hiddenM);
for (let i = 0; i < BOMB_N; i++) {
  bombsMesh.setMatrixAt(i, hiddenM);
  trailsMesh.setMatrixAt(i, hiddenM);
}
for (let i = 0; i < SPARK_N; i++) sparksMesh.setMatrixAt(i, hiddenM);

function flankY(x, z) {
  const r = Math.hypot(x, z);
  if (r < 0.02) return Math.max(0.02, H - 0.05);
  const u = Math.min(1, (r - 0.02) / 0.16);
  return Math.max(0.004, (H - 0.008) * Math.pow(1 - u, 0.8));
}
function killAllParticles() {
  for (const q of bombs) q.alive = false;
  for (const q of sparks) q.alive = false;
  for (const q of puffParts) q.alive = false;
  for (let i = 0; i < BOMB_N; i++) {
    bombsMesh.setMatrixAt(i, hiddenM);
    bombHeat.setX(i, 0);
    trailsMesh.setMatrixAt(i, hiddenM);
    trailHeat.setX(i, 0);
  }
  for (let i = 0; i < SPARK_N; i++) {
    sparksMesh.setMatrixAt(i, hiddenM);
    sparkHeat.setX(i, 0);
  }
  for (let i = 0; i < PUFF_N; i++) { puffs.setMatrixAt(i, hiddenM); puffOp.setX(i, 0); }
  bombsMesh.instanceMatrix.needsUpdate = true;
  sparksMesh.instanceMatrix.needsUpdate = true;
  trailsMesh.instanceMatrix.needsUpdate = true;
  bombHeat.needsUpdate = true;
  sparkHeat.needsUpdate = true;
  trailHeat.needsUpdate = true;
  puffs.instanceMatrix.needsUpdate = true;
  puffOp.needsUpdate = true;
}
function spawnBomb() {
  for (const q of bombs) {
    if (q.alive) continue;
    q.alive = true; q.life = 0; q.heat = 1;
    q.roll = Math.random() * Math.PI * 2;
    q.spin = (Math.random() - 0.5) * 2.2;
    q.sx = 0.75 + Math.random() * 0.5;
    q.sz = 0.7 + Math.random() * 0.55;
    q.bounces = 0;
    const ang = Math.random() * Math.PI * 2;
    const kind = Math.random();
    // Every clot clears the rim. High arcs still rise, but lateral speed carries them onto the flanks or the table.
    const out = kind < 0.35 ? 0.1 + Math.random() * 0.08 : kind < 0.8 ? 0.16 + Math.random() * 0.1 : 0.12 + Math.random() * 0.08;
    const up = kind < 0.35 ? 0.55 + Math.random() * 0.35 : kind < 0.8 ? 0.42 + Math.random() * 0.32 : 0.95 + Math.random() * 0.3;
    const r = 0.004 + Math.random() * 0.008;
    q.p.set(Math.cos(ang) * r, poolSurface + 0.006, Math.sin(ang) * r);
    q.v.set(Math.cos(ang) * out, up, Math.sin(ang) * out);
    q.max = 6.5;
    q.s = 0.0046 + Math.random() * 0.0032;
    return;
  }
}
function spawnSpark() {
  for (const q of sparks) {
    if (q.alive) continue;
    q.alive = true; q.life = 0; q.heat = 1;
    const ang = Math.random() * Math.PI * 2;
    const out = 0.1 + Math.random() * 0.18;
    q.p.set(Math.cos(ang) * 0.005, poolSurface + 0.006, Math.sin(ang) * 0.005);
    q.v.set(Math.cos(ang) * out, 0.55 + Math.random() * 0.7, Math.sin(ang) * out);
    q.max = 0.28 + Math.random() * 0.22;
    return;
  }
}
function spawnPuff(ash) {
  for (const q of puffParts) {
    if (q.alive) continue;
    q.alive = true; q.ash = ash; q.life = 0;
    if (ash) {
      q.p.set((Math.random() - 0.5) * 0.04, H + 0.02 + Math.random() * 0.14, (Math.random() - 0.5) * 0.04);
      q.v.set((Math.random() - 0.5) * 0.02, 0.035 + Math.random() * 0.04, (Math.random() - 0.5) * 0.02);
      q.max = 3.6 + Math.random() * 0.8;
      q.s = 0.1;
    } else {
      q.p.set((Math.random() - 0.5) * 0.02, H + 0.012 + Math.random() * 0.02, (Math.random() - 0.5) * 0.02);
      q.v.set((Math.random() - 0.5) * 0.035, 0.1 + Math.random() * 0.09, (Math.random() - 0.5) * 0.035);
      q.max = 3.1 + Math.random() * 0.7;
      q.s = 0.11;
    }
    return;
  }
}
function placeStreak(mesh, heatAttr, i, pos, dir, length, width, heat) {
  quatAlongY(dir, 0, tmpQ);
  tmpP.copy(pos).addScaledVector(tmpDir, -length);
  tmpS.set(width, Math.max(0.004, length), 1);
  tmpM.compose(tmpP, tmpQ, tmpS);
  mesh.setMatrixAt(i, tmpM);
  heatAttr.setX(i, heat);
}

let erupting = false, eruptAge = 0, spawnAcc = 0, sparkAcc = 0, puffAcc = 0, cardTimer = 0;
const ERUPT_LEN = 3.3;
const FLOW_SECS = 14;

function stopErupt() {
  erupting = false; eruptAge = 0; spawnAcc = 0; sparkAcc = 0; puffAcc = 0;
  clearTimeout(cardTimer);
  card.hidden = true;
  killAllParticles();
  uFront.value = 0;
  uFlowAmt.value = 0;
  craterLight.intensity = 0.012;
  craterGlow.scale.set(0.028, 0.02, 1);
  outerGlow.scale.set(0.05, 0.036, 1);
  uErupt.value = 0.22;
  uHot.value = 0.4;
  shake.rotation.set(0, 0, 0);
  shake.position.y = 0;
}
function erupt() {
  if (!volcano.visible) return;
  erupting = true; eruptAge = 0; spawnAcc = 0; puffAcc = 0; sparkAcc = 0;
  for (let i = 0; i < 8; i++) spawnBomb();
  for (let i = 0; i < 8; i++) spawnSpark();
  for (let i = 0; i < 16; i++) spawnPuff(i > 11);
  card.hidden = true;
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => { card.hidden = false; }, 15000);
  if (navigator.vibrate && navigator.userActivation && navigator.userActivation.isActive) navigator.vibrate([35, 40, 55]);
  startRumble();
}
function updateEruption(dt, time) {
  const hot = erupting && eruptAge < ERUPT_LEN;
  if (erupting) eruptAge += dt;
  const fade = !erupting ? 0 : eruptAge < ERUPT_LEN ? 1 : Math.max(0, 1 - (eruptAge - ERUPT_LEN) / 2.4);
  const glow = !erupting ? 0 : eruptAge < FLOW_SECS ? 1 : Math.max(0, 1 - (eruptAge - FLOW_SECS) / 2.2);
  const reveal = erupting ? Math.min(1, eruptAge / FLOW_SECS) : 0;
  uTime.value = time;
  uHot.value = 0.35 + glow * 1.05;
  uErupt.value = 0.22 + glow * 1.65;
  uFront.value = reveal;
  uFlowAmt.value = reveal > 0.015 && glow > 0.02 ? glow : 0;
  const pulse = 0.85 + (hot ? 0.15 * Math.sin(time * 28) : 0);
  const lit = Math.max(fade, glow * 0.85);
  craterLight.intensity = 0.012 + lit * 0.04 * pulse;
  const gs = 0.026 + lit * 0.018;
  craterGlow.scale.set(gs, gs * 0.7, 1);
  outerGlow.scale.set(gs * 1.7, gs * 1.15, 1);
  craterGlow.material.opacity = 0.4 + lit * 0.45;
  if (pool) pool.material.uniforms.uBoil.value = 0.0012 + Math.max(fade, glow * 0.65) * 0.0036;

  if (hot) {
    spawnAcc += dt * 18; sparkAcc += dt * 20; puffAcc += dt * 28;
    let n = spawnAcc | 0; spawnAcc -= n;
    while (n-- > 0) spawnBomb();
    let s = sparkAcc | 0; sparkAcc -= s;
    while (s-- > 0) spawnSpark();
    let m = puffAcc | 0; puffAcc -= m;
    while (m-- > 0) spawnPuff(Math.random() < 0.45);
  }

  for (let i = 0; i < BOMB_N; i++) {
    const q = bombs[i];
    if (!q.alive) {
      bombsMesh.setMatrixAt(i, hiddenM);
      bombHeat.setX(i, 0);
      trailsMesh.setMatrixAt(i, hiddenM);
      trailHeat.setX(i, 0);
      continue;
    }
    q.life += dt;
    q.v.y -= 1.7 * dt;
    q.p.addScaledVector(q.v, dt);
    q.roll += dt * q.spin;
    const rad = Math.hypot(q.p.x, q.p.z);
    const overVent = rad < 0.04 && q.p.y > poolSurface;
    const gy = rad > 0.17 ? 0.004 : flankY(q.p.x, q.p.z);
    if (!overVent && q.p.y <= gy + q.s * 0.45 && q.v.y <= 0) {
      q.p.y = gy + q.s * 0.4;
      const impact = -q.v.y;
      if (impact > 0.18 && q.bounces < 2) {
        q.v.y = impact * (0.28 + Math.random() * 0.1);
        q.v.x *= 0.5;
        q.v.z *= 0.5;
        const push = rad > 0.001 ? 0.07 / rad : 0;
        q.v.x += q.p.x * push;
        q.v.z += q.p.z * push;
        q.bounces++;
      } else {
        q.v.y = 0;
        if (rad > 0.05 && rad < 0.16) {
          q.v.x += (q.p.x / rad) * 0.45 * dt;
          q.v.z += (q.p.z / rad) * 0.45 * dt;
        }
        const drag = Math.max(0, 1 - dt * 2.4);
        q.v.x *= drag;
        q.v.z *= drag;
        if (q.v.lengthSq() < 0.0004) q.v.set(0, 0, 0);
        q.spin *= Math.max(0, 1 - dt * 1.5);
      }
      q.heat -= dt * 0.08;
    } else {
      q.heat -= dt * 0.06;
    }
    if (q.life > q.max || q.heat <= 0.02 || q.p.y < -0.02) q.alive = false;
    if (!q.alive) {
      bombsMesh.setMatrixAt(i, hiddenM);
      bombHeat.setX(i, 0);
      trailsMesh.setMatrixAt(i, hiddenM);
      trailHeat.setX(i, 0);
      continue;
    }
    const speed = q.v.length();
    const stretch = speed > 0.12 ? 1.25 + Math.min(0.7, speed * 0.6) : 1.05;
    quatAlongY(q.v, q.roll, tmpQ);
    tmpS.set(q.s * q.sx, q.s * stretch, q.s * q.sz);
    tmpM.compose(q.p, tmpQ, tmpS);
    bombsMesh.setMatrixAt(i, tmpM);
    bombHeat.setX(i, Math.max(0, q.heat));
    if (speed > 0.06 && q.heat > 0.12) {
      placeStreak(trailsMesh, trailHeat, i, q.p, q.v, Math.min(0.026, 0.008 + speed * 0.018), 0.0075, q.heat);
    } else {
      trailsMesh.setMatrixAt(i, hiddenM);
      trailHeat.setX(i, 0);
    }
  }
  bombsMesh.instanceMatrix.needsUpdate = true;
  trailsMesh.instanceMatrix.needsUpdate = true;
  bombHeat.needsUpdate = true;
  trailHeat.needsUpdate = true;

  for (let i = 0; i < SPARK_N; i++) {
    const q = sparks[i];
    if (!q.alive) { sparksMesh.setMatrixAt(i, hiddenM); sparkHeat.setX(i, 0); continue; }
    q.life += dt;
    q.v.y -= 1.15 * dt;
    q.p.addScaledVector(q.v, dt);
    const k = q.life / q.max;
    if (k >= 1 || q.p.y < 0) { q.alive = false; sparksMesh.setMatrixAt(i, hiddenM); sparkHeat.setX(i, 0); continue; }
    const speed = q.v.length();
    placeStreak(sparksMesh, sparkHeat, i, q.p, q.v, Math.min(0.032, 0.01 + speed * 0.02), 0.0032, (1 - k));
  }
  sparksMesh.instanceMatrix.needsUpdate = true;
  sparkHeat.needsUpdate = true;

  shake.getWorldQuaternion(parentQ);
  const viewCam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  viewCam.getWorldQuaternion(camQ);
  localQ.copy(parentQ).invert().multiply(camQ);
  let puffAny = false;
  for (let i = 0; i < PUFF_N; i++) {
    const q = puffParts[i];
    if (!q.alive) continue;
    puffAny = true;
    q.life += dt;
    q.v.y += dt * (q.ash ? 0.02 : 0.05);
    q.v.x += Math.sin(time * 0.7 + i) * dt * 0.02;
    q.p.addScaledVector(q.v, dt);
    const k = q.life / q.max;
    if (k >= 1) { q.alive = false; puffs.setMatrixAt(i, hiddenM); puffOp.setX(i, 0); continue; }
    const grow = q.s + k * (q.ash ? 0.2 : 0.2);
    const env = Math.sin(Math.min(1, k) * Math.PI);
    const op = (0.3 + 0.7 * env) * (q.ash ? 0.32 : 0.72) * (erupting ? Math.max(fade, 0.5) : 0);
    tmpS.set(grow, grow, 1);
    tmpM.compose(q.p, localQ, tmpS);
    puffs.setMatrixAt(i, tmpM);
    puffOp.setX(i, op);
    const gray = q.ash ? 0.2 + k * 0.1 : 0.3 + k * 0.18;
    const nearVent = Math.max(0, 1 - Math.max(0, q.p.y - H) / 0.16);
    puffCol.setXYZ(i, gray * 0.95, gray * 0.95, nearVent);
  }
  if (puffAny || erupting) {
    puffs.instanceMatrix.needsUpdate = true;
    puffOp.needsUpdate = true;
    puffCol.needsUpdate = true;
  }

  const rumble = hot ? fade : glow * 0.25;
  shake.rotation.x = Math.sin(time * 29) * 0.012 * rumble;
  shake.rotation.z = Math.cos(time * 23) * 0.01 * rumble;
  shake.position.y = Math.abs(Math.sin(time * 21)) * 0.0018 * rumble;
  if (erupting && eruptAge > FLOW_SECS + 2.4) erupting = false;
}

function aliveCount() {
  let n = 0;
  for (const q of bombs) if (q.alive) n++;
  for (const q of sparks) if (q.alive) n++;
  for (const q of puffParts) if (q.alive) n++;
  return n;
}

// ---------- Sound (synthesized, no files) ----------
let audio = null, muted = false, nextCrack = 0;
function ensureAudio() {
  if (audio || muted) return audio;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = (b0 + 0.02 * w) / 1.02;
      d[i] = b0 * 3.2;
    }
    const crack = ctx.createBuffer(1, (ctx.sampleRate * 0.09) | 0, ctx.sampleRate);
    const cd = crack.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / cd.length);
    function loop(buffer, type, freq) {
      const src = ctx.createBufferSource();
      src.buffer = buffer; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type; filter.frequency.value = freq;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter); filter.connect(gain); gain.connect(master); src.start();
      return gain;
    }
    audio = { ctx, master, rumble: loop(noise, 'lowpass', 130), hiss: loop(noise, 'highpass', 900), crack };
    return audio;
  } catch (e) { return null; }
}
function startRumble() {
  const a = ensureAudio();
  if (!a) return;
  if (a.ctx.state === 'suspended') a.ctx.resume();
  const now = a.ctx.currentTime;
  for (const g of [a.rumble, a.hiss]) g.gain.cancelScheduledValues(now);
  a.rumble.gain.setValueAtTime(a.rumble.gain.value, now);
  a.rumble.gain.linearRampToValueAtTime(0.55, now + 0.12);
  a.rumble.gain.linearRampToValueAtTime(0.28, now + 2.4);
  a.rumble.gain.linearRampToValueAtTime(0, now + 4.4);
  a.hiss.gain.setValueAtTime(0, now);
  a.hiss.gain.linearRampToValueAtTime(0.08, now + 0.2);
  a.hiss.gain.linearRampToValueAtTime(0, now + 3.6);
  nextCrack = now + 0.1;
}
function updateAudio() {
  if (!audio || !erupting || eruptAge > ERUPT_LEN) return;
  const now = audio.ctx.currentTime;
  if (now < nextCrack) return;
  const src = audio.ctx.createBufferSource();
  src.buffer = audio.crack;
  const g = audio.ctx.createGain();
  g.gain.value = 0.12;
  src.connect(g); g.connect(audio.master); src.start();
  nextCrack = now + 0.1 + Math.random() * 0.2;
}
muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', muted ? 'Pornește sunetul' : 'Oprește sunetul');
  if (audio) audio.master.gain.value = muted ? 0 : 0.55;
});



function focusCrater() {
  const controls = getControls();
  camera.near = 0.002;
  camera.fov = 42;
  camera.updateProjectionMatrix();
  camera.position.set(0.004, H + 0.036, 0.01);
  camera.lookAt(0, poolSurface, -0.004);
  puffs.visible = false;
  bombsMesh.visible = false;
  sparksMesh.visible = false;
  trailsMesh.visible = false;
  if (controls) controls.enabled = false;
}
function focusRim() {
  const controls = getControls();
  camera.near = 0.002;
  camera.fov = 42;
  camera.updateProjectionMatrix();
  camera.position.set(0.03, H + 0.12, 0.09);
  camera.lookAt(0, poolSurface + 0.01, 0);
  bombsMesh.visible = true;
  sparksMesh.visible = true;
  trailsMesh.visible = true;
  puffs.visible = true;
  if (controls) controls.enabled = false;
}
function focusSide() {
  const controls = getControls();
  camera.near = 0.004;
  camera.fov = 40;
  camera.updateProjectionMatrix();
  camera.position.set(0.34, H + 0.02, 0.04);
  camera.lookAt(0, H * 0.45, 0);
  bombsMesh.visible = true;
  sparksMesh.visible = true;
  trailsMesh.visible = true;
  puffs.visible = true;
  if (controls) controls.enabled = false;
}

  return {
    id: 'volcano',
    root: volcano,
    load: loadVolcano,
    update(dt, time) { updateEruption(dt, time); updateAudio(); },
    onPrimary: erupt,
    onLift() { stopErupt(); },
    onLeave() { stopErupt(); },
    particles: aliveCount,
    focusCrater,
    focusRim,
    focusSide,
    preview: {
      position: [0.4, 0.3, 0.48],
      target: [0, 0.08, 0],
      minDistance: 0.05,
      maxDistance: 1.6,
      maxPolarAngle: Math.PI * 0.49,
      fov: 50,
      near: 0.004,
    },
    hints: {
      preview: 'Mod previzualizare 3D: rotește cu degetul sau mouse-ul, apoi apasă „Erupe!”',
      found: 'Am găsit masa! Atinge ecranul ca să pui vulcanul 🌋',
      placed: 'Super! Acum apasă „Erupe!” 🔥',
      move: 'Caută un loc nou pe masă și atinge ecranul 👆',
      ready: 'Telefonul tău știe AR! Apasă „Pornește AR” și pune vulcanul pe masă. (Sau încearcă aici în 3D.)',
    },
    primaryLabel: '🔥 Erupe!',
    moveLabel: '↺ Mută vulcanul',
    loaderText: 'Se încarcă vulcanul…',
  };
}
