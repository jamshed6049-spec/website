// Redline Syndicate — procedural STEM Racing car.
// One unit = 10 mm. Nose points to +x, up is +y, the car's left side faces +z.
// Shared by the website and the Instagram reel renders.
import * as THREE from 'three';

export const BRAND = {
  red: '#DE323C',
  redDeep: '#A8212A',
  ink: '#0B0A0A',
  paper: '#ECEAE7',
  white: '#F4F3F0',
};

export const DIMS = { length: 21, rearAxleX: 3.0, frontAxleX: 15.6, wheelR: 1.4, wheelW: 1.3, rearTrack: 2.55, frontTrack: 2.2 };

// [t, halfWidth, halfHeight, centreY]; t = 0 at the rear (canister face), 1 at the nose tip.
const PROFILE = [
  [0.0, 1.38, 1.38, 2.7],
  [0.12, 1.36, 1.36, 2.68],
  [0.24, 1.18, 1.2, 2.55],
  [0.34, 0.86, 0.92, 2.2],
  [0.46, 0.66, 0.75, 1.9],
  [0.6, 0.56, 0.63, 1.7],
  [0.72, 0.5, 0.53, 1.55],
  [0.82, 0.42, 0.43, 1.4],
  [0.92, 0.27, 0.29, 1.2],
  [1.0, 0.035, 0.04, 1.03],
];

function sampleProfile(t) {
  // Catmull-Rom through the profile table, per column.
  const P = PROFILE;
  let i = 0;
  while (i < P.length - 2 && t > P[i + 1][0]) i++;
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
  const u = THREE.MathUtils.clamp((t - p1[0]) / (p2[0] - p1[0]), 0, 1);
  const out = [];
  for (let c = 1; c < 4; c++) {
    const m1 = (p2[c] - p0[c]) / Math.max(1e-6, p2[0] - p0[0]) * (p2[0] - p1[0]);
    const m2 = (p3[c] - p1[c]) / Math.max(1e-6, p3[0] - p1[0]) * (p2[0] - p1[0]);
    const u2 = u * u, u3 = u2 * u;
    out.push((2 * u3 - 3 * u2 + 1) * p1[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[c] + (u3 - u2) * m2);
  }
  return { hw: out[0], hh: out[1], cy: out[2] };
}

// Superellipse cross-section. phi = 0 bottom, PI/2 right side (-z), PI top, 3PI/2 left side (+z).
function section(phi, hw, hh) {
  const s = Math.sin(phi), c = Math.cos(phi);
  const nTop = 2.35, nBot = 3.6; // flatter floor
  const n = c > 0 ? nBot : nTop;
  const y = -hh * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
  const z = -hw * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
  return [y, z];
}

export function circumferenceAt(t) {
  const { hw, hh } = sampleProfile(t);
  let len = 0, prev = section(0, hw, hh);
  for (let k = 1; k <= 64; k++) {
    const p = section((k / 64) * Math.PI * 2, hw, hh);
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return len;
}

function buildBodyGeometry(N = 180, M = 72) {
  const L = DIMS.length;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const { hw, hh, cy } = sampleProfile(t);
    for (let j = 0; j <= M; j++) {
      const phi = (j / M) * Math.PI * 2;
      const [y, z] = section(phi, hw, hh);
      pos.push(t * L, cy + y, z);
      uv.push(t, j / M);
    }
  }
  const row = M + 1;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * row + j, b = a + row, c = b + 1, d = a + 1;
      idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Weld the seam normals (j = 0 and j = M share a position).
  const n = g.attributes.normal;
  for (let i = 0; i <= N; i++) {
    const a = i * row, b = i * row + M;
    const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
  }
  return g;
}

function buildRearFace(M = 72, holeR = 0.98) {
  // Ring between the rear cross-section and the canister hole.
  const { hw, hh, cy } = sampleProfile(0);
  const pos = [], idx = [];
  for (let j = 0; j <= M; j++) {
    const phi = (j / M) * Math.PI * 2;
    const [y, z] = section(phi, hw, hh);
    pos.push(0, cy + y, z);
    pos.push(0, cy - holeR * Math.cos(phi), -holeR * Math.sin(phi));
  }
  for (let j = 0; j < M; j++) {
    const o = j * 2, i0 = o + 1, o1 = o + 2, i1 = o + 3;
    idx.push(o, i0, o1, i0, i1, o1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // Sample the red flank of the livery so the rear face reads as painted.
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0).map((_, i) => (i % 2 ? 0.75 : 0.004)), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function airfoilShape(chord, thick, camber = 0.04) {
  const s = new THREE.Shape();
  const N = 40, up = [], lo = [];
  for (let i = 0; i <= N; i++) {
    const x = (1 - Math.cos((i / N) * Math.PI)) / 2; // cosine spacing
    const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = camber * (x < 0.4 ? (2 * 0.4 * x - x * x) / 0.16 : ((1 - 0.8) + 2 * 0.4 * x - x * x) / 0.36);
    up.push([x * chord, (yc + yt) * chord]);
    lo.push([x * chord, (yc - yt) * chord]);
  }
  s.moveTo(up[0][0], up[0][1]);
  for (let i = 1; i <= N; i++) s.lineTo(up[i][0], up[i][1]);
  for (let i = N; i >= 0; i--) s.lineTo(lo[i][0], lo[i][1]);
  return s;
}

function wingGeometry(chord, thick, span, camber) {
  const g = new THREE.ExtrudeGeometry(airfoilShape(chord, thick, camber), { depth: span, bevelEnabled: false, curveSegments: 4 });
  g.translate(-chord / 2, 0, -span / 2);
  // ExtrudeGeometry runs from leading edge (x=0) to trailing edge (x=chord). Our cars fly nose to +x,
  // so flip so the leading edge faces +x.
  g.rotateY(Math.PI);
  g.computeVertexNormals();
  return g;
}

function roundedPlate(w, h, r, depth) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: depth * 0.3, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

async function loadImage(src) {
  if (!src) return null;
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

async function liveryTexture({ logoSrc } = {}) {
  try { await document.fonts.load("italic 800 80px 'Saira Variable'"); } catch (e) { /* fonts optional */ }
  const logo = await loadImage(logoSrc);
  const W = 2048, H = 1024, L = DIMS.length;
  const pxU = W / L; // px per unit along the body
  const vScale = (t) => (H / circumferenceAt(t)) / pxU; // vertical pre-stretch so decals keep proportion
  return canvasTex(W, H, (g) => {
    g.fillStyle = BRAND.white; g.fillRect(0, 0, W, H);
    // Floor in ink.
    g.fillStyle = BRAND.ink;
    g.fillRect(0, 0, W, H * 0.1); g.fillRect(0, H * 0.9, W, H * 0.1);
    // Red sweep on both flanks: wide at the canister, a hairline at the nose.
    const sweep = (mirror) => {
      const V = (v) => (mirror ? 1 - v : v) * H;
      g.beginPath();
      g.moveTo(0, V(0.55));
      g.bezierCurveTo(W * 0.25, V(0.56), W * 0.5, V(0.68), W * 0.86, V(0.735));
      g.lineTo(W * 0.985, V(0.75));
      g.lineTo(W * 0.86, V(0.765));
      g.bezierCurveTo(W * 0.6, V(0.82), W * 0.35, V(0.9), W * 0.2, V(0.9));
      g.lineTo(0, V(0.9));
      g.closePath();
      g.fillStyle = BRAND.red; g.fill();
      // ink pinstripe riding the top edge of the sweep
      g.beginPath();
      g.moveTo(0, V(0.535));
      g.bezierCurveTo(W * 0.25, V(0.545), W * 0.5, V(0.665), W * 0.86, V(0.722));
      g.lineTo(W * 0.95, V(0.732));
      g.lineWidth = H * 0.008; g.strokeStyle = BRAND.ink; g.stroke();
    };
    sweep(false); sweep(true);
    // Twin spine stripes over the top.
    g.fillStyle = BRAND.red;
    g.fillRect(W * 0.18, H * 0.462, W * 0.8, H * 0.018);
    g.fillRect(W * 0.18, H * 0.52, W * 0.8, H * 0.018);
    // Chequer band across the spine just ahead of the canister.
    const cq = 18;
    for (let a = 0; a < 6; a++) for (let b = 0; b < 4; b++) {
      g.fillStyle = (a + b) % 2 ? BRAND.ink : BRAND.white;
      g.fillRect(W * 0.12 + a * cq, H * 0.5 - 2 * cq * 1.0 + b * cq, cq, cq);
    }
    // Side decals (left flank around v = 0.75, mirrored + rotated on the right flank).
    const decal = (drawFn, tCentre, vCentre) => {
      const k = vScale(tCentre);
      // left flank
      g.save(); g.translate(W * tCentre, H * vCentre); g.scale(1, k); drawFn(); g.restore();
      // right flank: rotate 180 so it reads front-to-back from the other side
      g.save(); g.translate(W * tCentre, H * (1 - vCentre)); g.scale(1, k); g.rotate(Math.PI); drawFn(); g.restore();
    };
    decal(() => {
      g.fillStyle = BRAND.white;
      g.font = "italic 800 62px 'Saira Variable', sans-serif";
      try { g.fontStretch = 'expanded'; } catch (e) { /* older canvas */ }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('REDLINE', 0, 0);
    }, 0.47, 0.79);
    if (logo) {
      decal(() => {
        const w = 210, h = w * (logo.height / logo.width || 0.5);
        g.drawImage(logo, -w / 2, -h / 2, w, h);
      }, 0.285, 0.71);
    }
  });
}

function carbonTexture() {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#141414'; g.fillRect(0, 0, w, h);
    const s = 16;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const odd = ((x + y) / s) % 2;
      const grd = odd ? g.createLinearGradient(x, y, x + s, y) : g.createLinearGradient(x, y, x, y + s);
      grd.addColorStop(0, '#0d0d0d'); grd.addColorStop(0.5, '#262626'); grd.addColorStop(1, '#0d0d0d');
      g.fillStyle = grd; g.fillRect(x + 0.5, y + 0.5, s - 1, s - 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

function wheelFaceTexture() {
  return canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#111'; g.fillRect(0, 0, w, w);
    g.beginPath(); g.arc(c, c, c * 0.8, 0, Math.PI * 2); g.fillStyle = '#1d1d1f'; g.fill();
    g.beginPath(); g.arc(c, c, c * 0.79, 0, Math.PI * 2); g.lineWidth = 10; g.strokeStyle = BRAND.red; g.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.save(); g.translate(c, c); g.rotate(a);
      g.beginPath(); g.ellipse(0, -c * 0.47, c * 0.13, c * 0.22, 0, 0, Math.PI * 2); g.fillStyle = '#050505'; g.fill();
      g.restore();
    }
    g.beginPath(); g.arc(c, c, c * 0.16, 0, Math.PI * 2); g.fillStyle = '#c9c9cf'; g.fill();
    g.beginPath(); g.arc(c, c, c * 0.07, 0, Math.PI * 2); g.fillStyle = '#2a2a2a'; g.fill();
  });
}

function revealPaint(material) {
  material.userData.uniforms = {
    uReveal: { value: 1 },
    uPrimer: { value: new THREE.Color('#E9E7E2') },
    uSeam: { value: new THREE.Color('#FF4A55') },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, material.userData.uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uReveal;\nuniform vec3 uPrimer;\nuniform vec3 uSeam;')
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 liv = texture2D( map, vMapUv );
  float painted = 1.0 - smoothstep( uReveal - 0.012, uReveal, vMapUv.x );
  diffuseColor.rgb *= mix( uPrimer, liv.rgb, painted );
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef USE_MAP
  float seam = 1.0 - smoothstep( 0.0, 0.006, abs( vMapUv.x - uReveal ) );
  seam *= step( 0.002, uReveal ) * step( uReveal, 0.998 );
  totalEmissiveRadiance += uSeam * seam * 2.5;
#endif`);
  };
  material.customProgramCacheKey = () => 'rs-reveal-paint';
}

/**
 * Build the car.
 * @returns {Promise<{group: THREE.Group, parts: object, setReveal: Function, setExplode: Function, anchors: object, dispose: Function}>}
 */
export async function createCar({ logoSrc = null, shadows = true } = {}) {
  const group = new THREE.Group();
  group.name = 'redline-car';
  const L = DIMS.length;

  const livery = await liveryTexture({ logoSrc });
  livery.flipY = false;
  const paint = new THREE.MeshPhysicalMaterial({ map: livery, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
  revealPaint(paint);
  const carbon = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: carbonTexture(), roughness: 0.42, clearcoat: 0.9, clearcoatRoughness: 0.15 });
  const red = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(BRAND.red), roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xdadbe0, metalness: 1, roughness: 0.2 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.75 });
  const face = new THREE.MeshStandardMaterial({ map: wheelFaceTexture(), roughness: 0.45, metalness: 0.1 });
  const hole = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, side: THREE.BackSide });

  const parts = {};
  const add = (name, mesh, explodeDir, parent = group) => {
    mesh.name = name;
    mesh.castShadow = shadows; mesh.receiveShadow = shadows;
    mesh.traverse((o) => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = shadows; } });
    mesh.userData.base = mesh.position.clone();
    mesh.userData.explode = explodeDir;
    parent.add(mesh);
    parts[name] = mesh;
    return mesh;
  };

  // Body + rear face + canister bore.
  const body = new THREE.Group();
  const shell = new THREE.Mesh(buildBodyGeometry(), paint);
  const rear = new THREE.Mesh(buildRearFace(), paint);
  const { cy: rcy } = sampleProfile(0);
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 5.0, 48, 1, true), hole);
  bore.rotation.z = Math.PI / 2; bore.position.set(2.5, rcy, 0);
  body.add(shell, rear, bore);
  add('body', body, new THREE.Vector3(0, 0, 0));

  // CO2 cartridge: steel body with the neck facing rearward.
  const cartProfile = [];
  const R = 0.9, len = 5.0;
  cartProfile.push(new THREE.Vector2(0.0, -0.55));
  cartProfile.push(new THREE.Vector2(0.24, -0.55));
  cartProfile.push(new THREE.Vector2(0.26, -0.2));
  cartProfile.push(new THREE.Vector2(0.32, 0.05));
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI / 2;
    cartProfile.push(new THREE.Vector2(0.32 + (R - 0.32) * Math.sin(a), 0.05 + 1.1 * (1 - Math.cos(a))));
  }
  cartProfile.push(new THREE.Vector2(R, len - 0.6));
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI / 2;
    cartProfile.push(new THREE.Vector2(R * Math.cos(a), len - 0.6 + 0.6 * Math.sin(a)));
  }
  const cartridge = new THREE.Mesh(new THREE.LatheGeometry(cartProfile, 48), metal);
  cartridge.rotation.z = -Math.PI / 2; // lathe axis (y) -> +x
  cartridge.position.set(-0.2, rcy, 0);
  add('cartridge', cartridge, new THREE.Vector3(-9, 0, 0));

  // Front wing + pylon.
  const fwing = new THREE.Group();
  const fw = new THREE.Mesh(wingGeometry(1.75, 0.1, 6.2, 0.05), carbon);
  fw.rotation.z = THREE.MathUtils.degToRad(-5);
  fwing.add(fw);
  for (const s of [-1, 1]) {
    const ep = new THREE.Mesh(roundedPlate(1.85, 0.62, 0.2, 0.07), red);
    ep.position.set(0.05, 0.16, s * 3.12);
    fwing.add(ep);
  }
  const fpylon = new THREE.Mesh(roundedPlate(0.9, 0.5, 0.12, 0.22), carbon);
  fpylon.position.set(0.0, 0.35, 0);
  fwing.add(fpylon);
  fwing.position.set(19.0, 0.55, 0);
  add('frontWing', fwing, new THREE.Vector3(5.5, -0.6, 0));

  // Rear wing + swan-neck pylon + end plates.
  const rwing = new THREE.Group();
  const rw = new THREE.Mesh(wingGeometry(1.95, 0.11, 4.9, 0.06), carbon);
  rw.rotation.z = THREE.MathUtils.degToRad(-9);
  rwing.add(rw);
  for (const s of [-1, 1]) {
    const ep = new THREE.Mesh(roundedPlate(2.1, 1.05, 0.26, 0.08), red);
    ep.position.set(-0.05, -0.12, s * 2.48);
    rwing.add(ep);
  }
  const neck = new THREE.Mesh(roundedPlate(1.1, 0.9, 0.2, 0.14), carbon);
  neck.position.set(0.2, -0.45, 0);
  rwing.add(neck);
  rwing.position.set(1.4, 4.75, 0);
  add('rearWing', rwing, new THREE.Vector3(-2.5, 4.5, 0));

  // Wheels + axles.
  const wheelGeo = new THREE.CylinderGeometry(DIMS.wheelR, DIMS.wheelR, DIMS.wheelW, 64, 1, false);
  wheelGeo.rotateX(Math.PI / 2); // axis -> z
  const makeWheel = () => {
    const w = new THREE.Mesh(wheelGeo, [tyre, face, face]);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, DIMS.wheelW + 0.16, 24), metal);
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
    return w;
  };
  const wheels = [];
  const axleY = DIMS.wheelR;
  for (const [name, x, track] of [['rearLeft', DIMS.rearAxleX, DIMS.rearTrack], ['rearRight', DIMS.rearAxleX, -DIMS.rearTrack], ['frontLeft', DIMS.frontAxleX, DIMS.frontTrack], ['frontRight', DIMS.frontAxleX, -DIMS.frontTrack]]) {
    const w = makeWheel();
    w.position.set(x, axleY, track);
    add('wheel_' + name, w, new THREE.Vector3(0, 0, Math.sign(track) * 3.2));
    wheels.push(w);
  }
  for (const [name, x, track] of [['rearAxle', DIMS.rearAxleX, DIMS.rearTrack], ['frontAxle', DIMS.frontAxleX, DIMS.frontTrack]]) {
    const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, track * 2 + 0.3, 16), metal);
    ax.rotation.x = Math.PI / 2;
    ax.position.set(x, axleY, 0);
    add(name, ax, new THREE.Vector3(0, -2.2, 0));
  }

  // Tether line guides (screw eyes) under the floor.
  const guides = new THREE.Group();
  for (const x of [4.6, 17.2]) {
    const { cy, hh } = sampleProfile(x / L);
    const floorY = cy - hh;
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 28), metal);
    eye.rotation.y = Math.PI / 2;
    eye.position.set(x, floorY - 0.42, 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), metal);
    stem.position.set(x, floorY - 0.15, 0);
    guides.add(eye, stem);
  }
  add('guides', guides, new THREE.Vector3(0, -2.6, 0));

  // Centre the car on its footprint so rotations look natural.
  const pivot = new THREE.Group();
  pivot.add(group);
  group.position.set(-L / 2, 0, 0);

  const setReveal = (v) => { paint.userData.uniforms.uReveal.value = v; };
  const setExplode = (e) => {
    for (const p of Object.values(parts)) {
      p.position.copy(p.userData.base).addScaledVector(p.userData.explode, e);
    }
  };
  let spin = 0;
  const spinWheels = (delta) => { spin += delta; wheels.forEach((w) => { w.rotation.z = -spin; }); };

  // Callout anchors in car-local space (before the -L/2 recentre), for UI labels.
  const anchors = {
    frontWing: new THREE.Vector3(20.2, 0.6, 3.1),
    rearWing: new THREE.Vector3(1.4, 5.3, 2.5),
    cartridge: new THREE.Vector3(-0.6, rcy, 0),
    wheel: new THREE.Vector3(DIMS.frontAxleX, DIMS.wheelR, DIMS.frontTrack + 0.7),
    body: new THREE.Vector3(9.5, 2.6, 0.7),
    guides: new THREE.Vector3(17.2, 0.3, 0),
  };
  const anchorWorld = (key, target = new THREE.Vector3()) => {
    const a = anchors[key];
    const p = parts[{ frontWing: 'frontWing', rearWing: 'rearWing', cartridge: 'cartridge', wheel: 'wheel_frontLeft', body: 'body', guides: 'guides' }[key]];
    target.copy(a);
    if (p) target.add(p.position).sub(p.userData.base);
    return group.localToWorld(target);
  };

  const dispose = () => {
    pivot.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  };

  return { group: pivot, inner: group, parts, setReveal, setExplode, spinWheels, anchorWorld, dispose, materials: { paint, carbon, red, metal } };
}

/** Neutral studio reflections from RoomEnvironment. */
export async function studioEnvironment(renderer, intensity = 1) {
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  pmrem.dispose();
  return env;
}
