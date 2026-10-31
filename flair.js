// HALCYON WING — cockpit atmosphere: dust in the lamp light that reacts to manoeuvres, a tired
// bulb in the oldest airframes, and extra paint wear for the panel painter.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const V3 = THREE.Vector3;
export const WEAR = { kestrel: 1, lancer: 0.7, warden: 0.5, longbow: 0.6, wraith: 0.15 };
const MARKER = "'Permanent Marker', 'Marker Felt', 'Comic Sans MS', 'DejaVu Sans', cursive", HAND = "'Caveat', 'Comic Sans MS', cursive";

function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

// a flat (optionally curled) sticker/paper laid over a surface
function decal(c, w, h, { curl = 0, rough = 0.85, metal = 0, seg = 8, emissive = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(w, h, seg, seg);
  if (curl) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w + 0.5, v = p.getY(i) / h + 0.5; p.setZ(i, curl * (Math.max(0, u - 0.7) ** 2 * 3 + Math.max(0, v - 0.75) ** 2 * 2)); } geo.computeVertexNormals(); }
  const tex = canvasTex(c);
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.04, roughness: rough, metalness: metal, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, emissive: emissive ? 0xffffff : 0x000000, emissiveMap: emissive ? tex : null, emissiveIntensity: emissive });
  const mesh = new THREE.Mesh(geo, m); mesh.userData.canvas = c; mesh.userData.tex = tex; return mesh;
}
function at(mesh, ref, dx, dy, dz, rz = 0) { mesh.position.copy(ref.position); mesh.quaternion.copy(ref.quaternion); mesh.translateX(dx); mesh.translateY(dy); mesh.translateZ(dz); mesh.rotateZ(rz); return mesh; }

// ---------------------------------------------------------------- painted props
function paintTape(c, text, seed, size = 54) {
  const x = c.getContext("2d"), w = c.width, h = c.height, R = rnd(seed); x.clearRect(0, 0, w, h);
  // masking tape: torn ends, slightly translucent, grubby edges
  x.beginPath(); x.moveTo(10, 8); for (let yy = 8; yy <= h - 8; yy += 6) x.lineTo(4 + R() * 12, yy);
  x.lineTo(w - 10, h - 8); for (let yy = h - 8; yy >= 8; yy -= 6) x.lineTo(w - 4 - R() * 12, yy); x.closePath();
  x.fillStyle = "rgba(214,200,158,.93)"; x.fill();
  x.save(); x.clip();
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${R() < 0.5 ? "60,50,30" : "255,250,230"},${R() * 0.08})`; x.fillRect(R() * w, R() * h, 2, 2); }
  const gE = x.createLinearGradient(0, 0, 0, h); gE.addColorStop(0, "rgba(80,60,30,.22)"); gE.addColorStop(0.18, "rgba(0,0,0,0)"); gE.addColorStop(0.82, "rgba(0,0,0,0)"); gE.addColorStop(1, "rgba(80,60,30,.25)"); x.fillStyle = gE; x.fillRect(0, 0, w, h);
  x.translate(w / 2, h / 2 + 4); x.rotate((R() - 0.5) * 0.05);
  x.fillStyle = "rgba(18,18,30,.92)"; x.font = `${size}px ${MARKER}`; x.textAlign = "center"; x.textBaseline = "middle";
  let s = size; while (x.measureText(text).width > w - 50 && s > 14) { s -= 2; x.font = `${s}px ${MARKER}`; }
  x.fillText(text, 0, 0); x.restore();
}
function paintPhoto(c) {
  const x = c.getContext("2d"), w = c.width, h = c.height, R = rnd(77);
  x.fillStyle = "#e8e0cc"; x.fillRect(0, 0, w, h);                         // aged print border
  const ix = 18, iy = 18, iw = w - 36, ih = h * 0.72;
  const sky = x.createLinearGradient(0, iy, 0, iy + ih * 0.62); sky.addColorStop(0, "#2a2350"); sky.addColorStop(0.45, "#a64a52"); sky.addColorStop(0.8, "#f39a4a"); sky.addColorStop(1, "#ffd27a");
  x.fillStyle = sky; x.fillRect(ix, iy, iw, ih * 0.62);
  // ringed giant rising over the sea
  x.save(); x.beginPath(); x.rect(ix, iy, iw, ih * 0.62); x.clip();
  x.fillStyle = "rgba(255,214,170,.55)"; x.beginPath(); x.arc(ix + iw * 0.72, iy + ih * 0.3, iw * 0.2, 0, 7); x.fill();
  x.strokeStyle = "rgba(255,230,200,.5)"; x.lineWidth = 3; x.beginPath(); x.ellipse(ix + iw * 0.72, iy + ih * 0.3, iw * 0.34, iw * 0.06, -0.25, 0, 7); x.stroke();
  x.fillStyle = "#fff4d0"; x.beginPath(); x.arc(ix + iw * 0.28, iy + ih * 0.58, iw * 0.07, 0, 7); x.fill();
  x.restore();
  const sea = x.createLinearGradient(0, iy + ih * 0.62, 0, iy + ih); sea.addColorStop(0, "#c8784a"); sea.addColorStop(0.3, "#4a3448"); sea.addColorStop(1, "#1a1626");
  x.fillStyle = sea; x.fillRect(ix, iy + ih * 0.62, iw, ih * 0.38);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,220,170,${0.15 + R() * 0.3})`; x.fillRect(ix + iw * 0.18 + R() * iw * 0.2, iy + ih * (0.64 + R() * 0.3), 6 + R() * 18, 2); }
  // pier and two people at its end, in silhouette
  x.fillStyle = "#120e18"; x.fillRect(ix, iy + ih * 0.7, iw * 0.55, 7); for (let k = 0; k < 6; k++) x.fillRect(ix + k * iw * 0.1, iy + ih * 0.7, 4, 26);
  const fig = (fx, fy, s, lean) => { x.beginPath(); x.arc(fx, fy - s * 1.75, s * 0.32, 0, 7); x.fill(); x.beginPath(); x.moveTo(fx - s * 0.38, fy - s * 1.4); x.lineTo(fx + s * 0.38, fy - s * 1.4); x.lineTo(fx + s * 0.28 + lean, fy); x.lineTo(fx - s * 0.28 + lean, fy); x.fill(); };
  fig(ix + iw * 0.43, iy + ih * 0.7, 22, 2); fig(ix + iw * 0.5, iy + ih * 0.7, 19, -3);
  // print grain, fade, crease, worn corner
  const id = x.getImageData(0, 0, w, h); for (let i = 0; i < id.data.length; i += 4) { const n = (R() - 0.5) * 18; id.data[i] += n + 6; id.data[i + 1] += n + 2; id.data[i + 2] += n - 6; } x.putImageData(id, 0, 0);
  x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, h * 0.38); x.lineTo(w, h * 0.3); x.stroke();
  x.strokeStyle = "rgba(0,0,0,.18)"; x.beginPath(); x.moveTo(0, h * 0.385); x.lineTo(w, h * 0.305); x.stroke();
  x.fillStyle = "rgba(120,100,70,.25)"; x.beginPath(); x.moveTo(w, 0); x.lineTo(w - 40, 0); x.lineTo(w, 40); x.fill();
  x.fillStyle = "#2a2440"; x.font = `40px ${HAND}`; x.textAlign = "center";
  x.fillText("Calder, last summer.", w / 2, iy + ih + 52); x.fillText("Come home to us.  — M", w / 2, iy + ih + 96);
}
function paintChecklist(c, label) {
  const x = c.getContext("2d"), w = c.width, h = c.height, R = rnd(9);
  x.fillStyle = "#e9e4d4"; x.fillRect(0, 0, w, h);
  x.fillStyle = "#b8202a"; x.fillRect(0, 0, w, 54); x.fillStyle = "#fff"; x.font = "bold 26px 'Share Tech Mono', monospace"; x.fillText(`${label} — COMBAT`, 18, 36);
  const items = ["MASTER ARM ........ ARM", "SHIELDS ........ BAL/FWD", "ECM ............... AUTO", "IFF ......... MODE 4 SQK", "GUN CONV ...... 600 MTR", "DECOYS .......... CHECK", "THROTTLE .......... SET", "COMMS ...... VIGIL TAC", "AFTERBURN ..... READY", "EJECT SEAT ....... ARMED"];
  x.fillStyle = "#1a1a1a"; x.font = "22px 'Share Tech Mono', monospace";
  items.forEach((t, i) => { x.fillText(t, 22, 96 + i * 40); });
  // grease-pencil ticks, one circled warning, coffee ring
  x.strokeStyle = "rgba(190,30,30,.85)"; x.lineWidth = 4; x.lineCap = "round";
  for (let i = 0; i < 7; i++) { const yy = 88 + i * 40; x.beginPath(); x.moveTo(w - 46, yy); x.lineTo(w - 36, yy + 10); x.lineTo(w - 18, yy - 12); x.stroke(); }
  x.beginPath(); x.ellipse(w * 0.5, 96 + 8 * 40 - 8, w * 0.46, 22, -0.02, 0, 7); x.stroke();
  x.fillStyle = "rgba(190,30,30,.9)"; x.font = `30px ${HAND}`; x.fillText("bus 2 sticks — hit it twice", 26, h - 30);
  x.strokeStyle = "rgba(110,70,30,.28)"; x.lineWidth = 9; x.beginPath(); x.arc(w * 0.7, h * 0.62, 62, 0.3, 5.9); x.stroke();
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(80,70,50,${R() * 0.06})`; x.fillRect(R() * w, R() * h, 3, 3); }
  // dog-eared corner + lamination sheen
  x.fillStyle = "rgba(0,0,0,.25)"; x.beginPath(); x.moveTo(w, h); x.lineTo(w - 50, h); x.lineTo(w, h - 50); x.fill();
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0.3, "rgba(255,255,255,0)"); g.addColorStop(0.45, "rgba(255,255,255,.18)"); g.addColorStop(0.55, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h);
}
function paintKills(c, kills, callsign) {
  const x = c.getContext("2d"), w = c.width, h = c.height; x.clearRect(0, 0, w, h);
  x.fillStyle = "rgba(225,220,205,.88)"; x.font = "bold 58px 'Chakra Petch', 'DejaVu Sans', sans-serif"; x.textBaseline = "middle";
  const name = (callsign || "ROOKIE").toUpperCase(); x.fillText(name, 10, h / 2); const x0 = Math.max(240, x.measureText(name).width + 40);
  const n = Math.min(Math.floor((w - x0 - 30) / 28.4), kills | 0), sz = 15;
  for (let i = 0; i < n; i++) {
    const col = i, cx = x0 + 18 + col * 26 + Math.floor(col / 5) * 12, cy = h / 2;
    x.fillStyle = "#c42c22"; x.beginPath(); x.moveTo(cx, cy - sz); x.lineTo(cx + sz, cy + sz * 0.8); x.lineTo(cx + 4, cy + sz * 0.4); x.lineTo(cx, cy + sz); x.lineTo(cx - 4, cy + sz * 0.4); x.lineTo(cx - sz, cy + sz * 0.8); x.closePath(); x.fill();
  }
  if (!n) { x.fillStyle = "rgba(225,220,205,.35)"; x.font = "34px 'Share Tech Mono', monospace"; x.fillText("— NO KILLS LOGGED —", x0 + 20, h / 2); }
}
function paintTag(c, lines) {
  const x = c.getContext("2d"), w = c.width, h = c.height;
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#c9ccd0"); g.addColorStop(0.5, "#8d9196"); g.addColorStop(1, "#b5b8bc"); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = "#3a3c40"; x.beginPath(); x.arc(w / 2, 16, 8, 0, 7); x.fill();
  x.font = "bold 17px 'Share Tech Mono', monospace"; lines.forEach((t, i) => { x.fillStyle = "rgba(255,255,255,.55)"; x.fillText(t, 13, 52 + i * 24); x.fillStyle = "rgba(30,32,36,.85)"; x.fillText(t, 12, 51 + i * 24); });
  for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(255,255,255,${Math.random() * 0.25})`; x.beginPath(); const px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); x.lineTo(px + Math.random() * 20 - 10, py + Math.random() * 6 - 3); x.stroke(); }
}
function smudgeCanvas(seed) {
  const c = cv(512, 384), x = c.getContext("2d"), R = rnd(seed); x.clearRect(0, 0, 512, 384);
  // fingerprints near the edges where buttons get pressed, a wipe arc, fine scratches
  for (let f = 0; f < 5; f++) {
    const px = R() < 0.5 ? 30 + R() * 80 : 400 + R() * 80, py = 40 + R() * 300, a = R() * 3;
    x.save(); x.translate(px, py); x.rotate(a);
    for (let r = 4; r < 26; r += 2.6) { x.strokeStyle = `rgba(255,255,255,${0.10 - r * 0.002})`; x.lineWidth = 1.2; x.beginPath(); x.ellipse(0, 0, r, r * 1.35, 0, R() * 0.6, 5.6 + R() * 0.6); x.stroke(); }
    x.restore();
  }
  x.strokeStyle = "rgba(255,255,255,.022)"; x.lineWidth = 26; x.beginPath(); x.arc(150 + R() * 200, 420, 260, 3.6, 4.6); x.stroke();
  for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(255,255,255,${0.05 + R() * 0.08})`; x.lineWidth = 0.8; const px = R() * 512, py = R() * 384, L = 20 + R() * 90, a = R() * 3; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke(); }
  for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(255,255,255,${R() * 0.12})`; x.fillRect(R() * 512, R() * 384, 1.5, 1.5); }
  return c;
}
function placard(lines, bg, fg, w = 512, h = 128) {
  const c = cv(w, h), x = c.getContext("2d"); x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
  x.fillStyle = fg; x.textAlign = "center"; lines.forEach((t, i) => { x.font = `bold ${i ? 26 : 34}px 'Chakra Petch', sans-serif`; x.fillText(t, w / 2, 50 + i * 40); });
  for (const [px, py] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) { x.fillStyle = "#555"; x.beginPath(); x.arc(px, py, 6, 0, 7); x.fill(); }
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  return c;
}

// ---------------------------------------------------------------- build
export function addFlair(g, T, type, H) {
  const { D, lamp } = H, wear = WEAR[type] ?? 0.5, F = { items: {} };

  // dust motes drifting through the lamp light
  const N = 140, dp = new Float32Array(N * 3), seeds = new Float32Array(N); const R = rnd(31);
  for (let i = 0; i < N; i++) { dp[i * 3] = (R() - 0.5) * 1.6; dp[i * 3 + 1] = -0.4 + R() * 1.1; dp[i * 3 + 2] = -1.45 + R() * 1.0; seeds[i] = R() * 100; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffe8c8, size: 0.0035, sizeAttenuation: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(dust);

  // ---------------------------------------------------------------- per-frame
  const st = { ax: 0.05, az: -0.04, vx: 0, vz: 0, tw: 0.3, tv: 0, lastV: null, lastAv: new V3(), acc: new V3(), flick: 0, base: lamp.intensity, t: 0 };
  const _q = new THREE.Quaternion(), _v = new V3(), _w = new V3();
  F.update = (dt, pl) => {
    dt = Math.min(dt, 0.05); st.t += dt; if (dt <= 0) return;
    // ship acceleration in the cockpit frame (felt as the opposite pseudo-force)
    if (pl) {
      if (!st.lastV) st.lastV = pl.vel.clone();
      _v.copy(pl.vel).sub(st.lastV).divideScalar(dt); st.lastV.copy(pl.vel);
      _q.copy(pl.q).invert(); _v.applyQuaternion(_q).multiplyScalar(0.06); if (_v.length() > 30) _v.setLength(30);
      st.acc.lerp(_v, Math.min(1, dt * 10));
      _w.copy(pl.av).sub(st.lastAv).divideScalar(dt); st.lastAv.copy(pl.av);
    } else { st.acc.set(0, 0, 0); _w.set(0, 0, 0); }
    const a = st.acc;
    // dust: slow brownian drift, pushed by manoeuvres, wrapped in the cabin volume
    const p = dg.attributes.position;
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      let x = p.getX(i) + (Math.sin(st.t * 0.31 + s) * 0.006 - a.x * 0.0004) * dt * 4, y = p.getY(i) + (Math.cos(st.t * 0.23 + s * 1.7) * 0.005 - 0.002 - a.y * 0.0004) * dt * 4, z = p.getZ(i) + (Math.sin(st.t * 0.17 + s * 2.3) * 0.005 - a.z * 0.0004) * dt * 4;
      if (y < -0.45) y += 1.1; if (y > 0.7) y -= 1.1; if (x < -0.8) x += 1.6; if (x > 0.8) x -= 1.6; if (z < -1.45) z += 1.0; if (z > -0.45) z -= 1.0;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
    // a tired bulb in the old birds
    if (wear > 0.8) { if (st.flick <= 0 && Math.random() < dt * 0.25) st.flick = 0.05 + Math.random() * 0.25; if (st.flick > 0) { st.flick -= dt; lamp.intensity = st.base * (Math.random() < 0.5 ? 0.25 : 0.9); } else lamp.intensity = st.base * (lamp.userData.power ?? 1); }
  };
  F.personalize = async () => {};
  return F;
}

// extra wear painted straight into a panel canvas: chipped paint where hands rest, polish on
// much-pressed buttons, grime run-off under fasteners
export function wearPanel(x, w, h, subs, wear, seed) {
  const R = rnd(seed * 7 + 1);
  for (const [sx, sy, sw, sh] of subs) {
    const n = ((sw + sh) * 0.05 * wear) | 0;
    for (let i = 0; i < n; i++) {
      const side = (R() * 4) | 0, t = R();
      const px = side < 2 ? sx + t * sw : side === 2 ? sx : sx + sw, py = side < 2 ? (side ? sy + sh : sy) : sy + t * sh;
      const r = 1.5 + R() * 4 * wear;
      x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283, rr = r * (0.6 + R() * 0.6) + 1; x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.fill();
      x.fillStyle = `rgba(175,170,158,${0.45 + R() * 0.3})`; x.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283, rr = r * (0.6 + R() * 0.6); x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.fill();
    }
    // polished patches where gloves keep landing
    for (let i = 0; i < 3 * wear; i++) { const px = sx + R() * sw, py = sy + R() * sh, r = 18 + R() * 30; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(255,255,255,${0.06 * wear})`); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
    // grime run-off below the lower fasteners
    for (const fx of [sx + 10, sx + sw - 10]) { if (R() > 0.4 + wear * 0.5) continue; const L = 20 + R() * 60 * wear; const g = x.createLinearGradient(0, sy + sh - 10, 0, sy + sh - 10 + L); g.addColorStop(0, `rgba(20,14,8,${0.35 * wear})`); g.addColorStop(1, "rgba(20,14,8,0)"); x.fillStyle = g; x.fillRect(fx - 2 - R() * 2, sy + sh - 10, 3 + R() * 3, L); }
  }
  // long scratches + scuffs across the whole face
  for (let i = 0; i < 60 * wear; i++) { const px = R() * w, py = R() * h, L = 8 + R() * 70, a = (R() - 0.5) * 1.2; x.strokeStyle = `rgba(210,205,190,${0.05 + R() * 0.12})`; x.lineWidth = 0.6 + R(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke(); }
  for (let i = 0; i < 14 * wear; i++) { const px = R() * w, py = h * (0.6 + R() * 0.4), r = 30 + R() * 70; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, "rgba(25,18,10,.16)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
}
