// HALCYON WING — character portraits.
// Visual direction: "military noir comm-screen". Anatomical busts built from the MakeHuman
// CC0 base mesh (baked by tools/build_cast.py), lit with a warm key from the cockpit side and
// a cool steel rim from behind, over deep out-of-focus backgrounds with light film grain.
// The Vharr are the same anatomy pushed into a predator: muzzle, brow plates, crest quills,
// plated hide and eyes that burn. Busts talk (jaw morph), blink, and look at the viewer.
import * as THREE from "three";

const V3 = THREE.Vector3;
const W = 480, H = 520;
let R = null, scene, cam, keyL, rimL, rim2, fillL;
const rigs = new Map();
if (typeof window !== 'undefined') window.__portraitRigs = rigs;
let DATA = null, BUF = null, loading = null;
const TL = new THREE.TextureLoader();
const BASE = new URL("./assets/", import.meta.url).href;

const NAME2ID = { "Elias Varga": "varga", "Mara Okonkwo": "vesper", "Tomas Reyes": "deacon", "Yuki Tanaka": "spark", "Danny Kowalski": "ricochet", "Isolde Lindqvist": "frost", "Amara Diaz": "halo", "Rhul Ka'den": "ember", "Rosa Delgado": "rabbit", "Geoffrey Thorne": "thorne", "Dr. Anneke Voss": "voss", "Kaerr'Vosh nar Tharun": "kaerr", "Sh'kara the Graven": "shkara", "Vharr Hunter": "vharrpilot", "Halcyon Flight Control": "comms" };
const TURN = { varga: -0.42, vesper: 0.36, deacon: 0.4, spark: -0.34, ricochet: 0.42, frost: -0.4, halo: 0.32, rabbit: -0.3, thorne: -0.5, voss: 0.35, comms: 0.3, player: -0.3, ember: -0.45, kaerr: -0.2, shkara: 0.42, vharrpilot: 0.4 };
const HAIRC = { varga: "#cfcfcf", vesper: "#141010", deacon: "#8a8580", spark: "#0e0d12", ricochet: "#7a3418", frost: "#e2d6b8", halo: "#24160e", rabbit: "#3e2416", thorne: "#b8b8b8", voss: "#8a5a32", comms: "#1a1a1a", player: "#3a2a1e" };
const IRIS = { varga: "#4a3a2a", vesper: "#2a1a10", deacon: "#3a2a1a", spark: "#1a1410", ricochet: "#4a7a4a", frost: "#7aa8c8", halo: "#3a2010", rabbit: "#3a2a1a", thorne: "#5a6a7a", voss: "#4a6a4a", comms: "#2a2a2a", player: "#3b5f7a" };
const SUIT = { varga: "#20283a", vesper: "#2e3c4c", deacon: "#4a3e30", spark: "#3a3048", ricochet: "#3c4a30", frost: "#2e3c4c", halo: "#3a4a5e", rabbit: "#5a4c24", thorne: "#15181f", voss: "#585858", comms: "#24323f", player: "#3e4c5e", ember: "#2e3c4c", kaerr: "#2a1210", shkara: "#d8d2c6", vharrpilot: "#3a2018" };
const GLOW = { ember: "#e8a040", kaerr: "#ff5a20", shkara: "#9ae0ff", vharrpilot: "#ffb030" };
const BONE = { ember: "#c8b8a0", kaerr: "#9a1a1a", shkara: "#efeae0", vharrpilot: "#a08060" };

export function preloadPortraits() {
  if (!loading) loading = Promise.all([fetch(BASE + "cast.json").then(r => r.json()), fetch(BASE + "cast.b64.txt").then(r => r.text()).then(t => { const bin = atob(t.trim()); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; })])
    .then(([j, b]) => { DATA = j; BUF = b; warmRigs(); }).catch(e => { console.warn("portrait assets unavailable", e); });
  return loading;
}

function warmRigs() {
  const ids = Object.keys(DATA.chars || {}); let i = 0;
  const step = () => { if (i >= ids.length) return; const id = ids[i++]; try { ensure(); if (!rigs.get(id)) { const r = buildRig(id); if (r) { rigs.set(id, r); pose(r, 0, 0); scene.add(r.group); R.render(scene, cam); scene.remove(r.group); } } } catch (e) { } setTimeout(step, 120); };
  setTimeout(step, 400);
}
function ensure() {
  if (R) return;
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setSize(W, H, false);
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.outputColorSpace = THREE.SRGBColorSpace;
  R.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(19, W / H, 0.5, 80);
  cam.position.set(0.0, 7.5, 10.2); cam.lookAt(0, 7.12, 0.3);
  keyL = new THREE.DirectionalLight(0xffe2c8, 2.7); keyL.position.set(-4, 9.5, 8); scene.add(keyL);
  rimL = new THREE.DirectionalLight(0x9ccfff, 5.0); rimL.position.set(5, 9, -4); scene.add(rimL);
  rim2 = new THREE.DirectionalLight(0x6a8ab8, 1.6); rim2.position.set(-6, 7, -5); scene.add(rim2);
  fillL = new THREE.HemisphereLight(0x6a80a0, 0x1a120c, 0.6); scene.add(fillL);
  preloadPortraits();
}

// ---------------------------------------------------------------- data helpers
const f32 = o => new Float32Array(BUF, o[0], o[1]);
const u32 = o => new Uint32Array(BUF, o[0], o[1]);
function geo(pos, index, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  if (uv) g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1)); g.computeVertexNormals(); return g;
}
function morphs(g, list) {
  g.morphAttributes.position = []; g.morphAttributes.normal = [];
  for (const p of list) { const m = g.clone(); m.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3)); m.computeVertexNormals(); g.morphAttributes.position.push(m.attributes.position); g.morphAttributes.normal.push(m.attributes.normal); }
  return g;
}
function tex(name, srgb = true) { const t = TL.load(BASE + name); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function hash(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz); const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash(ix, iy, iz), hash(ix + 1, iy, iz), u), L(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), u), v),
    L(L(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), u), L(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), u), v), w);
}
function strandTex() {
  const c = cv(512, 512), x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) { const px = Math.random() * 512, py = Math.random() * 512, l = 6 + Math.random() * 30; x.strokeStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`; x.lineWidth = 1 + Math.random() * 1.6; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 6, py + l); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
function fabricTex(col, vharr) {
  const c = cv(512, 512), x = c.getContext("2d"); x.fillStyle = col; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 512; i += 2) { x.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`; x.fillRect(0, i, 512, 1); x.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; x.fillRect(i, 0, 1, 512); }
  x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 3; x.setLineDash([6, 4]); for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(Math.random() * 512, 0); x.lineTo(Math.random() * 512, 512); x.stroke(); }
  if (vharr) { x.setLineDash([]); x.strokeStyle = "rgba(210,170,100,.55)"; x.lineWidth = 5; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 32, 64); x.lineTo(i * 64, 128); x.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); return t;
}
function irisTex(color, vharr) {
  const c = cv(512, 512), x = c.getContext("2d"); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image(); img.onload = () => {
    x.drawImage(img, 0, 0, 512, 512); const d = x.getImageData(0, 0, 512, 512); const tc = new THREE.Color(color); const hsl = {}; tc.getHSL(hsl); const tmp = new THREE.Color();
    for (let i = 0; i < d.data.length; i += 4) {
      const r = d.data[i] / 255, g = d.data[i + 1] / 255, b = d.data[i + 2] / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn > 0.12 && r > b * 1.15) { const l = (mx + mn) / 2; tmp.setHSL(hsl.h, vharr ? 1 : Math.max(0.25, hsl.s), vharr ? Math.min(0.9, l * 2.2) : Math.min(0.85, Math.max(0.2, l * (0.95 + hsl.l * 1.6)))); d.data[i] = tmp.r * 255; d.data[i + 1] = tmp.g * 255; d.data[i + 2] = tmp.b * 255; }
      else if (vharr) { d.data[i] *= 0.25; d.data[i + 1] *= 0.12; d.data[i + 2] *= 0.08; }
    }
    x.putImageData(d, 0, 0); t.needsUpdate = true;
  }; img.src = BASE + "eye.jpg";
  return t;
}

// ---------------------------------------------------------------- RIG
function buildRig(id) {
  const C = DATA.chars[id]; if (!C) return null;
  const vh = C.vharr;
  const rig = { id, vh, group: new THREE.Group(), bust: new THREE.Group(), morphed: [], eyes: [] };
  rig.group.add(rig.bust);
  const dy = C.eyeL[1] - 7.284; rig.group.position.y = -dy; const Y = v => v + dy;
  rig.bust.position.set(0, Y(6.2), 0.2); const inner = new THREE.Group(); inner.position.set(0, -Y(6.2), -0.2); rig.bust.add(inner);
  // ---- skin
  const sk = DATA.skin;
  const g = morphs(geo(f32(C.pos), u32(sk.index), f32(sk.uv)), [f32(C.jaw), f32(C.blink)]);
  const skinMat = vh
    ? new THREE.MeshPhysicalMaterial({ map: tex(C.tex), roughness: 0.62, metalness: 0.08, clearcoat: 0.25, clearcoatRoughness: 0.5 })
    : new THREE.MeshPhysicalMaterial({ map: tex(C.tex), roughness: 0.5, metalness: 0, sheen: 0.55, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xff9a80).multiplyScalar(0.35), clearcoat: 0.06, clearcoatRoughness: 0.5 });
  const nrm = g.attributes.normal, pos = g.attributes.position, n = pos.count;
  const idx = u32(sk.index);
  const suitMask0 = f32(sk.suit);
  { const vis = []; for (let i = 0; i < idx.length; i += 3) if (!(suitMask0[idx[i]] > 0.98 && suitMask0[idx[i + 1]] > 0.98 && suitMask0[idx[i + 2]] > 0.98)) vis.push(idx[i], idx[i + 1], idx[i + 2]); g.setIndex(vis); }
  const skin = new THREE.Mesh(g, skinMat); inner.add(skin); rig.morphed.push(skin);
  // ---- uniform: offset shell over the torso
  const suitMask = f32(sk.suit);
  const keep = []; for (let i = 0; i < idx.length; i += 3) if (suitMask[idx[i]] > 0.05 || suitMask[idx[i + 1]] > 0.05 || suitMask[idx[i + 2]] > 0.05) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  const sp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const o = 0.05 + 0.04 * suitMask[i]; sp[i * 3] = pos.getX(i) + nrm.getX(i) * o; sp[i * 3 + 1] = pos.getY(i) + nrm.getY(i) * o; sp[i * 3 + 2] = pos.getZ(i) + nrm.getZ(i) * o; }
  const sa = new Float32Array(n * 4); for (let i = 0; i < n; i++) { sa[i * 4] = sa[i * 4 + 1] = sa[i * 4 + 2] = 1; sa[i * 4 + 3] = suitMask[i]; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("uv", g.attributes.uv); sg.setAttribute("color", new THREE.BufferAttribute(sa, 4)); sg.setIndex(keep); sg.computeVertexNormals();
  inner.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: fabricTex(SUIT[id] || "#3a4a5a", vh), vertexColors: true, alphaTest: 0.5, roughness: 0.82, metalness: 0.05, side: THREE.DoubleSide })));
  { // collar: a piped band that follows the neckline
    const bins = Array.from({ length: 28 }, () => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) { const m = suitMask[i]; if (m < 0.25 || m > 0.75) continue; const x = sp[i * 3], y = sp[i * 3 + 1], z = sp[i * 3 + 2]; if (y < Y(5.7) || Math.hypot(x, z - 0.2) > 1.2) continue; const a = Math.atan2(x, z - 0.2); const b = Math.floor((a + Math.PI) / (2 * Math.PI) * 28) % 28; bins[b][0] += x; bins[b][1] += y; bins[b][2] += z; bins[b][3]++; }
    const pts = bins.filter(b => b[3] > 0).map(b => { const p = new V3(b[0] / b[3], b[1] / b[3], b[2] / b[3]); const o = new V3(p.x, 0, p.z - 0.2).normalize(); return p.addScaledVector(o, 0.03); });
    if (pts.length > 8) { const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal"); const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.065, 8, true), new THREE.MeshStandardMaterial({ color: new THREE.Color(SUIT[id] || "#3a4a5a").multiplyScalar(0.7), roughness: 0.6, metalness: 0.2 })); inner.add(tube); }
  }
  // ---- eyes (split so each can look at the camera)
  const ep = f32(C.eye), ei = u32(DATA.eye.index), euv = f32(DATA.eye.uv);
  const eyeMat = vh ? new THREE.MeshStandardMaterial({ map: irisTex(GLOW[id], true), emissive: new THREE.Color(GLOW[id]), emissiveIntensity: 0.6, roughness: 0.15 })
    : new THREE.MeshPhysicalMaterial({ map: irisTex(IRIS[id] || "#3a2a1a", false), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  for (const [cen, side] of [[C.eyeL, 1], [C.eyeR, -1]]) {
    const sel = []; const remap = new Map(); const pp = [], uu = [];
    for (let i = 0; i < ei.length; i += 3) {
      if (Math.sign(ep[ei[i] * 3]) !== side) continue;
      if ([ei[i], ei[i + 1], ei[i + 2]].every(k => euv[k * 2] > 0.78 && euv[k * 2 + 1] < 0.22)) continue;
      for (const k of [ei[i], ei[i + 1], ei[i + 2]]) { if (!remap.has(k)) { remap.set(k, pp.length / 3); pp.push(ep[k * 3] - cen[0], ep[k * 3 + 1] - cen[1], ep[k * 3 + 2] - cen[2]); uu.push(euv[k * 2], euv[k * 2 + 1]); } sel.push(remap.get(k)); }
    }
    const eg = new THREE.BufferGeometry(); eg.setAttribute("position", new THREE.Float32BufferAttribute(pp, 3)); eg.setAttribute("uv", new THREE.Float32BufferAttribute(uu, 2)); eg.setIndex(sel); eg.computeVertexNormals();
    const piv = new THREE.Group(); piv.position.set(...cen); piv.add(new THREE.Mesh(eg, eyeMat)); inner.add(piv); rig.eyes.push(piv); piv.userData.glow = GLOW[id];
  }
  // ---- mouth interior, teeth, tongue
  const toothMat = new THREE.MeshStandardMaterial({ color: vh ? 0xd8cdb0 : 0xe6dfd2, roughness: 0.35 });
  const tUp = new THREE.Mesh(geo(f32(C.teethU), u32(DATA.teethU.index)), toothMat); tUp.position.z = -0.04; tUp.userData.teeth = true; inner.add(tUp); rig.teeth = [tUp];
  const tl = new THREE.Mesh(morphs(geo(f32(C.teethL), u32(DATA.teethL.index)), [f32(C.teethLJ)]), toothMat); tl.position.z = -0.04; inner.add(tl); rig.morphed.push(tl); rig.teeth.push(tl);
  const tg = new THREE.Mesh(morphs(geo(f32(C.tongue), u32(DATA.tongue.index)), [f32(C.tongueJ)]), new THREE.MeshStandardMaterial({ color: 0x8a3a3a, roughness: 0.5 })); inner.add(tg); rig.morphed.push(tg);
  const tu = f32(C.teethU); let cx = 0, cy = 0, cz = 0; for (let i = 0; i < tu.length; i += 3) { cx += tu[i]; cy += tu[i + 1]; cz += tu[i + 2]; } const nt = tu.length / 3;
  const cav = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0x120404 })); cav.position.set(cx / nt, cy / nt - 0.12, cz / nt - 0.28); cav.scale.set(0.3, 0.2, 0.32); inner.add(cav);
  // ---- lashes (humans)
  if (!vh) for (let k = 0; k < 2; k++) { const L = C.lash[k]; const lg = morphs(geo(f32(L.pos), u32(DATA.lash[k].index)), [f32(L.pos), f32(L.blink)]); const lm = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: 0x120c0a, roughness: 0.8, side: THREE.DoubleSide })); lm.userData.lash = true; inner.add(lm); rig.morphed.push(lm); }
  // ---- hair: a sculpted cap with two softer strand layers over it
  if (C.hair) {
    const style = C.hair.style, mask = f32(C.hair.mask);
    const thick = { buzz: 0.02, short: 0.08, messy: 0.13, slick: 0.05, tied: 0.07, bun: 0.07, receding: 0.06, bob: 0.12, long: 0.1, curly: 0.2 }[style] || 0.07;
    const hcol = new THREE.Color(HAIRC[id] || "#222");
    const tris = []; for (let i = 0; i < idx.length; i += 3) if (mask[idx[i]] > 0.02 && mask[idx[i + 1]] > 0.02 && mask[idx[i + 2]] > 0.02) tris.push(idx[i], idx[i + 1], idx[i + 2]);
    const st = strandTex();
    const layers = style === "buzz" ? [[1, 1, false]] : [[0.8, 1, false], [1.0, 0.85, true], [1.18, 0.6, true]];
    for (const [k, alpha, strands] of layers) {
      const hp = new Float32Array(n * 3); const col = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const m = mask[i];
        let t = thick * k * Math.min(1, 0.35 + m * 0.9);
        if (style === "messy") t *= 0.75 + vnoise(x * 5, y * 5, z * 5) * 0.6;
        if (style === "curly") t *= 0.7 + vnoise(x * 7, y * 7, z * 7) * 0.7;
        if (style === "bob") t *= 1 + Math.max(0, Y(7.4) - y) * 0.7;
        if (style === "slick" || style === "tied" || style === "bun") t *= 1 - Math.max(0, z - 0.6) * 0.3;
        hp[i * 3] = x + nrm.getX(i) * t; hp[i * 3 + 1] = y + nrm.getY(i) * t; hp[i * 3 + 2] = z + nrm.getZ(i) * t;
        const shade = (0.8 + k * 0.2) * (0.92 + vnoise(x * 3, y * 9, z * 3) * 0.16);
        col[i * 4] = hcol.r * shade; col[i * 4 + 1] = hcol.g * shade; col[i * 4 + 2] = hcol.b * shade; col[i * 4 + 3] = Math.min(1, m * 1.25) * alpha + (strands ? 0 : 0.0);
      }
      const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.BufferAttribute(hp, 3)); hg.setAttribute("uv", g.attributes.uv); hg.setAttribute("color", new THREE.BufferAttribute(col, 4)); hg.setIndex(tris); hg.computeVertexNormals();
      inner.add(new THREE.Mesh(hg, new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, alphaMap: strands ? st : null, alphaTest: 0.5, bumpMap: st, bumpScale: 1.5, roughness: style === "slick" ? 0.3 : 0.5, sheen: 1, sheenColor: hcol.clone().lerp(new THREE.Color(0xffffff), 0.55), sheenRoughness: 0.3, side: THREE.DoubleSide })));
    }
    const ballMat = new THREE.MeshPhysicalMaterial({ color: hcol, roughness: 0.5, sheen: 0.8, sheenColor: hcol.clone().lerp(new THREE.Color(0xffffff), 0.5), bumpMap: st, bumpScale: 2 });
    if (style === "bun") { const b = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), ballMat); b.position.set(0, Y(8.2), -0.38); inner.add(b); }
    if (style === "tied") { const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 18), ballMat); b.scale.set(1, 1.15, 1); b.position.set(0, Y(7.72), -0.76); inner.add(b); }
    if (style === "long") { const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.08, 1.6, 20), ballMat); tail.position.set(0, Y(6.75), -0.62); tail.rotation.x = 0.28; inner.add(tail); const knot = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), ballMat); knot.position.set(0, Y(7.5), -0.7); inner.add(knot); }
    if (false) {
      const top = 7.45, bot = style === "bob" ? 6.62 : style === "curly" ? 6.85 : 5.55;
      const cyl = new THREE.CylinderGeometry(style === "curly" ? 1.02 : 0.93, style === "bob" ? 0.98 : style === "curly" ? 1.08 : 1.12, top - bot, 48, 8, true, 1.05, Math.PI * 2 - 2.1);
      const cp = cyl.attributes.position; for (let i = 0; i < cp.count; i++) { const yy = cp.getY(i); cp.setX(i, cp.getX(i) * 0.92 + vnoise(cp.getX(i) * 8, yy * 3, 1) * 0.04); cp.setZ(i, cp.getZ(i) * 0.95); }
      cyl.computeVertexNormals();
      const fall = new THREE.Mesh(cyl, new THREE.MeshPhysicalMaterial({ color: hcol.clone().multiplyScalar(0.9), alphaMap: null, roughness: 0.5, sheen: 1, sheenColor: hcol.clone().lerp(new THREE.Color(0xffffff), 0.55), sheenRoughness: 0.3, bumpMap: st, bumpScale: 2, side: THREE.DoubleSide }));
      fall.position.set(0, (top + bot) / 2, 0.22); inner.add(fall);
    }
    if (false) {
      const hg = geo(f32(C.hairH), u32(DATA.hairH.index), f32(DATA.hairH.uv)); const ps = hg.attributes.position; const kept = []; const hi = u32(DATA.hairH.index);
      for (let i = 0; i < hi.length; i += 3) { let ok = true; for (const k of [hi[i], hi[i + 1], hi[i + 2]]) if (ps.getY(k) > 7.4 || ps.getY(k) < 5.4 || ps.getZ(k) > 0.25) ok = false; if (ok) kept.push(hi[i], hi[i + 1], hi[i + 2]); }
      hg.setIndex(kept); hg.computeVertexNormals();
      inner.add(new THREE.Mesh(hg, new THREE.MeshPhysicalMaterial({ color: hcol.clone().multiplyScalar(0.85), roughness: 0.55, sheen: 0.8, sheenColor: hcol.clone().lerp(new THREE.Color(0xffffff), 0.5), side: THREE.DoubleSide, bumpMap: st, bumpScale: 3 })));
    }
  }
  // ---- helmet (player)
  if (C.helmet) {
    const hp = new Float32Array(n * 3); const tri = [];
    const inFace = i => { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); return y < 6.95 || (Math.atan2(Math.abs(x), z - 0.35) < 0.95 && y < 7.95); };
    for (let i = 0; i < n; i++) { const t = 0.22; hp[i * 3] = pos.getX(i) + nrm.getX(i) * t; hp[i * 3 + 1] = pos.getY(i) + nrm.getY(i) * t; hp[i * 3 + 2] = pos.getZ(i) + nrm.getZ(i) * t; }
    for (let i = 0; i < idx.length; i += 3) if (!inFace(idx[i]) && !inFace(idx[i + 1]) && !inFace(idx[i + 2])) tri.push(idx[i], idx[i + 1], idx[i + 2]);
    const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.BufferAttribute(hp, 3)); hg.setIndex(tri); hg.computeVertexNormals();
    inner.add(new THREE.Mesh(hg, new THREE.MeshPhysicalMaterial({ color: 0xc4c8ce, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15, side: THREE.DoubleSide })));
  }
  // ---- accessories
  const blk = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.4, metalness: 0.6 });
  if (id === "voss") {
    const gm = new THREE.MeshStandardMaterial({ color: 0x3a2a20, metalness: 0.7, roughness: 0.3 });
    for (const e of [C.eyeL, C.eyeR]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 8, 40), gm); r.position.set(e[0], e[1], e[2] + 0.22); r.scale.set(1.15, 0.85, 1); inner.add(r); const l = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0, clearcoat: 1 })); l.position.copy(r.position); l.scale.copy(r.scale); inner.add(l); }
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), gm); br.rotation.z = Math.PI / 2; br.position.set(0, C.eyeL[1] + 0.03, C.eyeL[2] + 0.26); inner.add(br);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 6), gm); arm.rotation.x = Math.PI / 2; arm.position.set(s * 0.52, C.eyeL[1] + 0.03, C.eyeL[2] - 0.2); inner.add(arm); }
  }
  if (id === "comms") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.035, 8, 40, Math.PI), blk); band.position.set(0, Y(7.35), 0.42); band.scale.set(1, 1.08, 1); inner.add(band);
    for (const s of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 24), blk); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.98, Y(7.18), 0.45); inner.add(cup); }
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.85, 8), blk); boom.position.set(-0.78, Y(6.86), 1.0); boom.rotation.set(1.25, 0, 0.55); inner.add(boom);
    const mic = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), blk); mic.position.set(-0.42, Y(6.66), 1.48); inner.add(mic);
  }
  // torso filler under the uniform shell (hides the crop edge)
  const prof = [[0.0, 6.02], [0.7, 6.0], [1.25, 5.88], [1.75, 5.7], [2.05, 5.35], [2.15, 4.6], [0, 4.6]].map(([r, yy]) => new THREE.Vector2(r, Y(yy)));
  const fill = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), new THREE.MeshStandardMaterial({ map: fabricTex(SUIT[id] || "#3a4a5a", vh), roughness: 0.85 })); fill.scale.set(0.97, 1, 0.5); fill.position.set(0, 0, 0.25); inner.add(fill);
  const surf = (tx, ty, tz) => { let best = -1, bd = 1e9; for (let i = 0; i < n; i++) { if (suitMask[i] < 0.5) continue; const d = (pos.getX(i) - tx) ** 2 + (pos.getY(i) - ty) ** 2 + (pos.getZ(i) - tz) ** 2; if (d < bd) { bd = d; best = i; } } return best < 0 ? null : { p: new V3(sp[best * 3], sp[best * 3 + 1], sp[best * 3 + 2]), n: new V3(nrm.getX(best), nrm.getY(best), nrm.getZ(best)) }; };
  const stick = (mesh, at) => { if (!at) return; mesh.position.copy(at.p).addScaledVector(at.n, 0.02); mesh.quaternion.setFromUnitVectors(new V3(0, 0, 1), at.n); inner.add(mesh); };
  if (!vh || id === "ember") {
    const pc = cv(128, 128), px = pc.getContext("2d"); px.fillStyle = "#14285a"; px.beginPath(); px.arc(64, 64, 62, 0, 7); px.fill(); px.strokeStyle = "#c8a040"; px.lineWidth = 6; px.stroke(); px.fillStyle = "#e8e8f0"; px.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 14 : 34; px.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } px.fill();
    const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
    stick(new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.7 })), surf(1.35, Y(5.75), 0.55));
    const pinM = new THREE.MeshStandardMaterial({ color: 0xd8b040, metalness: 1, roughness: 0.25 });
    for (let i = 0; i < 2; i++) stick(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.03), pinM), surf(-0.85, Y(5.62) - i * 0.1, 1.0));
  }
  // ---- Vharr: crest quills, fangs, crown, armor spikes
  if (vh) {
    const bone = new THREE.MeshStandardMaterial({ color: BONE[id], roughness: 0.45, metalness: 0.05, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(BONE[id]).multiplyScalar(0.6), roughness: 0.5, flatShading: true });
    const hc = new V3(0, Y(7.25), 0.35);
    for (const [x, y, z, off, k] of C.crest) {
      if (y < C.eyeL[1] + 0.62) continue;
      const p = new V3(x, y, z); const out = p.clone().sub(hc).normalize().add(new V3(0, 0.25, -0.9)).normalize();
      const len = (off === 0 ? 1.1 : 0.75) * (0.55 + Math.sin(((k + 0.5) / (off === 0 ? 9 : 6)) * Math.PI) * 0.7) * (id === "kaerr" ? 1.25 : 1);
      const q = new THREE.Mesh(new THREE.ConeGeometry(off === 0 ? 0.07 : 0.055, len, 6), k % 2 ? bone : dark);
      q.position.copy(p).addScaledVector(out, len * 0.4); q.quaternion.setFromUnitVectors(new V3(0, 1, 0), out); inner.add(q);
    }
    const jaw = f32(C.jaw); const cand = [];
    for (let i = 0; i < n; i++) cand.push([Math.hypot(jaw[i * 3] - pos.getX(i), jaw[i * 3 + 1] - pos.getY(i), jaw[i * 3 + 2] - pos.getZ(i)), i]);
    let maxd = 0; for (const c of cand) maxd = Math.max(maxd, c[0]);
    const fang = new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.35 });
    let zmax = -9; for (const [d, i] of cand) if (d > maxd * 0.03 && d < maxd * 0.4) zmax = Math.max(zmax, pos.getZ(i));
    const upper = cand.filter(([d, i]) => d > maxd * 0.02 && d < maxd * 0.25 && pos.getZ(i) > zmax - 0.32).map(c => c[1]);
    upper.sort((a, b) => pos.getX(a) - pos.getX(b));
    const used = []; for (const i of upper) { const x = pos.getX(i); if (used.some(u => Math.abs(u - x) < 0.07)) continue; used.push(x); const f = new THREE.Mesh(new THREE.ConeGeometry(0.022, Math.abs(Math.abs(x) - 0.17) < 0.05 ? 0.16 : 0.08, 6), fang); f.position.set(x * 0.97, pos.getY(i) - 0.02, pos.getZ(i) - 0.03); f.rotation.x = Math.PI; inner.add(f); }
    if (id === "kaerr") {
      // crown: a circlet of gold spikes on the skull, above the brow plates, leaning back
      const gold = new THREE.MeshStandardMaterial({ color: 0xc89a30, metalness: 1, roughness: 0.22 });
      const eyeY = C.eyeL[1], ringY = eyeY + 0.72; let cz = 0, cn = 0;
      for (let i = 0; i < n; i++) if (Math.abs(pos.getY(i) - ringY) < 0.05) { cz += pos.getZ(i); cn++; }
      const centre = new V3(0, ringY, cn ? cz / cn : 0.3);
      for (let k = -3; k <= 3; k++) {
        const a = k * 0.36; const dir = new V3(Math.sin(a), 0, Math.cos(a));
        let best = -1, bd = -1e9; for (let i = 0; i < n; i++) { if (Math.abs(pos.getY(i) - ringY) > 0.06) continue; const d = (pos.getX(i) - centre.x) * dir.x + (pos.getZ(i) - centre.z) * dir.z; if (d > bd) { bd = d; best = i; } }
        if (best < 0) continue;
        const len = 0.42 - Math.abs(k) * 0.05; const up = new V3(dir.x * 0.25, 1, dir.z * 0.1 - 0.35).normalize();
        const spk = new THREE.Mesh(new THREE.ConeGeometry(0.04, len, 5), gold);
        spk.position.set(pos.getX(best), pos.getY(best), pos.getZ(best)).addScaledVector(dir, 0.02).addScaledVector(up, len * 0.45); spk.quaternion.setFromUnitVectors(new V3(0, 1, 0), up); inner.add(spk);
      }
      const pts = []; for (let k = -10; k <= 10; k++) { const a = k * 0.14; const dir = new V3(Math.sin(a), 0, Math.cos(a)); let bd = -1e9, bp = null; for (let i = 0; i < n; i++) { if (Math.abs(pos.getY(i) - ringY) > 0.06) continue; const d = (pos.getX(i) - centre.x) * dir.x + (pos.getZ(i) - centre.z) * dir.z; if (d > bd) { bd = d; bp = new V3(pos.getX(i), ringY, pos.getZ(i)); } } if (bp) pts.push(bp.addScaledVector(dir, 0.02)); }
      if (pts.length > 4) inner.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.03, 6, false), gold));
    }

    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const spk = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.8 - k * 0.15, 6), bone); spk.position.set(s * (1.25 + k * 0.32), Y(6.0) - k * 0.12, 0.1); spk.rotation.z = -s * (0.5 + k * 0.25); inner.add(spk); }
  }
  return rig;
}

// ---- natural facial motion: callers only say *whether* someone is talking; the jaw, blinks and gaze are synthesised here
const hash1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ease = u => u * u * (3 - 2 * u);
function anim(rig, talk, t) {
  const a = rig._an || (rig._an = { lt: t, jaw: 0, spk: -9, nb: t + 0.8 + Math.random() * 2.5, bs: -1, seed: Math.random() * 1000, sac: new V3(), sacT: t + 1 });
  let dt = t - a.lt; a.lt = t;
  if (dt < 0 || dt > 0.5) { dt = 1 / 60; a.nb = t + 0.6 + Math.random() * 2; a.bs = -1; a.sacT = t + 0.5; }
  // speech: hold "speaking" across the zero-crossings of whatever flap the caller passes
  if (talk > 0.02) a.spk = t;
  const speaking = t - a.spk < 0.3;
  // syllables at ~4.6/s with varied openness and short pauses between words, shaped open-close, then low-passed
  const ph = t * 4.6 + a.seed, slot = Math.floor(ph), fr = ph - slot;
  const h = hash1(slot + a.seed), amp = h < 0.14 ? 0 : 0.35 + 0.65 * hash1(slot * 1.7 + 3.1);
  const target = speaking ? 0.04 + 0.30 * amp * Math.pow(Math.sin(Math.PI * fr), 1.4) : 0;
  a.jaw += (target - a.jaw) * (1 - Math.exp(-dt * 14));
  // blinks: quick eased close, brief hold, slower open; random 2-6.5 s apart, sometimes doubled
  let blink = 0;
  if (a.bs < 0 && t >= a.nb) a.bs = t;
  if (a.bs >= 0) { const u = t - a.bs;
    blink = u < 0.07 ? ease(u / 0.07) : u < 0.11 ? 1 : u < 0.26 ? 1 - ease((u - 0.11) / 0.15) : 0;
    if (u >= 0.26) { a.bs = -1; a.nb = t + (Math.random() < 0.15 ? 0.12 : 2 + Math.random() * 4.5); } }
  // gaze: small saccades every so often instead of a dead fixed stare
  if (t >= a.sacT) { a.sac.set((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.03, 0); a.sacT = t + 0.6 + Math.random() * 1.8; }
  return { jaw: a.jaw, blink, sac: a.sac };
}
const EYE_OPEN = 0.2, LID_SHUT = 0.27;
// which way does this character's lid morph go? measure the average vertical travel of the vertices it moves
function lidDir(rig) {
  if (rig._lid) return rig._lid;
  let sum = 0, n = 0;
  for (const mesh of rig.morphed) { const g = mesh.geometry, mp = g.morphAttributes.position; if (!mp || mp.length < 2) continue;
    const base = g.attributes.position.array, tgt = mp[1].array, rel = g.morphTargetsRelative;
    for (let i = 1; i < base.length; i += 3) { const dy = rel ? tgt[i] : tgt[i] - base[i]; if (Math.abs(dy) > 1e-4) { sum += dy; n++; } } }
  return (rig._lid = n && sum > 0 ? -1 : 1);
}
function pose(rig, talk, t, camera = cam, turnOverride) {
  const turn = turnOverride ?? (TURN[rig.id] ?? -0.35);
  const A = anim(rig, talk, t);
  rig.bust.rotation.set(Math.sin(t * 0.8 + 1) * 0.02 + A.jaw * 0.05, turn + Math.sin(t * 0.55) * 0.035, Math.sin(t * 0.4) * 0.015);
  // lid morphs differ per character: some close the eyes (and overshoot past ~0.27), others open them from a
  // half-closed sculpt (rest at +0.2, shut at -1). lidDir() measures which, so every blink closes cleanly.
  const F = typeof window !== 'undefined' && window.__forceFace; const m = F ? F[1] : A.jaw;
  const dir = lidDir(rig);   // +1: the morph closes the lids (most of the cast); -1: it opens them (sculpted half-closed)
  const b = F ? F[0] : A.blink, blink = dir > 0 ? b * LID_SHUT : EYE_OPEN - b * (EYE_OPEN + 1);   // closing morphs overshoot: lids meet at ~0.27
  for (const mesh of rig.morphed) {
    if (!mesh.morphTargetInfluences) continue;
    if (mesh.userData.lash) { mesh.morphTargetInfluences[0] = 0; mesh.morphTargetInfluences[1] = blink; }
    else { mesh.morphTargetInfluences[0] = m; if (mesh.morphTargetInfluences.length > 1) mesh.morphTargetInfluences[1] = blink; }
  }
  for (const tt of rig.teeth || []) tt.visible = m > 0.1;
  rig.group.updateMatrixWorld(true);
  for (const e of rig.eyes) {
    const wp = new V3(); e.getWorldPosition(wp);
    const target = (rig.lookAt ? rig.lookAt.clone() : camera.getWorldPosition(new V3())).add(A.sac);
    const parentQ = new THREE.Quaternion(); e.parent.getWorldQuaternion(parentQ);
    const dir = target.sub(wp).normalize().applyQuaternion(parentQ.invert());
    e.quaternion.slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), dir), 0.8);
  }
}

// ---------------------------------------------------------------- BACKDROPS
function backdrop(ctx, x, y, w, h, vharr, opts) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  if (vharr) { g.addColorStop(0, opts.bg0 || "#2a0d06"); g.addColorStop(1, opts.bg1 || "#070202"); }
  else { g.addColorStop(0, opts.bg0 || "#1c2836"); g.addColorStop(1, opts.bg1 || "#05080c"); }
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const lights = vharr ? [[0.15, 0.25, "255,110,40"], [0.85, 0.6, "255,70,20"], [0.7, 0.15, "255,150,60"]] : [[0.12, 0.2, "120,170,230"], [0.88, 0.3, "255,180,90"], [0.8, 0.72, "90,140,200"], [0.18, 0.7, "255,160,80"]];
  for (const [lx, ly, c] of lights) { const r = Math.min(w, h) * 0.24; const gg = ctx.createRadialGradient(x + lx * w, y + ly * h, 0, x + lx * w, y + ly * h, r); gg.addColorStop(0, `rgba(${c},.2)`); gg.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gg; ctx.fillRect(x, y, w, h); }
  ctx.strokeStyle = vharr ? "rgba(255,120,60,.05)" : "rgba(160,200,255,.05)"; ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + (i / 5) * w, y); ctx.lineTo(x + (i / 5) * w + w * 0.05, y + h); ctx.stroke(); }
}
function grade(ctx, x, y, w, h) {
  const v = ctx.createRadialGradient(x + w / 2, y + h * 0.42, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.55)"); ctx.fillStyle = v; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.04; ctx.fillStyle = "#000"; for (let yy = y; yy < y + h; yy += 3) ctx.fillRect(x, yy, w, 1);
  ctx.globalAlpha = 0.03; for (let i = 0; i < 50; i++) { ctx.fillStyle = Math.random() < 0.5 ? "#fff" : "#000"; ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 2, 2); }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- PUBLIC API
// Draw a portrait into ctx at (x,y,w,h). talk 0..1 opens the jaw; t drives idle motion and blinking.
export function drawPortrait(ctx, spec, x, y, w, h, talk = 0, t = 0, opts = {}) {
  ensure();
  const id = spec && spec.name && NAME2ID[spec.name] ? NAME2ID[spec.name] : spec && spec.portrait && spec.portrait.helmet ? "player" : "comms";
  const vharr = DATA && DATA.chars[id] ? DATA.chars[id].vharr : !!(spec && spec.portrait && spec.portrait.vharr);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  backdrop(ctx, x, y, w, h, vharr, opts);
  if (!DATA) {
    ctx.fillStyle = "rgba(255,180,64,.6)"; ctx.font = `${Math.max(10, w * 0.05) | 0}px 'Share Tech Mono', monospace`; ctx.textAlign = "center"; ctx.fillText("ACQUIRING SIGNAL", x + w / 2, y + h / 2); ctx.restore(); return;
  }
  let rig = rigs.get(id); if (!rig) { rig = buildRig(id); rigs.set(id, rig); }
  if (!rig) { ctx.restore(); return; }
  pose(rig, talk, t);
  keyL.color.set(vharr ? 0xffb080 : 0xffe2c8); keyL.intensity = vharr ? 2.2 : 2.7;
  rimL.color.set(vharr ? 0xff6a20 : 0x9ccfff); rimL.intensity = vharr ? 6 : 5;
  rim2.color.set(vharr ? 0xff3010 : 0x6a8ab8); fillL.intensity = vharr ? 0.4 : 0.6;
  scene.add(rig.group); R.render(scene, cam); scene.remove(rig.group);
  const sa = W / H, da = w / h; let sw = W, sh = H, sx = 0, sy = 0;
  if (da > sa) { sh = W / da; sy = (H - sh) * 0.25; } else { sw = H * da; sx = (W - sw) / 2; }
  const now = performance.now(); if (!rig._seen || now - rig._seen > 3000) { rig._fade0 = now; rig._fn = 0; } rig._seen = now; rig._fn = (rig._fn || 0) + 1;
  ctx.globalAlpha = Math.min(1, Math.max((now - rig._fade0) / 380, rig._fn / 12)); ctx.drawImage(R.domElement, sx, sy, sw, sh, x, y, w, h); ctx.globalAlpha = 1;
  if (vharr) for (const e of rig.eyes) {
    const wp = new V3(); e.getWorldPosition(wp); const pr = wp.project(cam);
    const px = x + (((pr.x * 0.5 + 0.5) * W - sx) / sw) * w, py = y + (((-pr.y * 0.5 + 0.5) * H - sy) / sh) * h;
    const r = w * 0.07, g = ctx.createRadialGradient(px, py, 0, px, py, r); const c = new THREE.Color(e.userData.glow);
    g.addColorStop(0, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},.6)`); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2); ctx.globalCompositeOperation = "source-over";
  }
  grade(ctx, x, y, w, h);
  ctx.restore();
}

// Build a fresh bust rig for use inside the main 3D scene (rooms, cutscenes).
export function makeBust(id) { ensure(); if (!DATA || !DATA.chars[id]) return null; const r = buildRig(id); return r; }
export function poseBust(rig, talk, t, camera, turn = 0) { pose(rig, talk, t, camera, turn); }
export function castReady() { return !!DATA; }
export const CAST_IDS = NAME2ID;
export { SUIT, fabricTex };
