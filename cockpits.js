// HALCYON WING — cockpits. One hand-built cockpit per flyable craft, in camera space
// (pilot's eye at the origin, looking down -Z). Forced perspective in the Wing Commander
// tradition: dash, screens, the pilot's gloved hands on stick and throttle, and the knees
// all sit in the lower third of the view. Instrument faces are live canvases.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { addFlair, wearPanel, WEAR } from "./flair.js";
import { paintGreebles, greebleMaterial, hardware } from "./greeble.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const V3 = THREE.Vector3;
const THEMES = {
  kestrel: { panel: "#6e5a44", panel2: "#4e3f30", frame: "#3a3028", hood: "#2a221c", accent: "#ffb040", led: "#ffb040", glass: 0xc8a070, strut: "single", screens: "round", label: "KESTREL F-12", suit: "#4a5a6e" },
  lancer: { panel: "#4a5a42", panel2: "#36422f", frame: "#283124", hood: "#1e241a", accent: "#7dff8a", led: "#7dff8a", glass: 0x90c090, strut: "center", screens: "bevel", label: "LANCER F-31", suit: "#4a5a6e" },
  warden: { panel: "#4c5462", panel2: "#363c48", frame: "#2a2e36", hood: "#1a1d23", accent: "#78d0ff", led: "#ffb040", glass: 0x90b0d0, strut: "heavy", screens: "triple", label: "WARDEN F-44", suit: "#4a5a6e" },
  longbow: { panel: "#3a4656", panel2: "#2a3340", frame: "#222831", hood: "#171b21", accent: "#ff9040", led: "#ff6a30", glass: 0x8090a8, strut: "heavy", screens: "wide", label: "LONGBOW B-9", suit: "#4a5a6e" },
  wraith: { panel: "#24242e", panel2: "#18181f", frame: "#121218", hood: "#0c0c10", accent: "#60e0ff", led: "#60e0ff", glass: 0x6080ff, strut: "none", screens: "holo", label: "WRAITH XF-90", suit: "#2a2a32" },
};

function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return "#" + c.getHexString(); }
function rnd(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- painted textures
function screw(x, px, py, r = 4) { x.fillStyle = "#1a1a1a"; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.arc(px - r * 0.3, py - r * 0.3, r * 0.5, 0, 7); x.fill(); x.strokeStyle = "#000"; x.lineWidth = 1; x.beginPath(); x.moveTo(px - r * 0.7, py); x.lineTo(px + r * 0.7, py); x.stroke(); }
function paintPanel(T, w, h, seed, opts = {}) {
  const c = cv(w, h), x = c.getContext("2d"), e = cv(w, h), ex = e.getContext("2d"); const R = rnd(seed);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, shade(T.panel, 1.15)); g.addColorStop(1, shade(T.panel, 0.75));
  x.fillStyle = g; x.fillRect(0, 0, w, h); ex.fillStyle = "#000"; ex.fillRect(0, 0, w, h);
  // grain
  const id = x.getImageData(0, 0, w, h); for (let i = 0; i < id.data.length; i += 4) { const n = (R() - 0.5) * 12; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } x.putImageData(id, 0, 0);
  // sub-panels
  const subs = opts.subs || [];
  for (const [sx, sy, sw, sh] of subs) {
    x.fillStyle = shade(T.panel2, 1); x.fillRect(sx, sy, sw, sh);
    x.strokeStyle = "rgba(0,0,0,.7)"; x.lineWidth = 3; x.strokeRect(sx, sy, sw, sh);
    x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 1.5; x.strokeRect(sx + 3, sy + 3, sw - 6, sh - 6);
    screw(x, sx + 10, sy + 10); screw(x, sx + sw - 10, sy + 10); screw(x, sx + 10, sy + sh - 10); screw(x, sx + sw - 10, sy + sh - 10);
    // button grids
    const cols = Math.max(2, Math.floor(sw / 46)), rows = Math.max(1, Math.floor((sh - 30) / 40));
    if (R() < 0.75) for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const bx = sx + 18 + i * ((sw - 36) / cols), by = sy + 22 + j * ((sh - 36) / rows), bw = (sw - 36) / cols - 10, bh = Math.min(26, (sh - 36) / rows - 12);
      if (R() < 0.15) continue;
      x.fillStyle = "#111"; x.fillRect(bx, by, bw, bh); x.fillStyle = shade(T.panel2, 0.6 + R() * 0.5); x.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
      const lit = R() < 0.45; const col = R() < 0.6 ? T.led : R() < 0.5 ? "#ff3020" : "#40ff60";
      x.fillStyle = lit ? col : "#2a2a2a"; x.fillRect(bx + 4, by + 4, Math.min(10, bw * 0.3), 5);
      if (lit) { ex.fillStyle = col; ex.fillRect(bx + 4, by + 4, Math.min(10, bw * 0.3), 5); }
      x.fillStyle = "rgba(230,220,200,.7)"; x.font = `bold ${Math.min(11, bh * 0.45) | 0}px monospace`; x.fillText(["NAV", "ECM", "COM", "TGT", "IFF", "AUX", "PWR", "SHD", "GUN", "MSL", "TRQ", "RDR", "HUD", "INT"][(R() * 14) | 0], bx + 4, by + bh - 4);
    } else {
      // gauges
      const n = Math.max(1, Math.floor(sw / 90));
      for (let i = 0; i < n; i++) {
        const gx = sx + sw / (n + 1) * (i + 1), gy = sy + sh / 2, gr = Math.min(sw / (n + 1), sh) * 0.36;
        x.fillStyle = "#0c0c0c"; x.beginPath(); x.arc(gx, gy, gr + 4, 0, 7); x.fill(); x.fillStyle = "#16201a"; x.beginPath(); x.arc(gx, gy, gr, 0, 7); x.fill();
        x.strokeStyle = "rgba(230,230,210,.7)"; x.lineWidth = 2; for (let k = 0; k <= 10; k++) { const a = Math.PI * 0.75 + k / 10 * Math.PI * 1.5; x.beginPath(); x.moveTo(gx + Math.cos(a) * gr * 0.8, gy + Math.sin(a) * gr * 0.8); x.lineTo(gx + Math.cos(a) * gr * 0.95, gy + Math.sin(a) * gr * 0.95); x.stroke(); }
        const a = Math.PI * 0.75 + R() * Math.PI * 1.5; x.strokeStyle = T.accent; x.lineWidth = 3; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + Math.cos(a) * gr * 0.8, gy + Math.sin(a) * gr * 0.8); x.stroke();
        ex.strokeStyle = T.accent; ex.lineWidth = 3; ex.beginPath(); ex.moveTo(gx, gy); ex.lineTo(gx + Math.cos(a) * gr * 0.8, gy + Math.sin(a) * gr * 0.8); ex.stroke();
        x.fillStyle = "rgba(255,255,255,.12)"; x.beginPath(); x.ellipse(gx - gr * 0.3, gy - gr * 0.4, gr * 0.5, gr * 0.25, -0.5, 0, 7); x.fill();
      }
    }
  }
  // hazard stripes + labels
  for (const [hx, hy, hw, hh] of opts.hazard || []) { x.save(); x.beginPath(); x.rect(hx, hy, hw, hh); x.clip(); for (let i = -hh; i < hw + hh; i += 22) { x.fillStyle = "#d8b020"; x.beginPath(); x.moveTo(hx + i, hy); x.lineTo(hx + i + 11, hy); x.lineTo(hx + i - hh + 11, hy + hh); x.lineTo(hx + i - hh, hy + hh); x.fill(); x.fillStyle = "#151515"; } x.restore(); }
  for (const [tx, ty, t, s] of opts.labels || []) { x.fillStyle = "rgba(235,225,205,.8)"; x.font = `bold ${s || 18}px "Barlow Semi Condensed", sans-serif`; x.fillText(t, tx, ty); }
  // edge wear and grime
  for (let i = 0; i < 40; i++) { const px = R() * w, py = R() * h, r = 20 + R() * 80; const gg = x.createRadialGradient(px, py, 0, px, py, r); gg.addColorStop(0, "rgba(0,0,0,.12)"); gg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gg; x.fillRect(px - r, py - r, r * 2, r * 2); }
  x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 2; for (let i = 0; i < 25; i++) { const px = R() * w, py = R() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + R() * 30, py + R() * 4); x.stroke(); }
  if (opts.wear) wearPanel(x, w, h, subs, opts.wear, seed);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const te = new THREE.CanvasTexture(e); te.colorSpace = THREE.SRGBColorSpace;
  return { map: t, emissive: te };
}
function quilt(T) {
  const c = cv(512, 256), x = c.getContext("2d"); x.fillStyle = T.hood; x.fillRect(0, 0, 512, 256);
  for (let i = -256; i < 768; i += 32) { x.strokeStyle = "rgba(0,0,0,.6)"; x.lineWidth = 3; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke(); x.beginPath(); x.moveTo(i, 256); x.lineTo(i + 256, 0); x.stroke(); x.strokeStyle = "rgba(255,255,255,.05)"; x.lineWidth = 1; x.beginPath(); x.moveTo(i + 2, 0); x.lineTo(i + 258, 256); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); return t;
}
function metal(col) {
  const c = cv(256, 256), x = c.getContext("2d"); x.fillStyle = col; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; x.fillRect(0, i, 256, 1); }
  for (let i = 0; i < 12; i++) screw(x, 12 + i * 21, 10, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function suitTex(col) {
  const c = cv(256, 256), x = c.getContext("2d"); x.fillStyle = col; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) { x.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`; x.fillRect(0, i, 256, 1); }
  x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = 2; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(128, 0); x.lineTo(128, 256); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const SUIT_COL = "#36414f";
function gauntletTex(bump) {
  const c = cv(512, 256), x = c.getContext("2d"); x.fillStyle = bump ? "#777" : "#1e1d1c"; x.fillRect(0, 0, 512, 256);
  const id = x.getImageData(0, 0, 512, 256); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * (bump ? 40 : 14); id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } x.putImageData(id, 0, 0);
  // wrist creases running round the cuff
  for (let k = 0; k < 5; k++) { const y = 190 - k * 34 + Math.sin(k * 3) * 4; x.strokeStyle = bump ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.45)"; x.lineWidth = 2 + (k % 3); x.beginPath(); for (let u = 0; u <= 512; u += 16) x.lineTo(u, y + Math.sin(u * 0.03 + k) * 5); x.stroke(); }
  // stitched hem bands
  for (const y of [14, 242]) { x.fillStyle = bump ? "#999" : "#2a2927"; x.fillRect(0, y - 8, 512, 16); if (!bump) { x.strokeStyle = "#8a877e"; x.lineWidth = 2; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(0, y - 4); x.lineTo(512, y - 4); x.moveTo(0, y + 4); x.lineTo(512, y + 4); x.stroke(); x.setLineDash([]); } }
  const t = new THREE.CanvasTexture(c); if (!bump) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function strapTex() {
  const c = cv(512, 64), x = c.getContext("2d"); x.fillStyle = "#16171a"; x.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 512; i += 3) { x.fillStyle = `rgba(255,255,255,${0.03 + (i % 6 ? 0.02 : 0.05)})`; x.fillRect(i, 0, 1, 64); }
  x.strokeStyle = "#5c5b56"; x.lineWidth = 2; x.setLineDash([5, 4]); x.strokeRect(4, 6, 504, 52); x.setLineDash([]);
  x.fillStyle = "#3a3b3e"; x.fillRect(380, 4, 70, 56); x.fillStyle = "#c8a048"; x.fillRect(392, 22, 46, 20); x.fillStyle = "#0d0d0f"; x.font = "bold 14px sans-serif"; x.fillText("VS", 404, 37);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function leatherTex() {
  const c = cv(256, 256), x = c.getContext("2d"); x.fillStyle = "#3a2a20"; x.fillRect(0, 0, 256, 256);
  const id = x.getImageData(0, 0, 256, 256); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 18; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } x.putImageData(id, 0, 0);
  x.strokeStyle = "rgba(0,0,0,.6)"; x.lineWidth = 2; x.setLineDash([3, 3]); for (let i = 20; i < 256; i += 60) { x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------------------------------------------------------------- pieces
function dashSurfaceNotch(w, h, curve, n, notchTop) {
  // the dash skin with a footwell cut out of its lower centre (local coords, uv continuous)
  const piece = (x0, x1, y0, y1) => { const sx = Math.max(2, Math.round((x1 - x0) / w * 60)), g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, sx, 8); g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, (x / (w / 2)) ** 2 * curve); uv.setXY(i, (x + w / 2) / w, (y + h / 2) / h); } g.computeVertexNormals(); return g; };
  return mergeGeometries([piece(-w / 2, -n, -h / 2, h / 2), piece(n, w / 2, -h / 2, h / 2), piece(-n, n, notchTop, h / 2)]);
}
function dashSurface(w, h, curve, segX = 40) {
  const g = new THREE.PlaneGeometry(w, h, segX, 4); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, (x / (w / 2)) ** 2 * curve); }
  g.computeVertexNormals(); return g;
}
function tube(points, r, mat) { const curve = new THREE.CatmullRomCurve3(points.map(p => new V3(...p))); return new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r, 10, false), mat); }
function makeHand(side, gloveMat, cuffMat) {
  // a gloved hand gripping a vertical cylinder of radius ~0.035 centred on the group origin
  const h = new THREE.Group();
  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.095, 0.05, 3, 0.018), gloveMat); palm.position.set(side * 0.045, -0.01, 0.018); palm.rotation.y = side * 0.3; h.add(palm);
  for (let f = 0; f < 4; f++) {
    const y = 0.03 - f * 0.024; let pv = new V3(side * 0.02, y, 0.045); let ang = side > 0 ? Math.PI * 0.95 : Math.PI * 0.05; const segs = [0.03, 0.024, 0.02];
    for (let k = 0; k < 3; k++) {
      const len = segs[k] * (f === 3 ? 0.8 : 1); const dir = new V3(Math.cos(ang) * -side, 0, -Math.sin(ang));
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115 - k * 0.0012, len, 4, 8), gloveMat);
      seg.position.copy(pv).addScaledVector(dir, len / 2 + 0.006); seg.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir); h.add(seg);
      pv = pv.clone().addScaledVector(dir, len + 0.006); ang -= side * 0.95;
    }
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), gloveMat); kn.position.set(side * 0.03, y, 0.05); h.add(kn);
  }
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 4, 8), gloveMat); th.position.set(-side * 0.005, 0.07, 0.02); th.rotation.z = side * 1.2; h.add(th);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.07, 16), cuffMat); cuff.position.set(side * 0.06, -0.07, 0.04); cuff.rotation.z = side * 0.35; cuff.rotation.x = -0.5;
  return h;
}

// ---------------------------------------------------------------- pilot body (shared)
let PILOT = null;
export function loadPilot() {
  if (!PILOT) PILOT = fetch(new URL("./assets/pilot.json", import.meta.url)).then(r => r.json()).then(j => {
    const dec = (b, T) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new T(u.buffer); };
    const mk = o => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(dec(o.pos, Float32Array), 3)); const uv = dec(o.uv, Float32Array); if (!o.baked) for (let i = 0; i < uv.length; i++) uv[i] *= 7; g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(dec(o.idx, Uint32Array), 1)); if (o.nrm) g.setAttribute("normal", new THREE.BufferAttribute(dec(o.nrm, Float32Array), 3)); else g.computeVertexNormals(); return g; };
    return { legs: mk(j.legs), sleeve: mk(j.sleeve), glove: mk(j.glove), grip: j.grip, gripUp: j.gripUp, wrist: j.wrist, elbow: j.elbow, holeR: j.holeR, gripTop: j.gripTop, gripBot: j.gripBot, headH: j.headH, gripFwd: j.gripFwd, json: j };
  }).catch(e => { console.warn("pilot body unavailable", e); return null; });
  return PILOT;
}

// ---------------------------------------------------------------- legs: thighs running forward from under the
// view, knees up as in a reclined fighter seat, shins dropping away into the dark footwell beneath the pod
function legTex() {
  const c = cv(1024, 256), x = c.getContext("2d"); x.fillStyle = SUIT_COL; x.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 1024 + 256; i += 3) { x.strokeStyle = `rgba(${i % 6 ? "0,0,0" : "255,255,255"},.05)`; x.beginPath(); x.moveTo(i, 0); x.lineTo(i - 256, 256); x.stroke(); }
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * 1024, Math.random() * 256, 3, 2); }
  // folds bunching behind and over the knee (u ~ 0.55-0.7 along the leg)
  for (let k = 0; k < 9; k++) { const u = 1024 * (0.52 + k * 0.022) + Math.sin(k * 2.3) * 6; const g = x.createLinearGradient(u - 10, 0, u + 10, 0); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(0,0,0,.35)"); g.addColorStop(1, "rgba(255,255,255,.06)");
    x.fillStyle = g; x.beginPath(); x.moveTo(u - 10, 0); for (let v = 0; v <= 256; v += 16) x.lineTo(u + Math.sin(v * 0.05 + k) * 9, v); x.lineTo(u + 10, 256); x.lineTo(u + 10, 0); x.fill(); }
  // outseam with double stitching, and a thigh pocket edge
  for (const v of [64, 192]) { x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(0, v - 2, 1024, 4); x.strokeStyle = "rgba(200,210,220,.35)"; x.setLineDash([6, 5]); x.lineWidth = 1.5; for (const o of [-6, 6]) { x.beginPath(); x.moveTo(0, v + o); x.lineTo(1024, v + o); x.stroke(); } x.setLineDash([]); }
  x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = 3; x.strokeRect(260, 100, 200, 70); x.strokeStyle = "rgba(200,210,220,.3)"; x.setLineDash([5, 4]); x.lineWidth = 1.5; x.strokeRect(266, 106, 188, 58); x.setLineDash([]);
  x.fillStyle = "rgba(20,20,22,.8)"; x.fillRect(268, 104, 184, 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function makeLegs() {
  const grp = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ map: legTex(), roughness: 0.9, metalness: 0, vertexColors: true });
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([[0.3, -0.95, -0.35], [0.275, -0.85, -0.9], [0.235, -0.95, -1.38], [0.215, -1.13, -1.68], [0.2, -1.5, -1.9]].map(([x, y, z]) => new V3(s * x, y, z)));
    const seg = 72, rad = 28, geo = new THREE.TubeGeometry(curve, seg, 1, rad, false), pos = geo.attributes.position, colr = new Float32Array(pos.count * 3), P = new V3(), v = new V3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg; curve.getPointAt(t, P);
      const r = 0.165 - 0.05 * Math.min(1, t / 0.6) - 0.02 * Math.max(0, t - 0.6);
      const lit = 1 - 0.95 * Math.min(1, Math.max(0, (t - 0.42) / 0.3)) ** 1.3;
      for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; v.fromBufferAttribute(pos, k).sub(P); v.x *= r * 1.08; v.y *= r * 0.86; v.z *= r; pos.setXYZ(k, P.x + v.x, P.y + v.y, P.z + v.z); colr[k * 3] = colr[k * 3 + 1] = colr[k * 3 + 2] = lit; }
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colr, 3)); geo.computeVertexNormals();
    grp.add(new THREE.Mesh(geo, mat));
  }
  return grp;
}

// ---------------------------------------------------------------- flight stick (grip moulded to the pilot's hand)
const STICK_SHAFT = 0.3;
function rubberTex() {
  const c = cv(256, 256), x = c.getContext("2d"); x.fillStyle = "#1c1d20"; x.fillRect(0, 0, 256, 256);
  for (let yy = 0; yy < 256; yy += 4) for (let xx = (yy / 4) % 2 * 2; xx < 256; xx += 4) { x.fillStyle = "rgba(255,255,255,.05)"; x.fillRect(xx, yy, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
function buildStick(stick, P) {
  const r = P.holeR * 0.96, top = P.gripTop, bot = P.gripBot, hh = P.headH;
  const rub = new THREE.MeshStandardMaterial({ map: rubberTex(), roughness: 0.8, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x232428, roughness: 0.45, metalness: 0.35 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.3, metalness: 0.9 });
  // ergonomic grip: slight finger swells, palm-rest flare at the bottom
  const prof = []; const n = 24;
  for (let i = 0; i <= n; i++) { const t = i / n, y = bot - 0.012 + t * (top - bot + 0.012);
    const flare = t < 0.12 ? (0.12 - t) / 0.12 * 0.008 : 0; prof.push(new THREE.Vector2(r * (1 - 0.04 * Math.cos(t * Math.PI * 8)) + flare, y)); }
  const grip = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), rub); grip.scale.set(0.92, 1, 1.08); stick.add(grip);
  // head: forward-raked block carrying the hat switch, pickle and weapons release
  const head = new THREE.Mesh(new RoundedBoxGeometry(r * 2.1, hh, r * 2.6, 4, 0.011), dark); head.position.set(0, top + hh / 2 - 0.004, r * 0.25); head.rotation.x = 0.12; stick.add(head);
  const hatB = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.006, 16), steel); hatB.position.set(0, top + hh, -r * 0.2); stick.add(hatB);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.01, 8), steel); hat.position.set(0, top + hh + 0.006, -r * 0.2); stick.add(hat);
  const pickle = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.008, 14), new THREE.MeshStandardMaterial({ color: 0xb01010, emissive: 0x200000, roughness: 0.4 })); pickle.position.set(r * 0.55, top + hh - 0.002, r * 0.9); stick.add(pickle);
  // collar + shaft down into the floor gimbal
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.9, 0.018, 20), dark); collar.position.y = bot - 0.02; stick.add(collar);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, STICK_SHAFT, 16), steel); shaft.position.y = bot - STICK_SHAFT / 2; stick.add(shaft);
  // pleated rubber gaiter around the shaft base (moves with the stick)
  const gp = []; for (let i = 0; i <= 14; i++) gp.push(new THREE.Vector2(0.03 + (14 - i) / 14 * 0.06 + (i % 2) * 0.008, bot - STICK_SHAFT + i * 0.012));
  const gaiter = new THREE.Mesh(new THREE.LatheGeometry(gp, 28), new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9 })); stick.add(gaiter);
}
function buildPedestal(T, base, up) {
  const p = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: T.frame, map: metal(T.frame), roughness: 0.6, metalness: 0.5 });
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.04, 0.2, 3, 0.012), m); plate.position.copy(base).addScaledVector(up, -0.02); plate.quaternion.setFromUnitVectors(new V3(0, 1, 0), up); p.add(plate);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 32), new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.7 })); ring.position.copy(base); ring.quaternion.setFromUnitVectors(new V3(0, 0, 1), up); p.add(ring);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 8), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.9, roughness: 0.3 })); b.position.copy(plate.position).add(new V3(Math.cos(a) * 0.105, 0.022, Math.sin(a) * 0.105)); p.add(b); }
  const col = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.9, 0.16, 3, 0.03), m); col.position.copy(base).add(new V3(0, -0.49, -0.02)); p.add(col);
  return p;
}

const BEZ_SCREW = new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 6);
const BEZ_SCREW_M = new THREE.MeshStandardMaterial({ color: 0x8c9096, metalness: 0.9, roughness: 0.3 });
// ---------------------------------------------------------------- BUILD
export function buildCockpit(type = "kestrel") {
  const T = THEMES[type] || THEMES.kestrel;
  const g = new THREE.Group(); g.userData.type = type;
  const D = { left: null, right: null, radar: null };
  const seed = type.length * 97;
  const frameMat = new THREE.MeshStandardMaterial({ color: T.frame, map: metal(T.frame), roughness: 0.5, metalness: 0.7 });
  const frameDark = new THREE.MeshStandardMaterial({ color: shade(T.frame, 0.6), roughness: 0.6, metalness: 0.6 });
  const hoodMat = new THREE.MeshStandardMaterial({ map: quilt(T), roughness: 0.9, metalness: 0 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.7, metalness: 0.3 });
  const W = type === "longbow" ? 4.6 : 4.1, curve = 0.55, dashZ = -1.62, dashTop = -0.33, dashBot = -1.12;
  // ---- main dash face (painted)
  const dashH = dashTop - dashBot;
  const px = 2048, py = Math.round(2048 * dashH / W * 1.0);
  const sub = []; const scrW = 0.62, scrH = 0.44;
  const toPx = (x, y) => [((x + W / 2) / W) * px, ((dashTop - y) / dashH) * py];
  // reserve screen spots and fill the rest with sub-panels
  const spots = T.screens === "triple" ? [-1.0, 0, 1.0] : T.screens === "wide" ? [-1.35, -0.62, 0, 0.62, 1.35] : [-0.92, 0, 0.92];
  for (let i = 0; i < 6; i++) { const [a] = toPx(-W / 2 + 0.08 + i * (W - 0.16) / 6, 0); sub.push([a + 6, py * 0.78, (px / 6) - 16, py * 0.2]); }
  // ---- layout plan (dash metres): screen housings, a raised centre pod over the footwell, readouts,
  // then neat rows of framed modules in whatever skin is left between them
  const SCR = T.screens === "wide" ? [[-0.62, -0.66, 0.5, 0.38], [0.62, -0.66, 0.5, 0.38], [-1.35, -0.68, 0.42, 0.34], [1.35, -0.68, 0.42, 0.34]] : [[spots[0], -0.66, scrW, scrH], [spots[2], -0.66, scrW, scrH]];
  const inner = Math.min(...SCR.map(([cx, , w]) => Math.abs(cx) - w / 2 - 0.075));
  const RADAR_Y = -0.615, podHW = Math.min(0.5, inner - 0.02), podTop = dashTop - 0.035, podBot = -0.95, POD = 0.065, kick = -0.965;
  const blocks = SCR.map(([cx, cy, w, h]) => [cx - w / 2 - 0.09, cx + w / 2 + 0.09, cy - h / 2 - 0.09, cy + h / 2 + 0.09]);
  blocks.push([-podHW - 0.025, podHW + 0.025, dashBot - 1, podTop + 0.05]);
  for (const sx of [-1.62, 1.62]) blocks.push([sx - 0.22, sx + 0.22, -0.67, -0.43]);
  blocks.push([-W / 2, -W / 2 + 0.75, dashTop, dashTop - 0.12]);                    // type plate strip
  const gpx = 3072, gpy = Math.round(3072 * dashH / W), ppm = gpx / W, Sd = ppm / 1000;
  const toTex = (x0, x1, y0, y1) => ({ x: (x0 + W / 2) * ppm, y: (dashTop - y1) * ppm, w: (x1 - x0) * ppm, h: (y1 - y0) * ppm });
  const KINDS = ["toggles", "annun", "breakers", "dial", "grille", "knobs", "toggles", "caution", "tape", "annun", "breakers", "data", "toggles", "annun"];
  const KR = (() => { let s_ = seed * 7 + 3; return () => ((s_ = (s_ * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const mods = []; const mg = 0.018, bandH = 0.118; let last = "";
  const fillBand = (y0, y1) => {
    const bl = blocks.filter(b => b[2] < y1 && b[3] > y0).map(b => [b[0], b[1]]).sort((p_, q_) => p_[0] - q_[0]);
    let cur = -W / 2 + 0.05; const free = [];
    for (const [p0, p1] of bl) { if (p0 > cur) free.push([cur, p0]); cur = Math.max(cur, p1); }
    if (W / 2 - 0.05 > cur) free.push([cur, W / 2 - 0.05]);
    for (const [p0, p1] of free) { const L = p1 - p0 - mg; if (L < 0.1) continue; const n = Math.max(1, Math.round(L / 0.2)), mw = (L - (n - 1) * mg) / n;
      for (let i = 0; i < n; i++) { let k; do { k = KINDS[(KR() * KINDS.length) | 0]; } while (k === last); last = k;
        const mx0 = p0 + mg / 2 + i * (mw + mg); mods.push(Object.assign(toTex(mx0, mx0 + mw, y0, y1), { kind: k, dark: KR() < 0.3 })); } }
  };
  for (let y1 = dashTop - 0.035; y1 - bandH > dashBot + 0.015; y1 -= bandH + mg) fillBand(y1 - bandH, y1);
  // a dedicated row along the lower dash, beside the knees, under the display housings
  const frameBot = Math.min(...SCR.map(([, cy, , h]) => cy - h / 2 - 0.09));
  { const bb = blocks.filter(b => b[2] > dashBot - 0.5); const y1 = frameBot - 0.016, y0 = dashBot + 0.014; if (y1 - y0 > 0.07) { const saved = blocks.splice(0); blocks.push(...saved.filter(b => !(b[3] <= frameBot + 0.001 && b[3] > frameBot - 0.2 && b[2] < y0))); blocks.push(...saved.filter(b => b[2] < y0)); fillBand(y0, y1); } }
  const kickY = (dashTop - kick) * ppm;
  const frames = SCR.map(([cx, cy, w, h]) => toTex(cx - w / 2 - 0.08, cx + w / 2 + 0.08, cy - h / 2 - 0.08, cy + h / 2 + 0.08)).concat([-1.62, 1.62].map(sx => toTex(sx - 0.21, sx + 0.21, -0.66, -0.44)));
  const G = paintGreebles(T, gpx, gpy, seed, { scale: Sd, modules: mods, frames, seamsY: [(0.025) * ppm], labels: [[gpx * 0.025, gpy * 0.08, T.label, 30 * Sd / 0.75]] });
  const dash = new THREE.Mesh(dashSurfaceNotch(W, dashH, curve, podHW, podBot - (dashTop + dashBot) / 2), greebleMaterial(G, { metalness: 0.5 }));
  const excl = [];
  dash.position.set(0, (dashTop + dashBot) / 2, dashZ); dash.rotation.x = -0.32; g.add(dash);
  const dashPoint = (x, y) => { const v = new V3(x, y - (dashTop + dashBot) / 2, (x / (W / 2)) ** 2 * curve + 0.012); v.applyEuler(dash.rotation); return v.add(dash.position); };
  const dashQuat = (x) => { const q = new THREE.Quaternion().setFromEuler(dash.rotation); const yaw = Math.atan(2 * x / (W / 2) ** 2 * curve); return q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -yaw)); };
  // ---- footwell: a dark recess under the centre pod where the legs go
  { const mid = (dashTop + dashBot) / 2, nt = podBot - mid, hb = -dashH / 2 - 0.3, d = 0.75;
    const fw = new THREE.Mesh(new THREE.BoxGeometry(podHW * 2 + 0.02, nt - hb, d), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.85, metalness: 0.3, side: THREE.BackSide }));
    fw.position.set(0, (nt + hb) / 2, -d / 2 + 0.01); dash.add(fw);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(podHW * 2 + 0.04, 0.02, 0.05), new THREE.MeshStandardMaterial({ color: shade(T.frame, 0.8), metalness: 0.6, roughness: 0.4 })); lip.position.set(0, nt - 0.01, 0.0); dash.add(lip);
    for (const sx of [-1, 1]) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.02, nt - hb, 0.04), lip.material); rib.position.set(sx * (podHW + 0.005), (nt + hb) / 2, 0.0); dash.add(rib); }
    for (let i = 0; i < 3; i++) { const pipe = tube([[-podHW + 0.05, nt - 0.06 - i * 0.05, -0.1 - i * 0.12], [0, nt - 0.03 - i * 0.05, -0.3 - i * 0.1], [podHW - 0.05, nt - 0.06 - i * 0.05, -0.12 - i * 0.12]], 0.012 + i * 0.004, blackMat); dash.add(pipe); } }
  // ---- centre pod: raised housing that carries the radar and its indicator columns
  { const ph = podTop - podBot, pw = podHW * 2, pppm = 1100, Sp = pppm / 1000;
    const pmods = []; const tp = (x0, x1, y0, y1) => ({ x: (x0 + podHW) * pppm, y: (podTop - y1) * pppm, w: (x1 - x0) * pppm, h: (y1 - y0) * pppm });
    const colW = podHW - 0.3 - 0.035;
    if (colW > 0.08) for (const sd of [-1, 1]) { const x0 = sd < 0 ? -podHW + 0.03 : 0.3 + 0.005, x1 = x0 + colW;
      pmods.push(Object.assign(tp(x0, x1, podBot + 0.33, podTop - 0.035), { kind: sd < 0 ? "annun" : "dial", dark: true }));
      pmods.push(Object.assign(tp(x0, x1, podBot + 0.035, podBot + 0.31), { kind: "tape", dark: true })); }
    const PG = paintGreebles(T, Math.round(pw * pppm), Math.round(ph * pppm), seed + 5, { scale: Sp, modules: pmods, dark: [[(podHW - 0.255) * pppm, (podTop - RADAR_Y - 0.255) * pppm, 0.51 * pppm, 0.51 * pppm]], frames: [{ x: (podHW - 0.13) * pppm, y: (podTop + 0.88) * pppm, w: 0.26 * pppm, h: 0.055 * pppm }] });
    const pm = greebleMaterial(PG, { metalness: 0.55 });
    const pod = new THREE.Mesh(new RoundedBoxGeometry(pw, ph, 0.09, 4, 0.018), [frameMat, frameMat, frameMat, frameMat, pm, frameMat]);
    pod.position.copy(dashPoint(0, (podTop + podBot) / 2)); pod.quaternion.copy(dashQuat(0)); pod.translateZ(POD - 0.045 - 0.012); g.add(pod); }
  // ---- padded coaming along the top edge of the dash
  { const pts = []; for (let k = 0; k <= 16; k++) { const x = -W / 2 + k * W / 16; const p = dashPoint(x, dashTop + 0.01); pts.push([p.x, p.y + 0.015, p.z]); } const lip = tube(pts, 0.045, hoodMat); g.add(lip); const lip2 = tube(pts.map(([a, b, c]) => [a, b + 0.04, c - 0.05]), 0.02, frameMat); g.add(lip2); }
  // ---- screens with bezels + buttons
  const screenSize = T.screens === "wide" ? [0.5, 0.38] : [scrW, scrH];
  const mkScreen = (cx, cy, w, h, key) => {
    excl.push([cx, cy, w + 0.17, h + 0.17]);
    const q = dashQuat(cx), p = dashPoint(cx, cy);
    const bez = new THREE.Mesh(new RoundedBoxGeometry(w + 0.12, h + 0.12, 0.05, 3, 0.02), blackMat); bez.position.copy(p); bez.quaternion.copy(q); g.add(bez);
    const inner = new THREE.Mesh(new RoundedBoxGeometry(w + 0.04, h + 0.04, 0.06, 2, 0.01), new THREE.MeshStandardMaterial({ color: shade(T.panel2, 0.6), roughness: 0.6, metalness: 0.5 })); inner.position.copy(p); inner.quaternion.copy(q); inner.translateZ(-0.01); g.add(inner);
    const c = cv(512, Math.round(512 * h / w)); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.copy(p); scr.quaternion.copy(q); scr.translateZ(0.032); g.add(scr);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.05, clearcoat: 1, depthWrite: false })); glass.position.copy(scr.position); glass.quaternion.copy(q); glass.translateZ(0.002); g.add(glass);
    const btnM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.4 });
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const sc = new THREE.Mesh(BEZ_SCREW, BEZ_SCREW_M); sc.position.copy(p); sc.quaternion.copy(q); sc.translateX(sx * (w / 2 + 0.035)); sc.translateY(sy * (h / 2 + 0.035)); sc.translateZ(0.027); sc.rotateX(Math.PI / 2); g.add(sc); }
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.035, 0.035, 0.025, 2, 0.006), btnM); b.position.copy(p); b.quaternion.copy(q); b.translateX(s * (w / 2 + 0.035)); b.translateY(h * 0.35 - i * h * 0.23); b.translateZ(0.035); g.add(b); }
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.025, 0.022, 2, 0.005), btnM); b.position.copy(p); b.quaternion.copy(q); b.translateX(-w * 0.4 + i * w * 0.2); b.translateY(-h / 2 - 0.035); b.translateZ(0.035); g.add(b); }
    D[key] = { canvas: c, ctx: c.getContext("2d"), tex, mesh: scr, w, h };
    return scr;
  };
  if (T.screens === "wide") { mkScreen(-0.62, -0.66, ...screenSize, "left"); mkScreen(0.62, -0.66, ...screenSize, "right"); mkScreen(-1.35, -0.68, 0.42, 0.34, "aux1"); mkScreen(1.35, -0.68, 0.42, 0.34, "aux2"); }
  else { mkScreen(spots[0], -0.66, ...screenSize, "left"); mkScreen(spots[2], -0.66, ...screenSize, "right"); }
  // radar: round scope in a heavy housing
  { const q = dashQuat(0), p = dashPoint(0, RADAR_Y).add(new V3(0, 0, 1).applyQuaternion(q).multiplyScalar(POD - 0.012)); const r = 0.185;
    // push-button row under the scope (radar range / mode), as on the Hornet's pod
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 0.02, 2, 0.006), new THREE.MeshStandardMaterial({ color: i === 1 ? 0x3a3c40 : 0x24262a, roughness: 0.5, metalness: 0.4, emissive: i === 1 ? 0x103018 : 0 })); b.position.copy(dashPoint(0, -0.905)).add(new V3(0, 0, 1).applyQuaternion(q).multiplyScalar(POD - 0.012)); b.quaternion.copy(q); b.translateX(-0.09 + i * 0.06); b.translateZ(0.008); g.add(b); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.035, 12, 48), frameMat); ring.position.copy(p); ring.quaternion.copy(q); ring.translateZ(0.03); g.add(ring);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.05, r + 0.07, 0.06, 40), blackMat); back.position.copy(p); back.quaternion.copy(q); back.rotateX(Math.PI / 2); g.add(back);
    const c = cv(512, 512); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.copy(p); scr.quaternion.copy(q); scr.translateZ(0.035); g.add(scr);
    D.radar = { canvas: c, ctx: c.getContext("2d"), tex, mesh: scr, r };
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const k = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 8), frameDark); k.position.copy(p); k.quaternion.copy(q); k.translateX(Math.cos(a) * (r + 0.07)); k.translateY(Math.sin(a) * (r + 0.07)); k.translateZ(0.05); k.rotateX(Math.PI / 2); g.add(k); }
  }
  // (the Warden's old status strip now lives in the centre pod columns)
  excl.push([0, RADAR_Y, 0.52, 0.52]); for (const sx of [-1.62, 1.62]) excl.push([sx, -0.55, 0.42, 0.2]);
  // 3D switchgear standing on the painted plates (only where nothing covers it)
  { const nrm = new V3();
    const toWorld = (u, v) => { const x = u * W - W / 2, y = dashTop - v * dashH; const q = dashQuat(x); const p = dashPoint(x, y); nrm.set(0, 0, 1).applyQuaternion(q); p.addScaledVector(nrm, -0.012); return { p, q }; };
    const free = s_ => { const x = s_.u * W - W / 2, y = dashTop - s_.v * dashH; s_.rw = (s_.r || 0) * W; return !excl.some(([cx, cy, ew, eh]) => Math.abs(x - cx) < ew / 2 && Math.abs(y - cy) < eh / 2); };
    g.add(hardware(G.spots, toWorld, free, T)); }
  // ---- top-of-dash readouts (SET / KPS / fuel / energy)
  for (const [key, x, w] of [["speed", -1.62, 0.34], ["energy", 1.62, 0.34]]) {
    const c = cv(256, 96); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 256), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.position.copy(dashPoint(x, -0.55)); m.quaternion.copy(dashQuat(x)); m.translateZ(0.02); g.add(m);
    const bz = new THREE.Mesh(new RoundedBoxGeometry(w + 0.04, w * 96 / 256 + 0.04, 0.02, 2, 0.008), blackMat); bz.position.copy(m.position); bz.quaternion.copy(m.quaternion); bz.translateZ(-0.012); g.add(bz);
    D[key] = { canvas: c, ctx: c.getContext("2d"), tex };
  }
  // ---- canopy frame
  const sx = W / 2 + 0.05;
  // canopy bow: rooted outboard of the dash and arching over the pilot's head, so it frames the view
  // at the screen edges instead of crossing it
  const pillars = {
    single: [[-2.18, dashTop, dashZ + 0.12], [-2.1, 0.55, -1.3], [-1.75, 1.35, -0.7], [-0.9, 1.75, -0.05]],
    center: [[-2.2, dashTop, dashZ + 0.1], [-2.12, 0.55, -1.32], [-1.78, 1.35, -0.72], [-0.9, 1.75, -0.05]],
    heavy: [[-2.25, dashTop, dashZ + 0.1], [-2.18, 0.5, -1.3], [-1.85, 1.3, -0.72], [-1.0, 1.7, -0.05]],
    none: [[-2.25, dashTop, dashZ + 0.2], [-2.2, 0.5, -1.1], [-1.9, 1.3, -0.5], [-1.0, 1.75, 0.1]],
  }[T.strut];
  const prad = T.strut === "heavy" ? 0.09 : T.strut === "none" ? 0.035 : 0.065;
  for (const s of [-1, 1]) g.add(tube(pillars.map(([x, y, z]) => [x * s, y, z]), prad, frameMat));
  g.add(tube([[-pillars[3][0], pillars[3][1], pillars[3][2]], [0, pillars[3][1] + 0.08, pillars[3][2] + 0.1], [pillars[3][0], pillars[3][1], pillars[3][2]]], prad * 0.9, frameMat));
  // side rails + sills
  for (const s of [-1, 1]) {
    const sill = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.22, 2.4, 3, 0.04), new THREE.MeshStandardMaterial({ color: T.frame, map: metal(T.frame), roughness: 0.55, metalness: 0.6 })); sill.position.set(s * 1.85, dashTop - 0.12, -0.4); sill.rotation.z = s * 0.15; g.add(sill);
    // side consoles with switches
    const CS = 0.62, cm = 1024 / CS, ck_ = (x0, y0, x1, y1, kind) => ({ x: x0 * cm, y: y0 * cm, w: (x1 - x0) * cm, h: (y1 - y0) * cm, kind, dark: kind === "annun" });
    const CG = paintGreebles(T, 1024, 1024, seed + s * 7 + 3, { scale: 1.45, frames: [{ x: 6, y: 6, w: 1012, h: 1012 }],
      modules: [ck_(0.055, 0.055, 0.3, 0.27, s < 0 ? "knobs" : "breakers"), ck_(0.32, 0.055, 0.565, 0.27, "annun"), ck_(0.055, 0.29, 0.565, 0.45, "toggles"), ck_(0.055, 0.47, 0.3, 0.565, "caution"), ck_(0.32, 0.47, 0.565, 0.565, "grille")] });
    const cg = new THREE.Group(); cg.position.set(s * (T.screens === "wide" ? 1.78 : 1.5), -1.0, -0.95); cg.rotation.set(-1.0, s * -0.5, 0); g.add(cg);
    const housing = new THREE.Mesh(new RoundedBoxGeometry(CS + 0.06, CS + 0.06, 0.12, 4, 0.025), frameMat); housing.position.z = -0.058; cg.add(housing);
    const con = new THREE.Mesh(new THREE.PlaneGeometry(CS, CS), greebleMaterial(CG, { metalness: 0.5 })); con.position.z = 0.003; cg.add(con);
    cg.updateMatrixWorld(true); const cmw = con.matrixWorld.clone(); const cq = new THREE.Quaternion(); con.getWorldQuaternion(cq);
    g.add(hardware(CG.spots, (u, v) => ({ p: new V3((u - 0.5) * CS, (0.5 - v) * CS, 0).applyMatrix4(cmw), q: cq.clone() }), () => true, T));
  }
  // ---- canopy header: riveted bow across the top of the view, warning strip slung beneath it
  { const hpm = 2048 / 3.3, hm_ = (cx, w, kind) => ({ x: (cx - w / 2 + 1.65) * hpm, y: 0.07 * hpm, w: w * hpm, h: 0.2 * hpm, kind, dark: true });
    const HG = paintGreebles(T, 2048, Math.round(0.36 * hpm), seed + 91, { scale: 0.62, seamsX: [-1.0, -0.55, 0.55, 1.0].map(v => (v + 1.65) * hpm), modules: [hm_(-1.32, 0.42, "grille"), hm_(-0.78, 0.3, "hatch"), hm_(0.78, 0.3, "hatch"), hm_(1.32, 0.42, "grille")] });
    const hm = greebleMaterial(HG, { metalness: 0.55 });
    const head = new THREE.Mesh(new RoundedBoxGeometry(3.3, 0.36, 0.07, 3, 0.02), [frameMat, frameMat, frameMat, frameMat, hm, frameMat]);
    head.position.set(0, 1.02, -1.27); head.rotation.x = 0.5; g.add(head);
    for (const sd of [-1, 1]) { const wing = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.3, 0.07, 3, 0.02), [frameMat, frameMat, frameMat, frameMat, hm, frameMat]); wing.position.set(sd * 1.95, 0.72, -1.22); wing.rotation.set(0.45, -sd * 0.35, -sd * 0.62); g.add(wing);
      for (let k = 0; k < 3; k++) { const lp = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), new THREE.MeshBasicMaterial({ color: k ? 0x501008 : 0xff3018, toneMapped: false })); lp.position.copy(wing.position); lp.quaternion.copy(wing.quaternion); lp.translateX(sd * (0.05 - k * 0.07)); lp.translateY(-0.08); lp.translateZ(0.04); g.add(lp); } }
  }
  // ---- warning-light strip on the canopy bow (EJECT / AUTO / LOCK / MSL / AB / SHLD)
  { const c = cv(1024, 96); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.09), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.position.set(0, 0.8, -1.32); m.rotation.x = 0.35; g.add(m);
    const bx = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.13, 0.05, 2, 0.02), blackMat); bx.position.copy(m.position); bx.rotation.copy(m.rotation); bx.translateZ(-0.03); g.add(bx);
    D.lights = { canvas: c, ctx: c.getContext("2d"), tex };
  }
  // ---- canopy glass
  const glassM = new THREE.MeshPhysicalMaterial({ color: T.glass, transparent: true, opacity: 0.05, roughness: 0.02, metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.BackSide });
  const bub = new THREE.Mesh(new THREE.SphereGeometry(2.6, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), glassM); bub.position.set(0, -0.4, -0.2); bub.scale.set(0.85, 0.85, 0.95); g.add(bub);
  // ---- pilot: anatomical seated body (MakeHuman CC0), right glove on the stick
  const stick = new THREE.Group(); g.add(stick);
  const armPivot = new THREE.Group(); g.add(armPivot);
  // stick parts are built once the pilot data says where the gloved hand is
  g.userData.pilotReady = loadPilot().then(P => {
    if (!P) return;
    const tl = new THREE.TextureLoader(), waits = [], tex = (f, srgb) => { let t; waits.push(new Promise(res => { t = tl.load(new URL("./assets/" + f, import.meta.url).href, res, undefined, res); })); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    const suitM = new THREE.MeshStandardMaterial({ map: suitTex(SUIT_COL), roughness: 0.88, metalness: 0.0 });
    const sleeveM = new THREE.MeshStandardMaterial({ map: tex("sleeve_col.jpg", true), bumpMap: tex("sleeve_bump.jpg"), bumpScale: 2.2, roughness: 0.86, metalness: 0.0 });
    const gloveM = new THREE.MeshStandardMaterial({ map: tex("glove_col.jpg", true), bumpMap: tex("glove_bump.jpg"), bumpScale: 2.5, roughness: 0.62, metalness: 0.02 });
    g.add(makeLegs());
    const sleeve = new THREE.Mesh(P.sleeve, sleeveM); sleeve.layers.set(1); armPivot.add(sleeve);
    const gl = new THREE.Mesh(P.glove, gloveM); gl.layers.set(1); armPivot.add(gl);
    // gauntlet cuff: flared leather over the sleeve hem, sized from the actual sleeve so nothing pokes through
    const wr = new V3(...P.wrist), el = new V3(...P.elbow), dir = el.clone().sub(wr).normalize();
    const sp = P.sleeve.attributes.position; let rMax = 0.03; const q = new V3();
    for (let i = 0; i < sp.count; i++) { q.fromBufferAttribute(sp, i).sub(wr); const a = q.dot(dir); if (a > 0.0 && a < 0.04) rMax = Math.max(rMax, q.addScaledVector(dir, -a).length()); }
    const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(rMax * (0.84 + 0.12 * t) + 0.002 + 0.001 * Math.sin(t * 30), -0.014 + t * 0.05)); }
    const gaunt = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), new THREE.MeshStandardMaterial({ map: gauntletTex(), bumpMap: gauntletTex(true), bumpScale: 2, roughness: 0.6, side: THREE.DoubleSide }));
    gaunt.position.copy(wr); gaunt.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir); gaunt.layers.set(1); armPivot.add(gaunt);
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(rMax * 0.93 + 0.005, rMax * 0.9 + 0.005, 0.018, 32, 1, true), new THREE.MeshStandardMaterial({ map: strapTex(), roughness: 0.75, side: THREE.DoubleSide }));
    strap.position.copy(wr).addScaledVector(dir, 0.02); strap.quaternion.copy(gaunt.quaternion); strap.layers.set(1); armPivot.add(strap);
    const gp = new V3(...P.grip), up = new V3(...P.gripUp);
    const SH = new V3(0.03 - gp.x, -0.15, -0.03); gp.add(SH); for (const m of armPivot.children) m.position.add(SH);
    buildStick(stick, P);
    const fw = new V3(...P.gripFwd); fw.addScaledVector(up, -fw.dot(up)).normalize();
    stick.position.copy(gp); stick.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3().crossVectors(up, fw), up, fw));
    // pivot both stick and arm around the stick's base (in the floor gimbal) so the glove stays on the grip
    const base = gp.clone().addScaledVector(up, P.gripBot - STICK_SHAFT);
    armPivot.position.copy(base); for (const m of armPivot.children) m.position.sub(base);
    g.remove(stick); stick.position.sub(base); armPivot.add(stick);
    // fixed floor pedestal + console the stick rises out of
    const ped = buildPedestal(T, base, up); g.add(ped);
    g.traverse(o => o.layers.set(1));
    g.userData.armPivot = armPivot;
    return Promise.all(waits);
  });
  // interior light
  const lamp = new THREE.PointLight(new THREE.Color(T.accent).lerp(new THREE.Color(0xffffff), 0.7), 5, 4, 2); lamp.position.set(0, 0.35, -0.75); g.add(lamp);
  const flair = addFlair(g, T, type, { D, lamp });
  g.traverse(o => o.layers.set(1));
  g.userData = Object.assign(g.userData, { type, T, D, stick, lamp, power: 1, armPivot: null, flair });
  g.userData.updateArm = () => {};
  return g;
}

// ---------------------------------------------------------------- live instrument painting
export function paintLights(ck, st, t) {
  const L = ck.userData.D.lights; if (!L) return; const x = L.ctx, w = L.canvas.width, h = L.canvas.height;
  x.fillStyle = "#050505"; x.fillRect(0, 0, w, h);
  const items = [["EJECT", st.eject, "#ff2010"], ["AUTO", st.auto, "#40ff60"], ["LOCK", st.lock, "#ffb040"], ["MSL", st.missile && Math.floor(t * 6) % 2, "#ff2010"], ["A/B", st.ab, "#40c0ff"], ["SHLD", st.shield, "#ff8020"], ["CLOAK", st.cloak, "#80e0ff"]];
  const bw = w / items.length;
  items.forEach(([lbl, on, col], i) => {
    const p = ck.userData.power;
    x.fillStyle = on && p > 0.5 ? col : "#1a1414"; x.fillRect(i * bw + 6, 8, bw - 12, h - 16);
    x.fillStyle = on && p > 0.5 ? "#000" : "#4a3a3a"; x.font = "bold 34px 'Share Tech Mono', monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(lbl, i * bw + bw / 2, h / 2 + 2);
  });
  L.tex.needsUpdate = true;
}
export function paintReadouts(ck, st) {
  const D = ck.userData.D, p = ck.userData.power;
  for (const [key, lines] of [["speed", [["SET", st.set], ["KPS", st.kps]]], ["energy", [["GUN", st.gun], ["FUEL", st.fuel]]]]) {
    const R = D[key]; if (!R) continue; const x = R.ctx, w = R.canvas.width, h = R.canvas.height;
    x.fillStyle = "#020302"; x.fillRect(0, 0, w, h); if (p < 0.3) { R.tex.needsUpdate = true; continue; }
    x.font = "bold 36px 'Share Tech Mono', monospace"; x.textBaseline = "middle";
    lines.forEach(([lbl, v], i) => {
      const y = 26 + i * 44; x.fillStyle = "#ffb040"; x.textAlign = "left"; x.fillText(lbl, 10, y);
      if (key === "speed") { x.textAlign = "right"; x.fillText(String(Math.round(v)).padStart(4, " "), w - 10, y); }
      else { x.fillStyle = "#2a1a08"; x.fillRect(100, y - 12, w - 112, 24); x.fillStyle = v > 0.3 ? "#ffb040" : "#ff3020"; x.fillRect(100, y - 12, (w - 112) * Math.max(0, Math.min(1, v)), 24); }
    });
    R.tex.needsUpdate = true;
  }
}
export { THEMES };
