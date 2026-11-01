// HALCYON WING — procedural textures and 3D models.
import * as THREE from "three";
import { setPlanetRenderer } from "./planets.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ---------------------------------------------------------------- RNG
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- TEXTURES
function canvas(w, h = w) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

function hullCanvases(fac, seed, caps) {
  const S = 1024, R = rng(seed);
  const col = canvas(S), bmp = canvas(S), emi = canvas(S), rou = canvas(S);
  const c = col.getContext("2d"), b = bmp.getContext("2d"), e = emi.getContext("2d"), r = rou.getContext("2d");
  const base = fac === "concord" ? [128, 136, 146] : [92, 66, 48];
  const alt = fac === "concord" ? [[150, 156, 164], [104, 114, 126], [176, 180, 184], [86, 98, 112]] : [[110, 54, 40], [72, 52, 40], [128, 96, 70], [56, 40, 34]];
  c.fillStyle = `rgb(${base})`; c.fillRect(0, 0, S, S);
  b.fillStyle = "#808080"; b.fillRect(0, 0, S, S);
  e.fillStyle = "#000"; e.fillRect(0, 0, S, S);
  r.fillStyle = "#909090"; r.fillRect(0, 0, S, S);
  // recursive panels
  const panels = [];
  (function split(x, y, w, h, d) {
    if (d > 5 || (d > 2 && R() < 0.28) || w < 40 || h < 40) { panels.push([x, y, w, h]); return; }
    if (w > h ? R() < 0.8 : R() < 0.2) { const k = Math.round(w * (0.3 + R() * 0.4)); split(x, y, k, h, d + 1); split(x + k, y, w - k, h, d + 1); }
    else { const k = Math.round(h * (0.3 + R() * 0.4)); split(x, y, w, k, d + 1); split(x, y + k, w, h - k, d + 1); }
  })(0, 0, S, S, 0);
  for (const [x, y, w, h] of panels) {
    const a = R() < 0.55 ? base : alt[(R() * alt.length) | 0];
    const v = (R() - 0.5) * 16;
    c.fillStyle = `rgb(${a[0] + v},${a[1] + v},${a[2] + v})`; c.fillRect(x, y, w, h);
    b.fillStyle = `rgb(${128 + v * 2},${128 + v * 2},${128 + v * 2})`; b.fillRect(x, y, w, h);
    const rv = 120 + R() * 90 | 0; r.fillStyle = `rgb(${rv},${rv},${rv})`; r.fillRect(x, y, w, h);
    // seams
    c.strokeStyle = "rgba(10,12,16,.75)"; c.lineWidth = 2.5; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    c.strokeStyle = "rgba(255,255,255,.12)"; c.lineWidth = 1; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
    b.strokeStyle = "#202020"; b.lineWidth = 3; b.strokeRect(x + 1, y + 1, w - 2, h - 2);
    // rivets
    if (R() < 0.45) { c.fillStyle = "rgba(20,20,24,.6)"; b.fillStyle = "#c8c8c8"; for (let i = 8; i < w - 6; i += 14) { c.fillRect(x + i, y + 6, 2.5, 2.5); c.fillRect(x + i, y + h - 8, 2.5, 2.5); b.fillRect(x + i, y + 6, 3, 3); b.fillRect(x + i, y + h - 8, 3, 3); } }
    // vents / hatches
    if (R() < 0.12 && w > 60 && h > 40) {
      const vx = x + 10, vy = y + 10, vw = Math.min(w - 20, 90), vh = Math.min(h - 20, 40);
      c.fillStyle = "rgba(15,15,18,.85)"; c.fillRect(vx, vy, vw, vh);
      for (let i = vy + 3; i < vy + vh - 2; i += 5) { c.fillStyle = "rgba(90,90,96,.6)"; c.fillRect(vx + 2, i, vw - 4, 2); b.fillStyle = "#e0e0e0"; b.fillRect(vx + 2, i, vw - 4, 2); }
    }
    // hazard stripes / clan bands
    if (R() < 0.05 && w > 80) {
      c.save(); c.beginPath(); c.rect(x + 4, y + 4, w - 8, Math.min(26, h - 8)); c.clip();
      for (let i = -40; i < w + 40; i += 22) { c.fillStyle = fac === "concord" ? "#d8b020" : "#a01a10"; c.beginPath(); c.moveTo(x + i, y); c.lineTo(x + i + 11, y); c.lineTo(x + i - 15, y + 40); c.lineTo(x + i - 26, y + 40); c.fill(); }
      c.restore();
    }
    // windows for capital ships
    if (caps && R() < 0.35 && h > 30) {
      const rows = 1 + (R() * 3 | 0);
      for (let k = 0; k < rows; k++) {
        const wy = y + 8 + k * 9; if (wy > y + h - 8) break;
        for (let i = x + 8; i < x + w - 8; i += 7) if (R() < 0.7) {
          const lit = fac === "concord" ? `rgba(255,${220 + R() * 30 | 0},${160 + R() * 60 | 0},${0.6 + R() * 0.4})` : `rgba(255,${120 + R() * 60 | 0},40,${0.6 + R() * 0.4})`;
          e.fillStyle = lit; e.fillRect(i, wy, 4, 3); c.fillStyle = "#15181c"; c.fillRect(i, wy, 4, 3);
        }
      }
    }
  }
  // decals
  c.textBaseline = "top";
  for (let i = 0; i < 8; i++) {
    const [x, y, w, h] = panels[(R() * panels.length) | 0];
    if (w < 90 || h < 40) continue;
    if (fac === "concord") {
      c.fillStyle = "rgba(230,232,236,.85)"; c.font = `bold ${16 + R() * 18 | 0}px "Barlow Semi Condensed", sans-serif`;
      if (caps) c.fillText(["CNS HALCYON", "CV-71", "▲ FUEL", "DECK " + (1 + R() * 9 | 0)][(R() * 4) | 0], x + 8, y + 8);
      if (R() < 0.5) { const cx = x + w - 26, cy = y + 24; c.fillStyle = "#1c3c78"; c.beginPath(); c.arc(cx, cy, 15, 0, 7); c.fill(); c.fillStyle = "#eef"; star(c, cx, cy, 10, 4); c.fillStyle = "#c02020"; c.fillRect(cx - 20, cy - 2, 6, 4); c.fillRect(cx + 14, cy - 2, 6, 4); }
    } else {
      c.strokeStyle = "rgba(220,200,160,.7)"; c.lineWidth = 3;
      let gx = x + 10; const gy = y + 10;
      for (let g = 0; g < 4 + R() * 4; g++) { c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + 8, gy + 18); c.lineTo(gx + 2, gy + 26); if (R() < 0.5) { c.moveTo(gx + 8, gy + 4); c.lineTo(gx + 14, gy + 4); } c.stroke(); gx += 18; }
      // claw scratch
      if (R() < 0.6) { c.strokeStyle = "rgba(200,190,170,.35)"; c.lineWidth = 2; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + 20 + k * 8, y + h - 10); c.lineTo(x + 60 + k * 8, y + 14); c.stroke(); } }
    }
  }
  // grime + noise
  for (let i = 0; i < 70; i++) {
    const x = R() * S, y = R() * S, rad = 20 + R() * 120, g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${fac === "concord" ? "20,22,26" : "30,12,8"},${0.08 + R() * 0.14})`); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // streaks
  for (let i = 0; i < 60; i++) { const x = R() * S, y = R() * S; c.fillStyle = `rgba(10,10,10,${0.04 + R() * 0.06})`; c.fillRect(x, y, 1 + R() * 3, 20 + R() * 80); }
  const id = c.getImageData(0, 0, S, S), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  c.putImageData(id, 0, 0);
  return { col, bmp, emi, rou };
}
// hero plating for the Halcyon: naval strakes laid like brickwork, welded seams, bolt rows, hatches,
// vents, rust bleed and soot streaks — sized so plates read at ~3 m on an 860 m hull
function heroHullCanvases(seed) {
  const S = 2048, R = rng(seed);
  const col = canvas(S), bmp = canvas(S), emi = canvas(S), rou = canvas(S);
  const c = col.getContext("2d"), b = bmp.getContext("2d"), e = emi.getContext("2d"), r = rou.getContext("2d");
  c.fillStyle = "rgb(122,130,140)"; c.fillRect(0, 0, S, S); b.fillStyle = "#808080"; b.fillRect(0, 0, S, S); e.fillStyle = "#000"; e.fillRect(0, 0, S, S); r.fillStyle = "#8a8a8a"; r.fillRect(0, 0, S, S);
  const tones = [[122, 130, 140], [116, 124, 134], [130, 137, 146], [110, 118, 128], [136, 142, 150], [104, 112, 122]];
  const rowH = 64; let row = 0;
  for (let y = 0; y < S; y += rowH, row++) {
    let x = -((row * 97) % 256);
    while (x < S) {
      const w = [128, 192, 256, 256, 320, 384][(R() * 6) | 0], t = tones[(R() * tones.length) | 0], v = (R() - 0.5) * 8;
      c.fillStyle = `rgb(${t[0] + v},${t[1] + v},${t[2] + v})`; c.fillRect(x, y, w, rowH);
      const bh = 120 + ((R() - 0.5) * 24 | 0); b.fillStyle = `rgb(${bh},${bh},${bh})`; b.fillRect(x, y, w, rowH);
      const rv = 110 + R() * 70 | 0; r.fillStyle = `rgb(${rv},${rv},${rv})`; r.fillRect(x, y, w, rowH);
      // weld seam + bevel highlight
      c.fillStyle = "rgba(14,16,20,.8)"; c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, rowH); b.fillStyle = "#2a2a2a"; b.fillRect(x, y, w, 3); b.fillRect(x, y, 3, rowH);
      c.fillStyle = "rgba(255,255,255,.14)"; c.fillRect(x + 2, y + 2, w - 2, 1); c.fillRect(x + 2, y + 2, 1, rowH - 2);
      c.fillStyle = "rgba(0,0,0,.14)"; c.fillRect(x + 2, y + rowH - 3, w - 2, 2);
      // bolt rows along the long seams
      if (R() < 0.5) { c.fillStyle = "rgba(30,32,36,.65)"; b.fillStyle = "#d0d0d0"; for (let i = x + 10; i < x + w - 6; i += 16) { c.fillRect(i, y + 6, 3, 3); b.fillRect(i, y + 6, 3, 3); } }
      // access hatch, vent or service plate
      const k = R();
      if (k < 0.07 && w >= 192) { const hx = x + 20 + R() * (w - 120), hw = 70 + R() * 30, hh = 44; c.fillStyle = "rgba(20,22,26,.55)"; c.fillRect(hx - 2, y + 9, hw + 4, hh + 4); c.fillStyle = `rgb(${t[0] - 8},${t[1] - 8},${t[2] - 8})`; c.fillRect(hx, y + 11, hw, hh); b.fillStyle = "#606060"; b.fillRect(hx - 2, y + 9, hw + 4, hh + 4); b.fillStyle = "#a0a0a0"; b.fillRect(hx, y + 11, hw, hh); c.fillStyle = "rgba(25,25,28,.8)"; for (const [a, d] of [[4, 4], [hw - 7, 4], [4, hh - 7], [hw - 7, hh - 7]]) c.fillRect(hx + a, y + 11 + d, 3, 3); }
      else if (k < 0.12 && w >= 192) { const vx = x + 16 + R() * (w - 110), vw = 80; c.fillStyle = "rgba(12,14,16,.9)"; c.fillRect(vx, y + 12, vw, 38); for (let i = 0; i < 6; i++) { c.fillStyle = "rgba(110,114,120,.7)"; c.fillRect(vx + 3, y + 15 + i * 6, vw - 6, 2); b.fillStyle = "#e0e0e0"; b.fillRect(vx + 3, y + 15 + i * 6, vw - 6, 2); }
        const g = c.createLinearGradient(0, y + 50, 0, y + 50 + 140); g.addColorStop(0, "rgba(20,18,16,.35)"); g.addColorStop(1, "rgba(20,18,16,0)"); c.fillStyle = g; c.fillRect(vx + 8, y + 50, vw - 16, 140); }
      else if (k < 0.15) { c.fillStyle = "rgba(220,224,228,.55)"; c.font = "bold 14px 'Share Tech Mono', monospace"; c.fillText(["FR " + (100 + (R() * 300 | 0)), "VOID " + (R() * 40 | 0), "NO STEP", "O2", "HAZ " + (R() * 9 | 0), "DC " + (R() * 20 | 0)][(R() * 6) | 0], x + 12, y + 26); }
      else if (k < 0.17 && w >= 256) { c.save(); c.beginPath(); c.rect(x + 6, y + 44, w - 12, 12); c.clip(); for (let i = -20; i < w; i += 18) { c.fillStyle = "#c8a020"; c.beginPath(); c.moveTo(x + i, y + 56); c.lineTo(x + i + 9, y + 56); c.lineTo(x + i + 21, y + 44); c.lineTo(x + i + 12, y + 44); c.fill(); } c.restore(); }
      x += w;
    }
  }
  // longitudinal frame lines every 4 rows (stronger seams with rivets)
  for (let y = 0; y < S; y += rowH * 4) { c.fillStyle = "rgba(10,12,14,.85)"; c.fillRect(0, y, S, 4); b.fillStyle = "#1a1a1a"; b.fillRect(0, y, S, 5); c.fillStyle = "rgba(255,255,255,.1)"; c.fillRect(0, y + 4, S, 1); for (let x = 6; x < S; x += 12) { c.fillStyle = "rgba(40,42,46,.7)"; c.fillRect(x, y + 8, 3, 3); b.fillStyle = "#cfcfcf"; b.fillRect(x, y + 8, 3, 3); } }
  // weathering: soot and rust streaks running down from seams, broad tonal variation, micro noise
  for (let i = 0; i < 260; i++) { const x = R() * S, y = R() * S, l = 40 + R() * 260, w = 2 + R() * 10, rust = R() < 0.3; const g = c.createLinearGradient(0, y, 0, y + l); g.addColorStop(0, rust ? `rgba(110,60,30,${0.08 + R() * 0.12})` : `rgba(18,18,20,${0.06 + R() * 0.12})`); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x, y, w, l); }
  for (let i = 0; i < 90; i++) { const x = R() * S, y = R() * S, rad = 60 + R() * 260, g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, `rgba(${R() < 0.5 ? "255,255,255" : "10,12,16"},${0.03 + R() * 0.05})`); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  const id = c.getImageData(0, 0, S, S), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n; } c.putImageData(id, 0, 0);
  return { col, bmp, emi, rou };
}
// crisp lettering for the hero hull: stencilled, weathered, transparent background
const LETTER = {};
// heavy twin-gun turret, built straight into a Builder: f = 1 faces the bow (-z), -1 aft; u = -1 hangs it under the hull; mir mirrors to port
function heavyGun(B, x, y, z, f = 1, u = 1, mir = false) {
  const a = (geo, mk, p, r = [0, 0, 0]) => { const P = [x + p[0], y + u * p[1], z - f * p[2]]; mir ? B.mirror(geo, mk, P, r) : B.add(geo, mk, P, r); };
  const Z = [Math.PI / 2, 0, 0];
  a(G.cyl(10.5, 11.5, 3, 28), "hull2", [0, 1.5, 0]); a(G.cyl(11.8, 11.8, 0.8, 28), "dark", [0, 0.4, 0]);          // barbette and roller ring
  a(G.box(17, 7.5, 19), "hull", [0, 7, -1]); a(G.box(15, 4.6, 5), "hull", [0, 6.2, 10]); a(G.box(16.4, 1, 18), "dark", [0, 10.9, -1]);   // gunhouse, sloped face, roof
  a(G.box(14, 5.5, 6), "hull2", [0, 6.6, -12.5]);                                                                   // rear bustle
  for (const dx of [-5, 0, 5]) a(G.box(3.2, 0.7, 10), "dark", [dx, 11.6, -2]);                                     // roof hatches / vents
  a(G.box(22, 1.8, 2.4), "dark", [0, 12, -6]); for (const dx of [-11.2, 11.2]) a(G.cyl(1.3, 1.3, 2.6, 10), "metal", [dx, 12, -6], Z);   // rangefinder arms
  a(G.box(13, 6, 2.4), "dark", [0, 6.6, 13.4]);                                                                     // mantlet
  for (const dx of [-3.4, 3.4]) { a(G.cyl(1.9, 1.9, 7, 14), "hull2", [dx, 6.6, 17.5], Z); a(G.cyl(1.05, 1.35, 30, 14), "metal", [dx, 6.6, 34], Z); a(G.cyl(1.7, 1.7, 3.4, 14), "dark", [dx, 6.6, 48.5], Z); a(G.cyl(1.2, 1.2, 0.6, 14), "dark", [dx, 6.6, 46], Z); }
  a(G.box(0.4, 0.4, 0.4), "lightR", [8.6, 9.6, 9]);
}
function letterTex(text, w = 2048, h = 320, col = "#eef0f2", font = "'Chakra Petch', 'Barlow Semi Condensed', 'DejaVu Sans', sans-serif", wt = 800) {
  const key = text + w + h + col; if (LETTER[key]) return LETTER[key];
  const cv = canvas(w, h), x = cv.getContext("2d"); x.clearRect(0, 0, w, h);
  let size = h * 0.86; x.font = `${wt} ${size}px ${font}`; while (x.measureText(text).width > w * 0.96 && size > 10) { size -= 4; x.font = `${wt} ${size}px ${font}`; }
  x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "rgba(10,12,16,.55)"; x.fillText(text, w / 2 + size * 0.03, h / 2 + size * 0.05);          // soft shadow edge
  x.fillStyle = col; x.fillText(text, w / 2, h / 2);
  x.globalCompositeOperation = "destination-out"; const R = rng(text.length * 7 + w);                                                                  // paint chips and scuffs
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.6})`; const r = 0.6 + Math.pow(R(), 3) * 7; x.beginPath(); x.arc(R() * w, R() * h, r, 0, 7); x.fill(); }
  for (let i = 0; i < 40; i++) { x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(R() * w, 0, 1 + R() * 3, h); }
  x.globalCompositeOperation = "source-over";
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return (LETTER[key] = t);
}
let ROUNDEL = null;
function texRoundel() {
  if (ROUNDEL) return ROUNDEL; const cv = canvas(512), x = cv.getContext("2d");
  x.fillStyle = "#c82018"; x.fillRect(24, 216, 464, 80); x.fillStyle = "#1c3c86"; x.beginPath(); x.arc(256, 256, 176, 0, 7); x.fill(); x.strokeStyle = "#f0f0f4"; x.lineWidth = 20; x.stroke(); x.fillStyle = "#f4f4f8"; star(x, 256, 264, 120, 48);
  x.globalCompositeOperation = "destination-out"; const R = rng(5); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(0,0,0,${0.2 + R() * 0.6})`; x.beginPath(); x.arc(R() * 512, R() * 512, 0.6 + Math.pow(R(), 3) * 5, 0, 7); x.fill(); } x.globalCompositeOperation = "source-over";
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return (ROUNDEL = t);
}
function letterMesh(tex, w, h, p, r) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.25, roughness: 0.55, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  m.position.set(...p); m.rotation.set(...r); return m;
}
function star(c, x, y, r, inner) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); }

// markings atlas: 8x8 cells of 128px
function decalAtlas() {
  const C = 128, cv = canvas(C * 8), x = cv.getContext("2d");
  const cell = (n, fn) => { x.save(); x.translate((n % 8) * C, Math.floor(n / 8) * C); x.beginPath(); x.rect(0, 0, C, C); x.clip(); fn(); x.restore(); };
  const txt = (n, t, col = "#eef0f4", size = 54, font = "'Barlow Semi Condensed', 'DejaVu Sans', sans-serif") => cell(n, () => { x.fillStyle = col; x.font = `800 ${size}px ${font}`; x.textAlign = "center"; x.textBaseline = "middle"; let s = size; while (x.measureText(t).width > C - 8 && s > 10) { s -= 2; x.font = `800 ${s}px ${font}`; } x.fillText(t, C / 2, C / 2 + 2); });
  // 0 Concord roundel
  cell(0, () => { x.fillStyle = "#c82018"; x.fillRect(6, 54, 116, 20); x.fillStyle = "#1c3c86"; x.beginPath(); x.arc(64, 64, 44, 0, 7); x.fill(); x.strokeStyle = "#f0f0f4"; x.lineWidth = 5; x.stroke(); x.fillStyle = "#f4f4f8"; star(x, 64, 66, 30, 12); });
  txt(1, "VIGIL"); txt(3, "NO STEP", "#1a1c20", 40); txt(5, "RESCUE", "#e0a020", 40); txt(6, "▲ DANGER", "#e0a020", 34); txt(7, "CNS", "#eef0f4");
  // 2 hazard stripes
  cell(2, () => { x.fillStyle = "#151515"; x.fillRect(0, 0, C, C); x.fillStyle = "#e0b020"; for (let i = -C; i < C * 2; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 16, 0); x.lineTo(i + 16 - C, C); x.lineTo(i - C, C); x.fill(); } });
  // 4 tail flash: navy chevrons
  cell(4, () => { x.fillStyle = "#1c3c86"; x.fillRect(0, 0, C, C); x.fillStyle = "#f0f0f4"; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(0, 20 + k * 36); x.lineTo(64, 4 + k * 36); x.lineTo(C, 20 + k * 36); x.lineTo(C, 32 + k * 36); x.lineTo(64, 16 + k * 36); x.lineTo(0, 32 + k * 36); x.fill(); } });
  // 8..15 side numbers
  ["07", "12", "21", "33", "42", "56", "64", "88"].forEach((t, i) => txt(8 + i, t, "#eef0f4", 84));
  // 16 kill tally / 17 canopy rim stripe
  cell(16, () => { x.fillStyle = "#c82018"; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(12 + i * 19, 40); x.lineTo(26 + i * 19, 64); x.lineTo(12 + i * 19, 88); x.lineTo(16 + i * 19, 64); x.fill(); } });
  cell(17, () => { x.fillStyle = "#e0b020"; x.fillRect(0, 50, C, 28); x.fillStyle = "#151515"; x.fillRect(0, 58, C, 4); });
  // 18 big hull number "CV-71", 19 "HALCYON"
  txt(18, "CV-71", "#e8eaee", 50); txt(19, "HALCYON", "#e8eaee", 30);
  // 24.. Vharr markings: clan glyphs, claw marks, the red eye, bone tally
  const glyph = (n, seed) => cell(n, () => { const R = rng(seed); x.strokeStyle = "#e8d8b8"; x.lineWidth = 9; x.lineCap = "round"; x.beginPath(); x.moveTo(64, 14); x.lineTo(64, 114); x.stroke(); for (let k = 0; k < 4; k++) { const y = 26 + k * 24, s = R() < 0.5 ? -1 : 1; x.beginPath(); x.moveTo(64, y); x.lineTo(64 + s * (18 + R() * 26), y + 10 + R() * 12); if (R() < 0.5) x.lineTo(64 + s * (30 + R() * 16), y - 6); x.stroke(); } });
  glyph(24, 3); glyph(25, 9); glyph(26, 17);
  cell(27, () => { x.strokeStyle = "rgba(230,215,190,.9)"; x.lineWidth = 7; x.lineCap = "round"; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(14 + k * 26, 112); x.quadraticCurveTo(40 + k * 26, 64, 34 + k * 26, 12); x.stroke(); } });
  cell(28, () => { x.fillStyle = "#b01810"; x.beginPath(); x.ellipse(64, 64, 56, 30, 0, 0, 7); x.fill(); x.fillStyle = "#1a0604"; x.beginPath(); x.ellipse(64, 64, 10, 26, 0, 0, 7); x.fill(); x.strokeStyle = "#e8d8b8"; x.lineWidth = 4; x.beginPath(); x.ellipse(64, 64, 56, 30, 0, 0, 7); x.stroke(); });
  cell(29, () => { x.fillStyle = "#e8d8b8"; for (let i = 0; i < 7; i++) x.fillRect(12 + i * 15, 30, 6, 68); x.fillRect(8, 60, 112, 6); });
  cell(30, () => { x.fillStyle = "#b01810"; x.fillRect(0, 40, C, 48); x.fillStyle = "#e8d8b8"; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 16, 40); x.lineTo(i * 16 + 8, 64); x.lineTo(i * 16 + 16, 40); x.fill(); } });
  // 20.. more hull text
  txt(20, "LODESTAR", "#e8eaee", 30); txt(21, "RESOLUTE", "#e8eaee", 30); txt(22, "DD-14", "#e8eaee", 54); txt(31, "MERIDIAN", "#e8eaee", 30); txt(32, "DOCK 1", "#e0b020", 40); txt(33, "DOCK 2", "#e0b020", 40);
  cell(23, () => { x.fillStyle = "rgba(240,240,236,.92)"; x.font = "800 26px 'DejaVu Sans Mono', monospace"; x.textAlign = "center"; x.fillText("MRDU", 64, 46); x.fillText("40417", 64, 76); x.fillRect(22, 88, 84, 4); });
  cell(35, () => { x.fillStyle = "#e07018"; x.fillRect(0, 40, C, 48); x.fillStyle = "#151515"; x.font = "800 30px 'DejaVu Sans', sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("CL-7", 64, 65); });
  // 40.. lit windows (drawn with the lit material): row, grid, Vharr slits
  const win = (n, rows, cols, warm, R) => cell(n, () => { for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const v = R(); if (v < 0.14) continue; x.fillStyle = v < 0.3 ? "#6a5a40" : warm[(v * 97 | 0) % warm.length]; const cw = C / cols, ch = C / rows; x.fillRect(i * cw + cw * 0.18, j * ch + ch * (rows > 1 ? 0.2 : 0.15), cw * 0.64, ch * (rows > 1 ? 0.55 : 0.7)); } });
  win(40, 1, 8, ["#fff2d0", "#ffe6b0", "#e8f0ff"], rng(5)); win(41, 4, 8, ["#fff2d0", "#ffe0a0", "#dce8ff", "#fff8e8"], rng(8));
  cell(42, () => { const R = rng(4); for (let i = 0; i < 7; i++) { const g = x.createLinearGradient(0, 20, 0, 108); g.addColorStop(0, "rgba(255,90,20,0)"); g.addColorStop(0.5, R() < 0.2 ? "#802010" : "#ff7a28"); g.addColorStop(1, "rgba(255,90,20,0)"); x.fillStyle = g; x.beginPath(); x.moveTo(10 + i * 17, 20); x.lineTo(18 + i * 17, 64); x.lineTo(10 + i * 17, 108); x.lineTo(14 + i * 17, 64); x.fill(); } });
  return cv;
}
const TEX = {};
export function initTextures(renderer) {
  setPlanetRenderer(renderer);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  { const h = heroHullCanvases(71); TEX.concord2 = { map: mk(h.col, 1), bump: mk(h.bmp), emi: mk(h.emi, 1), rough: mk(h.rou) }; }
  for (const fac of ["concord", "vharr"]) for (const caps of [0, 1]) {
    const h = hullCanvases(fac, fac === "concord" ? 7 + caps * 31 : 91 + caps * 17, caps);
    TEX[fac + caps] = { map: mk(h.col, 1), bump: mk(h.bmp), emi: mk(h.emi, 1), rough: mk(h.rou) };
  }
  // glow sprite
  const g = canvas(128), gc = g.getContext("2d"), gr = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(255,255,255,.85)"); gr.addColorStop(0.45, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  gc.fillStyle = gr; gc.fillRect(0, 0, 128, 128); TEX.glow = mk(g, 1);
  // bolt texture (elongated)
  const bt = canvas(64, 256), bc = bt.getContext("2d"), bg = bc.createLinearGradient(0, 0, 64, 0);
  bg.addColorStop(0, "rgba(255,255,255,0)"); bg.addColorStop(0.5, "rgba(255,255,255,1)"); bg.addColorStop(1, "rgba(255,255,255,0)");
  bc.fillStyle = bg; bc.fillRect(0, 0, 64, 256); TEX.bolt = mk(bt, 1);
  // smoke / fire puff
  const sm = canvas(128), sc = sm.getContext("2d");
  for (let i = 0; i < 26; i++) { const x = 64 + (Math.random() - .5) * 50, y = 64 + (Math.random() - .5) * 50, rr = 14 + Math.random() * 30, q = sc.createRadialGradient(x, y, 0, x, y, rr); q.addColorStop(0, "rgba(255,255,255,.35)"); q.addColorStop(1, "rgba(255,255,255,0)"); sc.fillStyle = q; sc.fillRect(0, 0, 128, 128); }
  TEX.puff = mk(sm, 1);
  // canopy glass gradient
  const gl = canvas(256), glc = gl.getContext("2d"), glg = glc.createLinearGradient(0, 0, 256, 256);
  glg.addColorStop(0, "#9ad0ff"); glg.addColorStop(0.5, "#14243a"); glg.addColorStop(1, "#5a8ab8"); glc.fillStyle = glg; glc.fillRect(0, 0, 256, 256);
  TEX.glass = mk(gl, 1);
  TEX.decals = mk(decalAtlas(), 1); TEX.decals.wrapS = TEX.decals.wrapT = THREE.ClampToEdgeWrapping;
  const ht = canvas(128), hc = ht.getContext("2d"), hg = hc.createRadialGradient(64, 64, 4, 64, 64, 64); hg.addColorStop(0, "#ffffff"); hg.addColorStop(0.35, "#c8e8ff"); hg.addColorStop(0.75, "#3a6aa0"); hg.addColorStop(1, "#0a1420"); hc.fillStyle = hg; hc.fillRect(0, 0, 128, 128); TEX.heat = mk(ht, 1);
  return TEX;
}
export function tex() { return TEX; }

// ---------------------------------------------------------------- MATERIALS
const MATS = {};
function mats(fac, caps) {
  const key = fac + caps; if (MATS[key]) return MATS[key];
  const T = TEX[key];
  const rep = caps === 2 ? 0.0105 : caps ? 0.004 : 0.045;
  const hull = new THREE.MeshStandardMaterial({ map: T.map, bumpMap: T.bump, bumpScale: caps === 2 ? 1.4 : caps ? 2.2 : 1.2, roughnessMap: T.rough, roughness: 0.75, metalness: fac === "concord" ? 0.38 : 0.3, emissiveMap: T.emi, emissive: caps ? 0xffffff : 0x000000, emissiveIntensity: caps ? 1.6 : 0 });
  const hull2 = hull.clone(); hull2.color = new THREE.Color(fac === "concord" ? 0xd8dde4 : 0xb04030);
  const dark = hull.clone(); dark.color = new THREE.Color(fac === "concord" ? 0x3a4048 : 0x2c1c16); dark.emissive = new THREE.Color(0);
  const bone = hull.clone(); bone.color = new THREE.Color(fac === "concord" ? 0x2a4a8a : 0xe8dcc0); bone.metalness = 0.2; bone.emissive = new THREE.Color(0);
  const metal = new THREE.MeshStandardMaterial({ color: 0x55585e, metalness: 0.95, roughness: 0.32, bumpMap: T.bump, bumpScale: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ map: TEX.glass, color: 0xffffff, metalness: 1, roughness: 0.08, emissive: fac === "concord" ? 0x0a1a2a : 0x2a0a00, envMapIntensity: 2 });
  const glow = new THREE.MeshBasicMaterial({ color: fac === "concord" ? 0x7ac8ff : 0xff8a30 });
  const red = new THREE.MeshStandardMaterial({ color: 0x8a1010, roughness: 0.4, metalness: 0.6, map: T.map, bumpMap: T.bump });
  const white = hull.clone(); white.color = new THREE.Color(0xf4f0e8); white.emissive = new THREE.Color(0);
  for (const m of [hull, hull2, dark, bone, red, white]) { m.map = m.map; }
  const accent = hull.clone(); accent.color = new THREE.Color(fac === "concord" ? 0x1e3a78 : 0x6a1410); accent.emissive = new THREE.Color(0);
  const decal = new THREE.MeshStandardMaterial({ map: TEX.decals, transparent: true, alphaTest: 0.35, roughness: 0.55, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const light = new THREE.MeshBasicMaterial({ color: fac === "concord" ? 0xe8f4ff : 0xffb070 });
  const lightR = new THREE.MeshBasicMaterial({ color: 0xff3020 }), lightG = new THREE.MeshBasicMaterial({ color: 0x30ff60 });
  const heat = new THREE.MeshBasicMaterial({ map: TEX.heat, color: fac === "concord" ? 0x9ad8ff : 0xffa050 });
  const orange = white.clone(); orange.color = new THREE.Color(0xe06a14);
  const lit = new THREE.MeshBasicMaterial({ map: TEX.decals, transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, color: fac === "concord" ? 0xffffff : 0xffd0b0 });
  if (caps === 2) { metal.metalness = 0.55; metal.roughness = 0.45; metal.color.set(0x8c939c); dark.color.set(0x56606c); dark.metalness = 0.3; }
  const bayLt = new THREE.MeshBasicMaterial({ color: 0x8a96a6 });   // hangar fixtures: lit but well under the engines
  const bayIn = hull2.clone(); bayIn.emissive = new THREE.Color(0x1c242e); bayIn.emissiveMap = hull2.map || null; bayIn.emissiveIntensity = 1;   // hangar interiors are lit from within
  // Vharr fighters glow faintly from within (bioluminescent hulls) so their shape reads against black space at range
  if (fac !== "concord" && !caps) for (const m of [hull, hull2, dark, bone, accent, red]) { m.emissive = m.color.clone().multiplyScalar(m === bone ? 0.16 : 0.32); m.emissiveMap = m.map; m.emissiveIntensity = 1; }
  const set = { hull, hull2, dark, bone, metal, glass, glow, red, white, accent, decal, light, lightR, lightG, heat, orange, lit, bayIn, bayLt, rep };
  MATS[key] = set; return set;
}

// ---------------------------------------------------------------- BUILDER
function boxUV(g, scale) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}
const NOUV = new Set(["glow", "glass", "decal", "light", "lightR", "lightG", "heat", "lit"]);

// audit-only provenance: when the test harness sets globalThis.__AUDIT_SRC, every piece remembers the code line that added it
function auditSrc(g, skip) {
  const T = globalThis.__AUDIT_SRC; if (!T) return;
  const st = new Error().stack.split("\n").slice(2).filter(l => !skip.test(l));
  const loc = st.slice(0, 3).map(l => (l.match(/([\w-]+\.js):(\d+)/) || [])[0]).filter(Boolean).join(" < ");
  let i = T.indexOf(loc); if (i < 0) { T.push(loc); i = T.length - 1; }
  g.setAttribute("auditSrc", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(i), 1));
}
class Builder {
  constructor(fac, caps) { this.m = mats(fac, caps); this.parts = {}; this.extra = []; this.fac = fac; }
  add(geo, mk, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], flat = false, mx = false) {
    if (!geo.attributes.normal) geo.computeVertexNormals();
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.clearGroups(); for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    auditSrc(g, /Builder\./);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
    g.applyMatrix4(m); if (flat) g.computeVertexNormals();
    if (mx) { // true mirror across x = 0: flip x, then restore triangle winding
      g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
      for (const k of ["position", "normal", "uv"]) { const a = g.attributes[k]; if (!a) continue; const s_ = a.itemSize; for (let i = 0; i < a.count; i += 3) for (let j = 0; j < s_; j++) { const t = a.array[(i + 1) * s_ + j]; a.array[(i + 1) * s_ + j] = a.array[(i + 2) * s_ + j]; a.array[(i + 2) * s_ + j] = t; } a.needsUpdate = true; }
    }
    (this.parts[mk] ||= []).push(g); return this;
  }
  side(sg, geo, mk, p, r = [0, 0, 0], s = [1, 1, 1]) { return this.add(geo, mk, p, r, s, false, sg < 0); }
  // a decal quad cut from the markings atlas; n = cell index, size [w,h], placed and rotated by hand
  decal(n, p, r, size, mk = "decal") {
    const g = new THREE.PlaneGeometry(size[0], size[1]); const uv = g.attributes.uv, cx = n % 8, cy = Math.floor(n / 8);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + 0.02 + uv.getX(i) * 0.96) / 8, 1 - (cy + 0.98 - uv.getY(i) * 0.96) / 8);
    return this.add(g, mk, p, r);
  }
  mirror(geo, mk, p, r = [0, 0, 0], s = [1, 1, 1]) { this.add(geo, mk, p, r, s); this.add(geo, mk, p, r, s, false, true); return this; }
  build() {
    const grp = new THREE.Group();
    for (const [mk, list] of Object.entries(this.parts)) {
      const g = mergeGeometries(list, false); if (!g) continue;
      if (!NOUV.has(mk)) boxUV(g, this.m.rep);
      const mesh = new THREE.Mesh(g, this.m[mk]); grp.add(mesh);
    }
    for (const e of this.extra) grp.add(e);
    return grp;
  }
}
const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s),
  sph: (r, w = 16, h = 12, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) => new THREE.SphereGeometry(r, w, h, ps, pl, ts, tl),
  cone: (r, h, s = 12) => new THREE.ConeGeometry(r, h, s),
  // wedge: tapered box, front narrower (z-)
  wedge(w, h, d, fw = 0.3, fh = 0.5) {
    const g = new THREE.BoxGeometry(w, h, d); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) < 0) { p.setX(i, p.getX(i) * fw); p.setY(i, p.getY(i) * fh); }
    g.computeVertexNormals(); return g;
  },
  // flat wing from 2D outline in x/z plane
  plate(pts, t) {
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: t * 0.3, bevelSegments: 1 });
    g.rotateX(Math.PI / 2); g.translate(0, t / 2, 0); return g;
  },
  lathe(pts, s = 16) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), s); },
  torus: (r, t, s = 24) => new THREE.TorusGeometry(r, t, 8, s),
};

function engineSprite(color, size) {
  const m = new THREE.SpriteMaterial({ map: TEX.glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}
function addEngines(grp, list, color, size) {
  const out = [];
  for (const p of list) { const s = engineSprite(color, size); s.position.set(...p); s.userData.base = size; grp.add(s); out.push(s); }
  return out;
}
function navLights(grp, l, r) {
  const a = engineSprite(0xff2020, 1.6), b = engineSprite(0x20ff40, 1.6); a.position.set(...l); b.position.set(...r);
  a.userData.blink = 1; b.userData.blink = 1; grp.add(a, b);
}
function greeble(B, R, area, n, mk = "dark") {
  // area: [x0,x1,y,z0,z1, face(+1 top / -1 bottom)]
  const [x0, x1, y, z0, z1, f] = area;
  for (let i = 0; i < n; i++) {
    const w = 3 + R() * 22, h = 2 + R() * 10, d = 3 + R() * 26;
    B.add(G.box(w, h, d), R() < 0.3 ? "metal" : mk, [x0 + R() * (x1 - x0), y + f * (h / 2 - 0.2 - R() * 0.3), z0 + R() * (z1 - z0)]);
  }
}

// ---------------------------------------------------------------- DETAIL KIT
// loft: smooth hull through superellipse cross-sections. s = {z, w, h, y?, x?, n? (2 round .. 8 boxy), bot? (lower-half scale)}
function inset(secs, k = 0.004) {
  const a = secs[0].z, b = secs[secs.length - 1].z, d = (b - a) * k, out = secs.map(s => ({ ...s }));
  out[0].z += d; out[out.length - 1].z -= d; return out;
}
function loft(secs, N = 28) {
  const pos = [], idx = [];
  for (const s of secs) {
    const n = s.n || 2.6, bot = s.bot ?? 1;
    // sample the superellipse densely, then place N points at equal arc length: boxy sections get flat flanks
    // with true outward normals instead of vertices bunched into the corners
    const M = N * 24, pts = [], acc = [0];
    for (let i = 0; i <= M; i++) {
      const t = i / M * Math.PI * 2, c = Math.cos(t), si = Math.sin(t);
      pts.push([(s.w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n), (s.h / 2) * Math.sign(si) * Math.abs(si) ** (2 / n) * (si < 0 ? bot : 1)]);
      if (i) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const P = acc[M]; let j = 0;
    for (let i = 0; i < N; i++) {
      const L = i / N * P; while (j < M - 1 && acc[j + 1] < L) j++;
      const f = P > 1e-6 ? (L - acc[j]) / Math.max(1e-9, acc[j + 1] - acc[j]) : 0;
      pos.push((s.x || 0) + pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, (s.y || 0) + pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f, s.z);
    }
  }
  for (let k = 0; k < secs.length - 1; k++) for (let i = 0; i < N; i++) {
    const a = k * N + i, b = k * N + (i + 1) % N, c = a + N, d = b + N; idx.push(a, b, c, b, d, c);   // outward when z increases along secs
  }
  // caps
  for (const [k, flip] of [[0, true], [secs.length - 1, false]]) {
    const s = secs[k]; if (s.w < 0.05 && s.h < 0.05) continue;
    const ci = pos.length / 3; pos.push(s.x || 0, s.y || 0, s.z);
    for (let i = 0; i < N; i++) { const a = k * N + i, b = k * N + (i + 1) % N; flip ? idx.push(ci, b, a) : idx.push(ci, a, b); }
  }
  if (secs[secs.length - 1].z < secs[0].z) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }   // lofted nose-first: keep faces outward
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function nozzle(B, p, r, len = r * 1.4, flare = 1.15) {
  // bell with petals, dark throat, hot inner cone
  B.add(G.lathe([[r * 0.78, 0], [r * 0.95, len * 0.2], [r, len * 0.55], [r * flare, len], [r * flare * 0.92, len * 1.02], [r * 0.7, len * 0.6]], 24), "dark", [p[0], p[1], p[2] - len * 0.5], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; B.add(G.box(r * 0.18, r * 0.06, len * 0.5), "metal", [p[0] + Math.cos(a) * r * 1.04, p[1] + Math.sin(a) * r * 1.04, p[2] + len * 0.2], [0, 0, a]); }
  B.add(G.cone(r * 0.62, len * 0.8, 20), "heat", [p[0], p[1], p[2] + len * 0.05], [-Math.PI / 2, 0, 0]);
  B.add(G.torus(r * 0.86, r * 0.07, 24), "metal", [p[0], p[1], p[2] - len * 0.48]);
}
function gun(B, p, len = 2.4, r = 0.17) {
  B.add(G.box(r * 3.4, r * 3.2, len * 0.45), "dark", [p[0], p[1], p[2] + len * 0.3]);
  B.add(G.cyl(r, r, len, 10), "metal", [p[0], p[1], p[2]], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) B.add(G.cyl(r * 1.55, r * 1.55, len * 0.06, 10), "dark", [p[0], p[1], p[2] - len * (0.12 + i * 0.1)], [Math.PI / 2, 0, 0]);
  B.add(G.cyl(r * 1.35, r * 1.1, len * 0.12, 10), "dark", [p[0], p[1], p[2] - len * 0.5], [Math.PI / 2, 0, 0]);
}
function missile(B, p, len = 2.6, r = 0.2, nose = "red") {
  B.add(G.cyl(r, r, len * 0.72, 10), "white", [p[0], p[1], p[2]], [Math.PI / 2, 0, 0]);
  B.add(G.cone(r, len * 0.28, 10), nose, [p[0], p[1], p[2] - len * 0.5], [-Math.PI / 2, 0, 0]);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; B.add(G.box(r * 0.12, r * 2.6, len * 0.16), "dark", [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, p[2] + len * 0.3], [0, 0, a]); }
  B.add(G.box(r * 0.8, r * 1.1, len * 0.5), "dark", [p[0], p[1] + r * 1.25, p[2]]);       // pylon
}
// build a ship with its canopy removed (glass, sill, frame hoops and spine): for scenes where a
// separate opening canopy is fitted
let NO_CANOPY = false, CAN_FOUND = [];
// returns the ship plus .canopy = { p, sz } — the exact dome the model would have had, so a hinged replacement fits the fuselage
export function buildShipOpen(type) { NO_CANOPY = true; CAN_FOUND = []; try { const m = buildShip(type); m.canopy = CAN_FOUND[0] || null; return m; } finally { NO_CANOPY = false; } }
function canopy(B, p, sz, bows = 3) {
  if (NO_CANOPY) { CAN_FOUND.push({ p: [...p], sz: [...sz] }); return; }   // the hinged canopy fitted in the scene is the only thing over the cockpit
  B.add(G.sph(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), "glass", p, [0, 0, 0], sz);
  B.add(G.sph(1, 24, 12), "dark", [p[0], p[1] - sz[1] * 0.05, p[2]], [0, 0, 0], [sz[0] * 1.06, sz[1] * 0.3, sz[2] * 1.03]);
  for (let i = 0; i < bows; i++) { const z = p[2] + sz[2] * (-0.45 + i * 0.9 / Math.max(1, bows - 1)); const k = Math.sqrt(Math.max(0.05, 1 - ((z - p[2]) / sz[2]) ** 2)); B.add(G.torus(1, 0.045, 24), "dark", [p[0], p[1], z], [0, 0, 0], [sz[0] * k, sz[1] * k, 1]); }
  B.add(G.box(0.08, sz[1] * 0.12, sz[2] * 1.9), "dark", [p[0], p[1] + sz[1] * 0.98, p[2]]);
}
function intake(B, p, w, h, d) {
  B.add(G.box(w, h, d), "hull", p); B.add(G.box(w * 0.78, h * 0.7, 0.1), "dark", [p[0], p[1], p[2] - d / 2 - 0.02]);
  for (let i = 1; i < 4; i++) B.add(G.box(w * 0.74, 0.04, 0.12), "metal", [p[0], p[1] - h * 0.35 + i * h * 0.175, p[2] - d / 2]);
}
function antenna(B, p, len, mk = "light") { B.add(G.cyl(0.03, 0.05, len, 5), "metal", [p[0], p[1] + len / 2, p[2]]); B.add(G.sph(0.08, 6, 4), mk, [p[0], p[1] + len, p[2]]); }
function rcs(B, p, dir = 1) { B.add(G.box(0.36, 0.36, 0.36), "dark", p); for (const [dx, dy] of [[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]]) B.add(G.cyl(0.05, 0.07, 0.12, 6), "metal", [p[0] + dx, p[1] + dy, p[2] + dir * 0.2], [Math.PI / 2, 0, 0]); }
function runLight(B, p, mk = "light", s = 0.12) { B.add(G.sph(s, 8, 6), mk, p); }
function panelLines(B, x0, x1, y, z0, z1, n, mk = "dark") { for (let i = 0; i < n; i++) { const z = z0 + (z1 - z0) * (i + 0.5) / n; B.add(G.box(Math.abs(x1 - x0), 0.02, 0.05), mk, [(x0 + x1) / 2, y, z]); } }

// --- hull surface sampling: place parts and markings exactly on a lofted hull
function secAt(secs, z) {
  let a = secs[0], b = secs[secs.length - 1], t = 0;
  for (let i = 0; i < secs.length - 1; i++) { const p = secs[i], q = secs[i + 1]; if ((z - p.z) * (z - q.z) <= 0) { a = p; b = q; t = (z - p.z) / ((q.z - p.z) || 1); break; } }
  if (z < Math.min(secs[0].z, b.z) && z < secs[0].z) { a = b = secs[0]; t = 0; }
  const L = (k, d) => (a[k] ?? d) + ((b[k] ?? d) - (a[k] ?? d)) * t;
  return { w: L("w", 0), h: L("h", 0), y: L("y", 0), x: L("x", 0), n: L("n", 2.6), bot: L("bot", 1) };
}
// y on the top (sg 1) or bottom (sg -1) of the hull at (x, z)
function surfY(secs, x, z, sg = 1) { const s = secAt(secs, z); const t = Math.min(1, Math.abs((x - s.x) / (s.w / 2))); return s.y + sg * (s.h / 2) * (sg < 0 ? s.bot : 1) * Math.max(0, 1 - t ** s.n) ** (1 / s.n); }
// x on the side s (+1 / -1) of the hull at height dy above the section centre
function surfX(secs, s, z, dy = 0) { const q = secAt(secs, z); const hh = q.h / 2 * (dy < 0 ? q.bot : 1); const t = Math.min(1, Math.abs(dy / hh)); return q.x + s * (q.w / 2) * Math.max(0, 1 - t ** q.n) ** (1 / q.n); }
function sideDecal(B, secs, n, s, z, dy, size, mk = "decal", off = 0.3) {
  const q = secAt(secs, z), x0 = surfX(secs, s, z, dy), x1 = surfX(secs, s, z + 1, dy), fp = (x1 - x0) * s;
  B.decal(n, [x0 + s * off, q.y + dy, z], [0, Math.atan2(s, -fp), 0], size, mk);
}
function topDecal(B, secs, n, x, z, size, mk = "decal", off = 0.3, sg = 1) {
  const y0 = surfY(secs, x, z, sg), y1 = surfY(secs, x, z + 1, sg), fp = (y1 - y0) * sg;
  B.decal(n, [x, y0 + sg * off, z], sg > 0 ? [Math.atan2(-1, -fp), 0, 0] : [Math.atan2(1, -fp), 0, 0], size, mk);
}
const _UP = new THREE.Vector3(0, 1, 0);
// cylinder between two points
function strut(B, a, b, r, mk = "metal", seg = 6) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), L = d.length(); if (L < 1e-3) return;
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(_UP, d.normalize()));
  B.add(G.cyl(r, r, L, seg), mk, A.add(Bv).multiplyScalar(0.5).toArray(), [e.x, e.y, e.z]);
}
// square lattice truss from a to b: four longerons, ring frames and diagonal bracing
function truss(B, a, b, w, n, mk = "metal", r = w * 0.05) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A).normalize();
  const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : _UP).normalize(), v = new THREE.Vector3().crossVectors(d, u);
  const cs = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => u.clone().multiplyScalar(i * w / 2).add(v.clone().multiplyScalar(j * w / 2)));
  const P = (t, k) => A.clone().lerp(Bv, t).add(cs[k % 4]).toArray();
  for (let k = 0; k < 4; k++) strut(B, P(0, k), P(1, k), r * 1.4, mk);
  for (let i = 0; i <= n; i++) for (let k = 0; k < 4; k++) { strut(B, P(i / n, k), P(i / n, k + 1), r, mk, 4); if (i < n) strut(B, P(i / n, k), P((i + 1) / n, k + 1), r * 0.8, mk, 4); }
}
// radiator panel: thin dark plate with ribbing, lying in the plane given by rotation r
function radiator(B, p, r, w, l, ribs = 8) {
  B.add(G.box(w, l * 0.02 + 0.2, l), "dark", p, r);
  const e = new THREE.Euler(...r), ax = new THREE.Vector3(1, 0, 0).applyEuler(e), up = new THREE.Vector3(0, 1, 0).applyEuler(e);
  for (let i = 0; i <= ribs; i++) { const o = new THREE.Vector3(...p).addScaledVector(ax, (i / ribs - 0.5) * w * 0.96).addScaledVector(up, l * 0.012 + 0.1); B.add(G.box(w * 0.012 + 0.1, l * 0.012 + 0.1, l * 0.98), "metal", o.toArray(), r); }
}
// a band of lit window quads around a vertical cylinder of radius rad at height y
function windowRing(B, rad, y, n, cell, h, mk = "lit", inward = false) {
  for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); B.decal(cell, [c * rad, y, s * rad], [0, Math.atan2(c, s) + (inward ? Math.PI : 0), 0], [2 * Math.PI * rad / n * 0.86, h], mk); }
}

// ---------------------------------------------------------------- FIGHTERS (forward is -Z)
const SIDE = () => 8 + ((Math.random() * 8) | 0);
const FIGHTERS = {
  kestrel() {
    // light interceptor: needle fuselage, cranked delta, single engine, wingtip rails
    const B = new Builder("concord", 0);
    B.add(loft([{ z: -9.2, w: 0.05, h: 0.05, y: -0.1 }, { z: -7.6, w: 0.7, h: 0.6, y: -0.05 }, { z: -5, w: 1.5, h: 1.25, y: 0.05, bot: 0.8 }, { z: -2.2, w: 2.1, h: 1.7, y: 0.2, n: 3, bot: 0.75 }, { z: 1.5, w: 2.5, h: 1.8, y: 0.15, n: 3.4, bot: 0.8 }, { z: 4.4, w: 2.3, h: 1.6, y: 0.1, n: 3.6 }, { z: 5.4, w: 2.0, h: 1.5, y: 0.05, n: 3.6 }]), "hull");
    B.add(loft([{ z: -2.6, w: 0.05, h: 0.05, y: 0.9 }, { z: 0, w: 0.9, h: 0.7, y: 1.05 }, { z: 4.2, w: 0.7, h: 0.5, y: 0.95 }]), "hull2");   // dorsal spine
    canopy(B, [0, 0.95, -3.4], [0.78, 0.62, 1.7]);
    B.mirror(G.plate([[0, -1.4], [2.2, 0.2], [5.6, 3.4], [5.8, 4.6], [0, 4.6]], 0.16), "hull", [0.9, -0.25, 0]);
    B.mirror(G.plate([[0, -0.2], [0.9, 0.4], [0.9, 0.9], [0, 0.9]], 0.18), "accent", [5.0, -0.2, 3.7]);       // wingtip flash
    B.mirror(G.box(0.08, 1.4, 1.5), "hull2", [5.9, 0.45, 4.0], [0, 0, 0.1]);                                    // wingtip fins
    B.mirror(G.cyl(0.08, 0.08, 4.6, 6), "metal", [5.8, -0.22, 2.4], [Math.PI / 2, 0, 0]);                       // missile rails
    missile(B, [5.8, -0.55, 2.3], 2.4, 0.17); missile(B, [-5.8, -0.55, 2.3], 2.4, 0.17);
    intake(B, [1.15, -0.1, -1.0], 0.5, 0.9, 1.8); intake(B, [-1.15, -0.1, -1.0], 0.5, 0.9, 1.8);
    B.add(G.plate([[0, 0], [0.12, 0], [0.12, 2.6], [0, 2.6]], 0.14), "hull2", [0, 0.2, 2.6], [0, 0, Math.PI / 2]);
    B.add(G.wedge(0.16, 2.0, 2.6, 1, 0.4), "hull2", [0, 1.7, 3.8], [0, 0, 0]);                                   // tail fin
    B.decal(4, [0.09, 1.8, 4.2], [0, Math.PI / 2, 0], [1.6, 1.2]); B.decal(4, [-0.09, 1.8, 4.2], [0, -Math.PI / 2, 0], [1.6, 1.2]);
    const num = SIDE(); B.decal(num, [1.06, 0.3, -5.2], [0, Math.PI / 2 + 0.12, 0], [0.9, 0.9]); B.decal(num, [-1.06, 0.3, -5.2], [0, -Math.PI / 2 - 0.12, 0], [0.9, 0.9]);
    B.decal(0, [3.6, -0.05, 2.6], [-Math.PI / 2, 0, 0], [1.6, 1.6]); B.decal(0, [-3.6, -0.05, 2.6], [-Math.PI / 2, 0, 0], [1.6, 1.6]);
    B.decal(3, [1.6, 0.0, 0.5], [-Math.PI / 2, 0, 0], [1.1, 0.5]); B.decal(17, [0, 1.42, -1.6], [-Math.PI / 2, 0, 0], [1.0, 0.3]);
    gun(B, [1.25, -0.55, -2.4], 2.2, 0.13); gun(B, [-1.25, -0.55, -2.4], 2.2, 0.13);
    rcs(B, [1.05, 0.5, -6.2], -1); rcs(B, [-1.05, 0.5, -6.2], -1);
    nozzle(B, [0, 0.1, 5.9], 0.82, 1.3);
    antenna(B, [0, 1.35, 2.5], 0.7); runLight(B, [0, 2.7, 4.6], "lightR", 0.1);
    runLight(B, [-5.8, -0.18, 4.6], "lightR"); runLight(B, [5.8, -0.18, 4.6], "lightG");
    const g = B.build();
    return { obj: g, eng: addEngines(g, [[0, 0.1, 6.7]], 0x8ad0ff, 5), guns: [[-1.25, -0.55, -3.6], [1.25, -0.55, -3.6]] };
  },
  lancer() {
    // medium multirole: lifting body, twin nacelles on a broad wing, twin tails, four guns
    const B = new Builder("concord", 0);
    B.add(loft([{ z: -9, w: 0.05, h: 0.05, y: 0 }, { z: -7, w: 1.4, h: 0.9 }, { z: -4, w: 2.6, h: 1.8, y: 0.25, n: 3, bot: 0.7 }, { z: 0, w: 3.2, h: 2.2, y: 0.35, n: 3.6, bot: 0.7 }, { z: 4, w: 3.0, h: 1.9, y: 0.3, n: 4 }, { z: 6.2, w: 2.2, h: 1.4, y: 0.25, n: 4 }]), "hull");
    canopy(B, [0, 1.35, -4.2], [0.9, 0.68, 1.9]);
    B.add(G.plate([[-4.6, -1.6], [4.6, -1.6], [6.6, 3.6], [6.6, 4.8], [-6.6, 4.8], [-6.6, 3.6]], 0.34), "hull2", [0, -0.35, 0]);
    for (const s of [-1, 1]) {
      const x = s * 3.9;
      B.add(loft([{ z: -6.4, w: 0.3, h: 0.3, x }, { z: -5.2, w: 1.5, h: 1.4, x }, { z: 0, w: 1.8, h: 1.7, x, n: 3 }, { z: 6.4, w: 1.9, h: 1.8, x, n: 3 }, { z: 7.4, w: 1.7, h: 1.6, x, n: 3 }]), "hull");
      B.add(G.box(0.2, 0.5, 9), "accent", [x + s * 0.92, 0, 1]);
      nozzle(B, [x, 0, 8.0], 0.78, 1.2);
      B.add(G.wedge(0.16, 2.4, 2.8, 1, 0.45), "hull2", [x, 1.7, 5.6], [0, 0, -s * 0.18]);
      B.decal(4, [x + s * 0.2 * Math.cos(0.18) + s * 0.03, 1.75, 5.9], [0, s * Math.PI / 2, -s * 0.18], [1.6, 1.3]);
      gun(B, [x, -0.95, -5.6], 2.8, 0.18); intake(B, [x, 0.9, -3.2], 1.0, 0.45, 1.2);
      missile(B, [s * 2.2, -1.0, 1.4], 2.6, 0.2); missile(B, [s * 5.6, -0.8, 2.4], 2.4, 0.18);
      B.decal(0, [s * 5.2, -0.15, 3.0], [-Math.PI / 2, 0, 0], [1.5, 1.5]);
      rcs(B, [s * 6.4, -0.25, 4.6], 1); runLight(B, [s * 6.65, -0.25, 3.9], s < 0 ? "lightR" : "lightG");
    }
    const num = SIDE(); B.decal(num, [1.62, 0.5, -1.2], [0, Math.PI / 2, 0], [1.1, 1.1]); B.decal(num, [-1.62, 0.5, -1.2], [0, -Math.PI / 2, 0], [1.1, 1.1]);
    B.decal(1, [0, 1.46, 2.0], [-Math.PI / 2, 0, 0], [1.6, 0.8]); B.decal(3, [2.6, -0.17, 1.0], [-Math.PI / 2, 0, 0], [1.2, 0.55]); B.decal(17, [0, 1.47, -1.9], [-Math.PI / 2, 0, 0], [1.2, 0.35]);
    gun(B, [1.4, -0.65, -6.4], 2.4, 0.15); gun(B, [-1.4, -0.65, -6.4], 2.4, 0.15);
    antenna(B, [0.5, 1.45, 3.2], 0.8); antenna(B, [-0.5, 1.45, 3.4], 0.5, "lightR");
    const g = B.build();
    return { obj: g, eng: addEngines(g, [[-3.9, 0, 8.9], [3.9, 0, 8.9]], 0x8ad0ff, 5), guns: [[-3.9, -0.95, -7.0], [3.9, -0.95, -7.0], [-1.4, -0.65, -7.6], [1.4, -0.65, -7.6]] };
  },
  warden() {
    // heavy fighter: armoured wedge, gull wings with gun pods, twin heavy engines, dorsal sensor
    const B = new Builder("concord", 0);
    B.add(loft([{ z: -9, w: 0.4, h: 0.3, y: -0.3 }, { z: -7.6, w: 2.6, h: 1.4, y: 0, n: 4 }, { z: -3, w: 4.6, h: 2.8, y: 0.4, n: 5, bot: 0.8 }, { z: 2, w: 5.4, h: 3.0, y: 0.3, n: 5.5 }, { z: 6.6, w: 5.4, h: 2.8, y: 0.2, n: 6 }, { z: 7.6, w: 4.8, h: 2.4, y: 0.2, n: 6 }]), "hull");
    canopy(B, [0, 1.75, -4.4], [1.0, 0.66, 1.9], 4);
    for (let i = 0; i < 5; i++) B.mirror(G.box(1.2, 0.18, 1.4), "hull2", [1.6, 1.82, -1.6 + i * 1.7], [0, 0, -0.08]);   // armour scales
    for (const s of [-1, 1]) {
      B.side(s, G.plate([[0, -1.2], [5.6, 0.4], [6.6, 3.8], [0, 4.6]], 0.5), "hull2", [2.5, -0.3, 0.6], [0, 0, 0.12]);
      if (s > 0) {} 
      B.add(loft([{ z: -4.8, w: 0.4, h: 0.4, x: s * 9.2, y: 0.5 }, { z: -3.6, w: 1.5, h: 1.5, x: s * 9.2, y: 0.5, n: 4 }, { z: 4.8, w: 1.7, h: 1.6, x: s * 9.2, y: 0.5, n: 4 }, { z: 5.6, w: 1.2, h: 1.1, x: s * 9.2, y: 0.5, n: 4 }]), "hull");
      gun(B, [s * 9.2, 0.5, -4.8], 3.2, 0.22);
      B.decal(2, [s * 9.2, 1.26, 1.4], [-Math.PI / 2, 0, 0], [1.4, 0.5]);
      nozzle(B, [s * 1.6, 0.1, 8.4], 1.05, 1.5);
      gun(B, [s * 2.4, -1.15, -6.4], 2.8, 0.2);
      B.add(G.wedge(0.2, 2.8, 3.2, 1, 0.5), "hull2", [s * 2.8, 2.6, 5.6], [0, 0, -s * 0.28]);
      B.decal(4, [s * 2.95, 2.6, 5.9], [0, s * Math.PI / 2, -s * 0.28], [1.8, 1.5]);
      missile(B, [s * 5.4, -0.95, 1.8], 2.8, 0.22); missile(B, [s * 6.6, -0.9, 2.6], 2.8, 0.22);
      intake(B, [s * 2.35, 0.2, -3.2], 0.6, 1.4, 2.2);
      B.decal(0, [s * 5.8, 0.4, 2.6], [-Math.PI / 2 + 0.0, 0, s * 0.12], [1.8, 1.8]);
      rcs(B, [s * 2.6, 1.2, -7.0], -1); runLight(B, [s * 10.05, 0.5, 2.0], s < 0 ? "lightR" : "lightG");
    }
    B.add(G.sph(0.7, 16, 10), "dark", [0, 2.0, 1.6], [0, 0, 0], [1, 0.6, 1.4]); antenna(B, [0, 2.3, 1.6], 0.9);
    const num = SIDE(); B.decal(num, [2.72, 0.6, -2.2], [0, Math.PI / 2 + 0.1, 0], [1.3, 1.3]); B.decal(num, [-2.72, 0.6, -2.2], [0, -Math.PI / 2 - 0.1, 0], [1.3, 1.3]);
    B.decal(16, [0, 1.86, -2.4], [-Math.PI / 2, 0, 0], [1.2, 0.9]);
    const g = B.build();
    return { obj: g, eng: addEngines(g, [[-1.6, 0.1, 9.4], [1.6, 0.1, 9.4]], 0x8ad0ff, 6.5), guns: [[-9.2, 0.5, -6.4], [9.2, 0.5, -6.4], [-2.4, -1.15, -7.8], [2.4, -1.15, -7.8]] };
  },
  longbow() {
    // torpedo bomber: long armoured fuselage, tail gunner turret, slung torpedo, big straight wings
    const B = new Builder("concord", 0);
    B.add(loft([{ z: -13.4, w: 0.3, h: 0.3, y: 0 }, { z: -11.6, w: 2.4, h: 2.0, y: 0.2 }, { z: -7, w: 4.2, h: 3.6, y: 0.7, n: 3.4, bot: 0.7 }, { z: 2, w: 5.0, h: 3.8, y: 0.7, n: 4.2, bot: 0.7 }, { z: 9, w: 4.4, h: 3.2, y: 0.6, n: 4.2 }, { z: 11.4, w: 2.6, h: 2.2, y: 0.6, n: 3 }]), "hull");
    canopy(B, [0, 2.55, -7.4], [1.15, 0.7, 2.3], 4);
    canopy(B, [0, 2.2, 8.6], [0.9, 0.75, 0.95], 2);
    B.add(G.cyl(0.13, 0.13, 2.4, 8), "metal", [0.28, 2.6, 10.2], [Math.PI / 2 - 0.25, 0, 0]); B.add(G.cyl(0.13, 0.13, 2.4, 8), "metal", [-0.28, 2.6, 10.2], [Math.PI / 2 - 0.25, 0, 0]);
    for (const s of [-1, 1]) {
      B.side(s, G.plate([[0, -2.8], [9.2, 1.6], [10.4, 5.4], [0, 6.6]], 0.62), "hull2", [2.4, 0, 0]);
      B.add(loft([{ z: 6.6, w: 2.4, h: 2.2, x: s * 3.4, y: 0.25 }, { z: 9, w: 2.9, h: 2.7, x: s * 3.4, y: 0.25, n: 3 }, { z: 11.6, w: 2.8, h: 2.6, x: s * 3.4, y: 0.25, n: 3 }]), "hull");
      nozzle(B, [s * 3.4, 0.25, 12.3], 1.2, 1.6);
      B.add(G.wedge(0.24, 3.6, 3.4, 1, 0.45), "hull2", [s * 8.9, 1.9, 5.8], [0, 0, -s * 0.06]);
      B.decal(4, [s * 9.03, 1.9, 6.1], [0, s * Math.PI / 2, 0], [2.2, 1.9]);
      gun(B, [s * 1.6, -0.5, -12.0], 3.0, 0.22);
      missile(B, [s * 6.2, -0.6, 1.4], 3.0, 0.26); missile(B, [s * 7.6, -0.6, 2.2], 3.0, 0.26);
      B.decal(0, [s * 6.6, 0.35, 3.0], [-Math.PI / 2, 0, 0], [2.2, 2.2]);
      runLight(B, [s * 11.6, 0.3, 4.5], s < 0 ? "lightR" : "lightG"); rcs(B, [s * 2.3, 1.3, -10.2], -1);
      intake(B, [s * 2.55, 0.9, -4.0], 0.7, 1.6, 2.4);
    }
    // the torpedo
    B.add(G.cyl(0.85, 0.85, 7.5, 16), "metal", [0, -2.1, -1.2], [Math.PI / 2, 0, 0]); B.add(G.cone(0.85, 2.2, 16), "red", [0, -2.1, -6.0], [-Math.PI / 2, 0, 0]);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; B.add(G.box(0.1, 1.9, 1.4), "dark", [Math.cos(a) * 0.85, -2.1 + Math.sin(a) * 0.85, 2.4], [0, 0, a]); }
    B.add(G.box(1.2, 0.8, 5), "dark", [0, -1.25, -1]); B.decal(2, [0, -2.96, -0.6], [Math.PI / 2, 0, 0], [1.2, 3]);
    const num = SIDE(); B.decal(num, [2.52, 0.9, -6.4], [0, Math.PI / 2 + 0.1, 0], [1.6, 1.6]); B.decal(num, [-2.52, 0.9, -6.4], [0, -Math.PI / 2 - 0.1, 0], [1.6, 1.6]);
    B.decal(7, [2.6, 1.0, 2.6], [0, Math.PI / 2, 0], [1.6, 0.9]); B.decal(7, [-2.6, 1.0, 2.6], [0, -Math.PI / 2, 0], [1.6, 0.9]);
    antenna(B, [0, 2.6, -1.4], 1.4); antenna(B, [0.6, 2.5, 3.6], 0.8, "lightR");
    const g = B.build();
    return { obj: g, eng: addEngines(g, [[-3.4, 0.25, 13.3], [3.4, 0.25, 13.3]], 0x8ad0ff, 7.5), guns: [[-1.6, -0.5, -13.5], [1.6, -0.5, -13.5], [0, -2.1, -7.2]] };
  },
  wraith() {
    // stealth strike: faceted flying wing, buried engines with slot exhausts, canted fins, glowing seams
    const B = new Builder("concord", 0);
    B.add(G.plate([[0, -10.4], [3.2, -4], [9.4, 5.2], [6.4, 6.0], [3.4, 4.6], [0, 6.8], [-3.4, 4.6], [-6.4, 6.0], [-9.4, 5.2], [-3.2, -4]], 0.7), "dark", [0, -0.4, 0], [0, 0, 0], [1, 1, 1], true);
    B.add(G.wedge(3.2, 1.9, 13.4, 0.15, 0.25), "dark", [0, 0.55, -1.2], [0, 0, 0], [1, 1, 1], true);
    B.add(G.wedge(5.6, 0.9, 6, 0.6, 0.6), "dark", [0, 0.5, 3.2], [0, 0, 0], [1, 1, 1], true);
    canopy(B, [0, 1.2, -3.6], [0.72, 0.5, 2.2], 2);
    for (const s of [-1, 1]) {
      B.add(G.box(0.22, 2.4, 3.2), "dark", [s * 3.6, 1.4, 4.1], [0, 0, -s * 0.55], [1, 1, 1], true);
      B.add(G.box(2.2, 0.34, 0.6), "glow", [s * 1.7, 0.1, 5.93]); B.add(G.box(2.4, 0.08, 0.9), "metal", [s * 1.7, 0.3, 5.7]);
      B.add(G.box(0.05, 0.04, 9), "glow", [s * 3.6, -0.02, -0.6], [0, s * 0.42, 0]);                         // light seams
      B.add(G.box(0.04, 0.04, 6.4), "glow", [s * 6.5, -0.02, 2.8], [0, s * 1.05, 0]);
      gun(B, [s * 2.4, -0.55, -4.4], 2.4, 0.13); gun(B, [s * 5.2, -0.45, 0.6], 2.4, 0.13);
      B.decal(26, [s * 5.4, 0.0, 3.4], [-Math.PI / 2, 0, 0], [1.4, 1.4]);
    }
    for (let i = 0; i < 6; i++) B.mirror(G.box(0.6, 0.06, 0.6), "metal", [1.2 + i * 1.2, -0.02, -2 + i * 1.3], [0, 0.4, 0]);
    B.decal(3, [1.2, 0.06, 1.0], [-Math.PI / 2, 0, 0], [1.0, 0.45]);
    B.m.dark.color.set(0x23262c);
    const g = B.build();
    return { obj: g, eng: addEngines(g, [[-1.6, 0.1, 6.3], [1.6, 0.1, 6.3]], 0x70b0ff, 4), guns: [[-2.4, -0.55, -5.6], [2.4, -0.55, -5.6], [-5.2, -0.45, -0.6], [5.2, -0.45, -0.6]] };
  },
  // ---------------- Vharr: organic, swept, bone and lacquer, clan glyphs and kill tallies
  skrel() {
    const B = new Builder("vharr", 0);
    B.add(loft([{ z: -3.6, w: 0.3, h: 0.3 }, { z: -2.6, w: 2.4, h: 2.0, y: 0.2 }, { z: 0, w: 4.2, h: 3.4, y: 0.3, bot: 0.8 }, { z: 2.4, w: 3.6, h: 2.8, y: 0.2 }, { z: 3.6, w: 2.2, h: 1.8 }]), "hull");
    canopy(B, [0, 1.2, -1.4], [0.9, 0.75, 1.1], 0);
    for (const s of [-1, 1]) {
      B.add(loft([{ z: 0.6, w: 1.4, h: 1.2, x: s * 2.2 }, { z: -3, w: 1.1, h: 1.0, x: s * 3.3 }, { z: -6.6, w: 0.7, h: 0.6, x: s * 3.7 }, { z: -9.2, w: 0.08, h: 0.08, x: s * 3.4, y: -0.2 }]), "hull2");    // mandibles
      for (let i = 0; i < 4; i++) B.add(G.cone(0.16, 0.9, 5), "bone", [s * (3.0 + i * 0.18), 0.55, -1.8 - i * 1.4], [0, 0, s * -0.4]);
      gun(B, [s * 3.5, -0.4, -7.0], 1.8, 0.12);
      B.add(G.box(0.2, 1.6, 1.6), "bone", [s * 1.9, 1.4, 1.6], [0, 0, -s * 0.5]);
      B.decal(24 + (s > 0 ? 0 : 1), [s * 2.08, 0.35, 0.2], [0, s * Math.PI / 2, 0], [1.2, 1.2]);
    }
    B.decal(28, [0, 1.7, 0.8], [-Math.PI / 2 + 0.3, 0, 0], [1.6, 0.9]);
    nozzle(B, [0, 0.1, 4.2], 0.9, 1.2, 1.25);
    const g = B.build();
    return { obj: g, eng: addEngines(g, [[0, 0.1, 5.0]], 0xff8a30, 5), guns: [[-3.5, -0.4, -7.9], [3.5, -0.4, -7.9]] };
  },
  dhakar() {
    const B = new Builder("vharr", 0);
    const pts = []; for (let i = 0; i <= 26; i++) { const a = Math.PI * (0.06 + 0.88 * i / 26); pts.push([Math.cos(a) * 9.2, -Math.sin(a) * 9.2 + 6.2]); }
    for (let i = 26; i >= 0; i--) { const a = Math.PI * (0.06 + 0.88 * i / 26); pts.push([Math.cos(a) * 6.6, -Math.sin(a) * 6.6 + 6.2 + Math.sin(a * 2) * 0.4]); }
    B.add(G.plate(pts, 0.7), "hull2", [0, -0.35, 0]);
    B.add(loft([{ z: -5.2, w: 0.1, h: 0.1 }, { z: -3.4, w: 2.0, h: 1.6, y: 0.1 }, { z: 0, w: 3.4, h: 2.6, y: 0.3, bot: 0.8 }, { z: 3.2, w: 3.0, h: 2.2, y: 0.2 }, { z: 4.6, w: 1.8, h: 1.5 }]), "hull");
    canopy(B, [0, 1.05, -1.8], [0.85, 0.65, 1.3], 0);
    for (const s of [-1, 1]) {
      B.add(G.cone(0.42, 3.2, 6), "bone", [s * 8.6, -0.1, 4.6], [-Math.PI / 2 - 0.55, 0, 0]);
      for (let i = 0; i < 5; i++) { const a = Math.PI * (0.18 + i * 0.06) * 1; B.add(G.cone(0.2, 1.3, 5), "bone", [s * Math.cos(a) * 8.0, 0.3, -Math.sin(a) * 8.0 + 6.2], [0.3, 0, 0]); }
      gun(B, [s * 4.0, -0.15, -2.6], 2.2, 0.14);
      B.decal(27, [s * 6.6, 0.02, 0.4], [-Math.PI / 2, 0, s * 0.6], [1.8, 1.8]);
    }
    gun(B, [0, -1.05, -4.6], 2.0, 0.14);
    B.decal(30, [0, 1.62, 1.2], [-Math.PI / 2 + 0.15, 0, 0], [2.2, 1.4]); B.decal(29, [1.7, 0.4, 1.6], [0, Math.PI / 2, 0], [1.2, 1.2]);
    nozzle(B, [0, 0.1, 5.0], 0.75, 1.0, 1.25);
    const g = B.build();
    return { obj: g, eng: addEngines(g, [[0, 0.1, 5.7]], 0xff8a30, 5.5), guns: [[-4, -0.15, -3.7], [4, -0.15, -3.7], [0, -1.05, -5.6]] };
  },
  krosk() {
    const B = new Builder("vharr", 0);
    B.add(loft([{ z: -8.2, w: 8.6, h: 1.0, y: 0, n: 3 }, { z: -6.6, w: 9.4, h: 2.4, y: 0.1, n: 3.5 }, { z: -4.6, w: 6.0, h: 2.6, y: 0.3, n: 3 }, { z: -1, w: 4.4, h: 3.4, y: 0.4, bot: 0.8 }, { z: 5, w: 4.8, h: 3.0, y: 0.3, n: 3.4 }, { z: 8.6, w: 4.2, h: 2.4, n: 3.6 }]), "hull");
    canopy(B, [0, 1.95, -3.0], [1.0, 0.62, 1.5], 0);
    for (const s of [-1, 1]) {
      B.add(G.cone(0.6, 3.6, 6), "bone", [s * 4.4, -0.5, -9.4], [-Math.PI / 2, 0, s * 0.12]); B.add(G.cone(0.5, 3.0, 6), "bone", [s * 2.6, -0.7, -9.1], [-Math.PI / 2, 0, s * 0.1]);
      B.side(s, G.plate([[0, -1], [5.2, 2], [5.6, 4.2], [0, 5.4]], 0.5), "hull2", [2.2, -0.5, 1.0], [0, 0, -0.08]);
      for (let i = 0; i < 4; i++) B.add(G.cone(0.18, 1.1, 5), "bone", [s * (2.6 + i * 0.9), 0.0, 1.4 + i * 0.6], [0.2, 0, 0]);
      nozzle(B, [s * 1.6, 0.1, 9.2], 1.0, 1.3, 1.2);
      gun(B, [s * 3.4, 0.7, -7.6], 2.6, 0.2); gun(B, [s * 4.4, -0.55, -8.2], 2.4, 0.18);
      B.decal(25, [s * 2.42, 0.6, 2.4], [0, s * Math.PI / 2 + s * 0.08, 0], [1.6, 1.6]);
      B.decal(29, [s * 3.4, 1.42, -6.4], [-Math.PI / 2, 0, 0], [1.4, 0.9]);
    }
    B.decal(28, [0, 2.12, 2.6], [-Math.PI / 2 + 0.1, 0, 0], [2.0, 1.2]);
    const g = B.build();
    return { obj: g, eng: addEngines(g, [[-1.6, 0.1, 10.2], [1.6, 0.1, 10.2]], 0xff8a30, 6), guns: [[-3.4, 0.7, -8.9], [3.4, 0.7, -8.9], [-4.4, -0.55, -9.4], [4.4, -0.55, -9.4]] };
  },
  vhaal(variant) {
    const B = new Builder("vharr", 0);
    const body = variant === "white" ? "white" : variant === "crown" ? "red" : "hull";
    B.add(loft([{ z: -10.2, w: 0.05, h: 0.05 }, { z: -6, w: 1.2, h: 1.0, y: 0.05 }, { z: -1.6, w: 1.9, h: 1.7, y: 0.2, bot: 0.8 }, { z: 3, w: 2.1, h: 1.6, y: 0.1 }, { z: 6.0, w: 1.8, h: 1.4 }]), body);
    canopy(B, [0, 0.95, -2.6], [0.72, 0.6, 1.7], 0);
    for (const s of [-1, 1]) {
      B.side(s, G.plate([[0, 3.2], [7, -3.2], [7.7, -2.4], [6.0, 0.6], [0.6, 5.6]], 0.32), variant === "crown" ? "bone" : "hull2", [0.6, -0.2, 0]);
      if (s < 0) {}
      B.add(G.cone(0.32, 2.8, 6), "bone", [s * 7.7, -0.2, -4.0], [-Math.PI / 2, 0, 0]);
      B.add(G.box(0.16, 2.2, 2.4), variant === "crown" ? "bone" : "hull2", [s * 1.0, 1.2, 4.4], [0, 0, -s * 0.35]);
      gun(B, [s * 7.0, -0.2, -2.8], 2.0, 0.13);
      B.decal(variant === "white" ? 29 : 24 + (s > 0 ? 2 : 0), [s * 4.4, 0.1, 0.6], [-Math.PI / 2, 0, s * 0.5], [1.6, 1.6]);
    }
    gun(B, [0, -0.7, -8.2], 1.8, 0.12);
    if (variant === "crown") { for (let i = 0; i < 7; i++) B.add(G.cone(0.22, 1.9 - Math.abs(i - 3) * 0.3, 5), "bone", [(i - 3) * 0.32, 1.25, 1.2 + Math.abs(i - 3) * 0.35], [0.4, 0, 0]); B.decal(28, [0, 1.0, 3.2], [-Math.PI / 2 + 0.2, 0, 0], [1.8, 1.0]); }
    if (variant === "white") { for (let i = 0; i < 8; i++) B.mirror(G.box(0.05, 0.42, 0.18), "dark", [1.8 + i * 0.62, 0.15, 1.2 - i * 0.55]); }   // the Graven's kill stripes
    nozzle(B, [0, 0, 6.4], 0.72, 1.0, 1.2);
    const g = B.build();
    return { obj: g, eng: addEngines(g, [[0, 0, 7.1]], variant === "white" ? 0x9ae0ff : 0xff8a30, 5), guns: [[-7, -0.2, -3.8], [7, -0.2, -3.8], [0, -0.7, -9.1]] };
  },
  gorrak() {
    const B = new Builder("vharr", 0);
    B.add(loft([{ z: -9.6, w: 0.3, h: 0.3 }, { z: -7.4, w: 4.0, h: 3.0, y: 0.3 }, { z: -2, w: 8.4, h: 5.4, y: 0.6, bot: 0.75 }, { z: 4, w: 8.0, h: 5.0, y: 0.5, n: 3 }, { z: 8.4, w: 5.0, h: 3.4, n: 3 }, { z: 9.6, w: 3.6, h: 2.6, n: 3 }]), "hull");
    canopy(B, [0, 2.9, -5.4], [1.0, 0.65, 1.6], 0);
    B.add(G.sph(1.2, 18, 12), "dark", [0, 3.4, 2.0], [0, 0, 0], [1, 0.8, 1]); B.add(G.cyl(0.18, 0.18, 2.6, 8), "metal", [0.3, 3.8, 0.4], [Math.PI / 2, 0, 0]); B.add(G.cyl(0.18, 0.18, 2.6, 8), "metal", [-0.3, 3.8, 0.4], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) {
      B.side(s, G.plate([[0, -2], [6.2, 2.8], [6.4, 6.2], [0, 6.4]], 0.6), "hull2", [3.8, -0.6, 0]);
      B.add(G.cone(0.6, 3.2, 6), "bone", [s * 9.8, -0.4, 4.2], [-Math.PI / 2 - 0.6, 0, 0]);
      for (let i = 0; i < 6; i++) B.add(G.cone(0.22, 1.2, 5), "bone", [s * (1.2 + i * 0.1), 3.2 - i * 0.12, -1.8 + i * 1.4], [-0.3, 0, s * -0.5]);
      nozzle(B, [s * 1.7, 0.2, 9.8], 1.0, 1.3, 1.2);
      gun(B, [s * 1.4, -1.0, -9.0], 2.2, 0.16);
      B.decal(26, [s * 6.2, 0.02, 3.0], [-Math.PI / 2, 0, 0], [2.4, 2.4]);
    }
    B.add(G.cyl(0.95, 0.95, 7.4, 16), "red", [0, -3.2, -1], [Math.PI / 2, 0, 0]); B.add(G.cone(0.95, 2.0, 16), "bone", [0, -3.2, -5.7], [-Math.PI / 2, 0, 0]);
    B.add(G.box(1.4, 1.0, 5), "dark", [0, -2.2, -1]);
    B.decal(28, [0, 3.0, -2.0], [-Math.PI / 2 + 0.35, 0, 0], [2.6, 1.4]); B.decal(30, [4.12, 0.8, -1.0], [0, Math.PI / 2, 0], [2.6, 1.6]); B.decal(30, [-4.12, 0.8, -1.0], [0, -Math.PI / 2, 0], [2.6, 1.6]);
    const g = B.build();
    return { obj: g, eng: addEngines(g, [[-1.7, 0.2, 10.8], [1.7, 0.2, 10.8]], 0xff8a30, 7), guns: [[-1.4, -1, -10.1], [1.4, -1, -10.1]] };
  },
};

// ---------------------------------------------------------------- CAPITAL SHIPS
function turretMesh(fac, big = 1) {
  const m = mats(fac, 0); const t = new THREE.Group();
  const base = new THREE.Mesh(G.cyl(4 * big, 5 * big, 2.4 * big, 12), m.dark); t.add(base);
  const head = new THREE.Group(); head.position.y = 2.6 * big; t.add(head);
  const dome = new THREE.Mesh(G.sph(3.4 * big, 12, 8), m.hull2); dome.scale.set(1, 0.6, 1.2); head.add(dome);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(G.cyl(0.5 * big, 0.6 * big, 8 * big, 6), m.metal); b.rotation.x = Math.PI / 2; b.position.set(s * 1.4 * big, 0.6 * big, -5 * big); head.add(b); }
  t.userData.head = head; return t;
}
function capBuild(B, R, turretSpots, fac, big) {
  const g = B.build();
  const turrets = turretSpots.map(([x, y, z, up]) => { const t = turretMesh(fac, big); t.position.set(x, y, z); if (up < 0) t.rotation.z = Math.PI; else if (up === 2) t.rotation.z = -Math.PI / 2; else if (up === 3) t.rotation.z = Math.PI / 2; g.add(t); return t; });
  return { g, turrets };
}
const CAPS = {
  halcyon() {
    // CV-71 strike carrier, hero build: armoured flanks with strakes and window decks, full-length flight deck with
    // catapults, lifts and markings, a tiered island with radar arrays and a lattice mast, sponsons with missile cells,
    // engine block with radiators — and crisp hull lettering
    const B = new Builder("concord", 2), R = rng(11);
    const S = [{ z: -440, w: 100, h: 46, y: 4, n: 10 }, { z: -380, w: 122, h: 60, n: 16 }, { z: 300, w: 126, h: 62, n: 16 }, { z: 350, w: 116, h: 58, n: 14 }, { z: 372, w: 96, h: 50, n: 10 }];
    const half = z => secAt(S, z).w / 2;
    B.add(loft(S, 48), "hull");
    // armour strakes and the painted boot-top band
    for (const [yo, hh, mk] of [[-20, 4, "hull"], [21, 3, "hull"], [-27.5, 3.2, "accent"]]) B.add(loft(inset(S.slice(0, 4).map(s => ({ ...s, w: s.w + 1.8, h: hh, y: yo, n: 2 }))), 40), mk);
    // flank frame stiffeners (forward of the sponsons) and lit window decks
    for (let z = -360; z < 20; z += 18) { if (z > -322 && z < -68) continue; for (const sg of [-1, 1]) B.side(sg, G.box(1.0, 36, 1.4), "dark", [half(z) + 0.45, 0, z]); }
    for (const sg of [-1, 1]) for (let z = -366; z < 16; z += 18) { sideDecal(B, S, 40, sg, z + 9, 26, [15, 1.9], "lit", 0.6); sideDecal(B, S, 40, sg, z + 9, -15, [15, 1.9], "lit", 0.6); if (z > -80 || z < -320) sideDecal(B, S, 41, sg, z + 9, 4, [15, 7], "lit", 0.6); }
    // flight deck: deck slab, edge galleries and ribs, edge lights, catapults, lifts, landing lines, deck equipment
    B.add(G.box(150, 7, 650), "hull2", [0, 34, -25]);
    B.mirror(G.box(14, 4, 640), "hull", [70, 31, -25]);
    for (let z = -330; z < 290; z += 13) B.mirror(G.box(2, 3, 6), "metal", [77, 29, z]);
    for (let z = -334; z < 290; z += 13) for (const sg of [-1, 1]) { B.decal(40, [sg * 77.1, 31.2, z + 6.5], [0, sg * Math.PI / 2, 0], [8, 1.4], "lit"); B.side(sg, G.box(3, 0.4, 1), "light", [72, 28.8, z + 6.5]); }
    for (let z = -340; z < 300; z += 20) { runLight(B, [-75, 38.2, z], "lightR", 0.9); runLight(B, [75, 38.2, z], "lightG", 0.9); }
    for (let z = -330; z < 300; z += 30) B.add(G.box(2.4, 0.6, 12), "light", [0, 37.8, z]);
    for (const x of [-22, 22]) { B.add(G.box(2.4, 0.4, 230), "dark", [x, 37.6, -235]); for (let z = -345; z < -125; z += 10) for (const o of [-2.2, 2.2]) B.add(G.box(0.7, 0.3, 0.7), "light", [x + o, 37.7, z]); B.add(G.box(10, 0.3, 4), "accent", [x, 37.6, -352]); }
    for (const x of [-60, 60]) B.add(G.box(1.2, 0.12, 390), "white", [x, 37.56, 95]);
    for (const z of [180, 200, 220]) for (const x of [-30, 30]) B.add(G.box(10, 0.12, 2), "white", [x, 37.56, z]);
    for (const [lx, lz] of [[-45, 30], [20, 230]]) { for (const o of [-1, 1]) { B.add(G.box(32, 0.3, 0.8), "dark", [lx, 37.6, lz + o * 20]); B.add(G.box(0.8, 0.3, 40), "dark", [lx + o * 16, 37.6, lz]); } B.decal(2, [lx, 37.62, lz - 21.5], [-Math.PI / 2, 0, 0], [32, 2.5]); }
    for (const z of [-320, -260, -200, -140, -80, -20, 40, 100, 160, 220, 280]) { B.decal(2, [-58, 37.7, z], [-Math.PI / 2, 0, 0], [12, 30]); B.decal(2, [58, 37.7, z], [-Math.PI / 2, 0, 0], [12, 30]); }
    for (const [x, z] of [[30, 60], [36, 64], [-60, 120], [-54, 126], [24, 186], [-30, -60]]) { B.add(G.box(3, 2, 5), "accent", [x, 38.5, z]); B.add(G.box(3.2, 0.6, 1.2), "dark", [x, 38, z - 2.4]); }
    // point-defence mounts along the deck edges
    for (const z of [-300, -190, -80, 30, 140, 250]) for (const sg of [-1, 1]) { B.side(sg, G.cyl(2.2, 2.6, 1.6, 12), "dark", [72, 38.3, z]); B.side(sg, G.sph(2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), "hull2", [72, 39.1, z]); for (const o of [-0.5, 0.5]) B.side(sg, G.cyl(0.18, 0.18, 4, 6), "metal", [72 + o, 40, z - 2], [Math.PI / 2, 0, 0]); }
    // launch bay: deep mouth, framed, lit
    // launch bay: a real hollow hangar tunnel ~88 m deep, lit from within, so the depth is true from any angle
    { const Z0 = -530, Z1 = -442, ZC = (Z0 + Z1) / 2, D = Z1 - Z0, X = 50, Y0 = -12.5, Y1 = 24.5, YC = (Y0 + Y1) / 2, HT = Y1 - Y0;
      // outer skin (the old block's silhouette) and a back bulkhead
      B.add(G.box(104, 3, D), "dark", [0, Y1 + 1.6, ZC]); B.add(G.box(104, 3, D), "dark", [0, Y0 - 1.6, ZC]);
      B.mirror(G.box(3, HT + 6.2, D), "dark", [X + 1.6, YC, ZC]); B.add(G.box(104, HT + 6, 3), "dark", [0, YC, Z1 + 1.4]);
      // mouth frame
      B.add(G.box(110, 4, 6), "hull2", [0, 27, -530]); B.add(G.box(110, 4, 6), "hull2", [0, -15, -530]); B.mirror(G.box(4, 46, 6), "hull2", [54, 6, -530]);
      // self-lit interior liner: deck, overhead, walls, back wall
      B.add(G.box(2 * X, 0.4, D), "bayIn", [0, Y0 + 0.2, ZC]); B.add(G.box(2 * X, 0.4, D), "bayIn", [0, Y1 - 0.2, ZC]);
      B.mirror(G.box(0.4, HT, D), "bayIn", [X - 0.2, YC, ZC]); B.add(G.box(2 * X, HT, 0.4), "bayIn", [0, YC, Z1 - 0.3]);
      // structural frames marching back into the ship: the strongest depth cue
      for (let z = Z0 + 8; z < Z1 - 4; z += 11) { B.mirror(G.box(2.2, HT, 2), "dark", [X - 1.2, YC, z]); B.add(G.box(2 * X, 2.2, 2), "dark", [0, Y1 - 1.3, z]);
        B.mirror(G.box(1.4, 3, 1.4), "accent", [X - 2.4, Y0 + 1.6, z]); }
      // overhead light panels in three rows, and gallery windows high on each wall
      for (let z = Z0 + 13.5; z < Z1 - 4; z += 11) { for (const x of [-30, 30]) B.add(G.box(10, 0.3, 3), "bayLt", [x, Y1 - 0.6, z]);
        B.mirror(G.box(0.3, 1.8, 5), "bayLt", [X - 0.5, Y1 - 5, z]); B.mirror(G.box(0.3, 0.3, 6), "lightR", [X - 0.5, Y0 + 4, z]); }
      // deck markings: green centreline, white lane edges, amber hold-short bars
      for (let z = Z0 + 3; z < Z1 - 3; z += 6) B.add(G.box(0.9, 0.15, 3), "lightG", [0, Y0 + 0.5, z]);
      for (const x of [-34, -17, 17, 34]) B.add(G.box(0.5, 0.12, D - 4), "white", [x, Y0 + 0.45, ZC]);
      for (const z of [Z0 + 30, Z0 + 60]) B.add(G.box(2 * X - 4, 0.14, 1.2), "orange", [0, Y0 + 0.47, z]);
      // back wall: a bright lift door and control windows above it
      B.add(G.box(44, 20, 0.3), "hull2", [0, Y0 + 10.5, Z1 - 0.7]); for (let k = 0; k < 4; k++) B.add(G.box(40, 0.4, 0.3), "bayLt", [0, Y0 + 3 + k * 4.6, Z1 - 1]); B.mirror(G.box(1.2, 20, 0.4), "orange", [22.6, Y0 + 10.5, Z1 - 0.9]); B.add(G.box(48, 2, 1), "orange", [0, Y0 + 21.5, Z1 - 0.9]);
      for (const x of [-36, -26, 26, 36]) B.add(G.box(7, 3, 0.3), "bayLt", [x, Y1 - 8, Z1 - 0.7]);
      // two fighters parked in the bay, plus deck equipment
      for (const [x, z] of [[-24, Z0 + 52], [24, Z0 + 64]]) { B.add(G.box(5, 2.4, 15), "hull2", [x, Y0 + 2.2, z]); B.add(G.box(16, 0.6, 6), "hull2", [x, Y0 + 2, z + 3]);
        B.add(G.box(2.4, 1.2, 4), "glass", [x, Y0 + 3.8, z - 3]); B.add(G.box(1, 1, 0.4), "glow", [x - 1.4, Y0 + 2.2, z + 7.6]); B.add(G.box(1, 1, 0.4), "glow", [x + 1.4, Y0 + 2.2, z + 7.6]); }
      for (const [x, z] of [[-42, Z0 + 20], [40, Z0 + 38], [-40, Z0 + 76]]) B.add(G.box(4, 2.5, 6), "accent", [x, Y0 + 1.5, z]);
      // threshold lights and a faint containment field across the mouth
      for (let i = -44; i <= 44; i += 8) B.add(G.box(0.8, 0.4, 2), Math.abs(i) < 6 ? "lightG" : "bayLt", [i, Y0 + 0.5, Z0 + 2]);
      // ---- interior dressing: catwalks, pipe runs, gantry crane, racks, tie-downs, hazard lip, stencils
      for (const sg of [-1, 1]) {
        const wx = sg * (X - 2.4);
        B.add(G.box(4.4, 0.4, D - 6), "dark", [wx, Y1 - 11, ZC]); B.add(G.box(4.25, 0.25, D - 6.2), "metal", [wx, Y1 - 10.7, ZC]);   // catwalk with grating
        B.add(G.box(0.25, 0.25, D - 6), "metal", [sg * (X - 4.6), Y1 - 8.8, ZC]); B.add(G.box(0.2, 0.2, D - 6), "metal", [sg * (X - 4.6), Y1 - 9.8, ZC]);   // rails
        for (let z = Z0 + 6; z < Z1 - 3; z += 5.5) { B.add(G.box(0.25, 2.2, 0.25), "metal", [sg * (X - 4.6), Y1 - 9.8, z]); B.add(G.box(4.4, 0.4, 0.4), "dark", [wx, Y1 - 11.5, z]); }
        // pipe bundle low on the wall: coolant, fuel (orange), power, with clamps
        for (const [dy, r, mk] of [[6.2, 0.9, "hull2"], [7.8, 0.6, "orange"], [9.0, 0.55, "metal"], [10.1, 0.4, "accent"]]) B.add(G.cyl(r, r, D - 4, 10), mk, [sg * (X - 1.6), Y0 + dy, ZC], [Math.PI / 2, 0, 0]);
        for (let z = Z0 + 5; z < Z1 - 3; z += 5.5) B.add(G.box(1.6, 5, 0.6), "dark", [sg * (X - 1.2), Y0 + 8.2, z]);
        // recessed wall panels and equipment racks with status lamps between the frames
        for (let z = Z0 + 13.5; z < Z1 - 6; z += 11) { B.add(G.box(0.3, 4.2, 7.6), "hull", [sg * (X - 0.45), Y0 + 2.6, z]); B.add(G.box(0.3, 3.4, 7.6), "hull", [sg * (X - 0.45), Y1 - 16, z]);
          B.add(G.box(1.8, 3.2, 2.6), "hull2", [sg * (X - 1.6), Y0 + 1.8, z - 2.2]); B.add(G.box(0.15, 0.3, 0.3), (z | 0) % 2 ? "lightG" : "lightR", [sg * (X - 2.55), Y0 + 2.8, z - 2.2]);
          B.add(G.box(0.4, 1.4, 1.4), "dark", [sg * (X - 0.7), Y1 - 4, z + 3]); }   // vent grille
      }
      // overhead: gantry crane rails, crane bridge with hoist, centre cable tray, vent ducts
      for (const x of [-20, 20]) B.add(G.box(1.2, 1.6, D - 4), "dark", [x, Y1 - 2.6, ZC]);
      B.add(G.box(42, 2, 3), "orange", [0, Y1 - 4.2, Z0 + 46]); B.add(G.box(4, 2.6, 4), "dark", [6, Y1 - 6.4, Z0 + 46]); B.add(G.cyl(0.15, 0.15, 6, 6), "metal", [6, Y1 - 10.6, Z0 + 46]);
      B.add(G.box(5, 0.9, D - 4), "dark", [0, Y1 - 1.2, ZC]); for (let z = Z0 + 4; z < Z1 - 2; z += 2.2) B.add(G.box(5.2, 0.25, 0.3), "metal", [0, Y1 - 1.7, z]);
      for (const x of [-38, 38]) B.add(G.cyl(1.4, 1.4, D - 4, 12), "hull2", [x, Y1 - 2, ZC], [Math.PI / 2, 0, 0]);
      // deck: tie-down grid, mouth hazard lip, arming carts and a tow tractor
      for (let x = -42; x <= 42; x += 7) for (let z = Z0 + 6; z < Z1 - 4; z += 7) B.add(G.box(0.7, 0.1, 0.7), "dark", [x, Y0 + 0.42, z]);
      for (let x = -48; x < 48; x += 4) B.add(G.box(2, 0.12, 1.4), (x / 4) % 2 ? "orange" : "dark", [x + 1, Y0 + 0.46, Z0 + 4.5]);
      for (const [x, z] of [[-8, Z0 + 28], [10, Z0 + 72]]) { B.add(G.box(3, 1.2, 5), "orange", [x, Y0 + 1.1, z]); for (const o of [-1.6, 1.6]) B.add(G.cyl(0.5, 0.5, 0.4, 8), "dark", [x + o, Y0 + 0.7, z + 1.6], [0, 0, Math.PI / 2]); B.add(G.cyl(0.35, 0.35, 4, 8), "white", [x, Y0 + 2, z]); B.add(G.cyl(0.35, 0.35, 4, 8), "white", [x, Y0 + 2, z]); }
      B.add(G.box(3.4, 1.8, 5), "accent", [30, Y0 + 1.3, Z0 + 22]); B.add(G.box(2.6, 1.2, 1.6), "glass", [30, Y0 + 2.6, Z0 + 21]);
      // stencils: bay name over the lift door, hull number on each wall by the mouth
      B.extra.push(letterMesh(letterTex("LAUNCH BAY 1"), 30, 4, [0, Y1 - 7.2, Z1 - 1.0], [0, Math.PI, 0]));
      B.extra.push(letterMesh(letterTex("CV-71", 1024, 320), 8, 2.5, [X - 0.6, YC + 1, Z0 + 24.5], [0, -Math.PI / 2, 0]), letterMesh(letterTex("CV-71", 1024, 320), 8, 2.5, [-X + 0.6, YC + 1, Z0 + 24.5], [0, Math.PI / 2, 0]));
      const ff = new THREE.Mesh(new THREE.PlaneGeometry(100, 37), new THREE.MeshBasicMaterial({ color: 0x4aa0ff, transparent: true, opacity: 0.02, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); ff.position.set(0, YC, -531.5); B.extra.push(ff); }
    B.add(G.box(96, 0.6, 0.6), "bayLt", [0, 24.5, -531]); B.add(G.box(96, 0.6, 0.6), "bayLt", [0, -12.5, -531]);
    for (let i = -48; i <= 48; i += 8) B.add(G.box(3, 1.4, 0.6), i % 16 ? "lightR" : "light", [i, 29.2, -533]);
    B.add(G.sph(10, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), "white", [0, -20, -478], [Math.PI, 0, 0], [1, 0.6, 1.3]);
    // island: three tiers, bridge with wraparound glazing, primary flight control over the deck, radar faces, lattice mast
    const IX = 62;
    B.add(G.box(30, 40, 100), "hull", [IX, 57.5, 120]); B.add(G.box(28, 22, 84), "hull", [IX, 88.5, 116]); B.add(G.box(31, 1.5, 101), "dark", [IX, 77.6, 120]);
    B.add(G.box(36, 12, 56), "hull2", [IX, 105.5, 110]); B.add(G.box(37, 3.4, 57), "dark", [IX, 106.2, 110]);
    for (const sg of [-1, 1]) B.decal(40, [IX + sg * 18.6, 106.2, 110], [0, sg * Math.PI / 2, 0], [54, 3.2], "lit");
    B.decal(40, [IX, 106.2, 81.4], [0, Math.PI, 0], [34, 3.2], "lit"); B.decal(40, [IX, 106.2, 138.6], [0, 0, 0], [34, 3.2], "lit");
    B.add(G.box(20, 12, 36), "hull", [IX, 117.5, 114]);
    B.add(G.box(14, 9, 30), "hull2", [IX - 20, 96, 128]); B.decal(41, [IX - 27.1, 96, 128], [0, -Math.PI / 2, 0], [28, 7], "lit"); B.add(G.box(10, 1, 26), "dark", [IX - 22, 91, 128]);
    for (const sg of [-1, 1]) { for (let k = 0; k < 2; k++) B.decal(41, [IX + sg * 15.2, 44 + k * 7.5, 120], [0, sg * Math.PI / 2, 0], [90, 6], "lit"); for (let k = 0; k < 2; k++) B.decal(41, [IX + sg * 14.2, 83 + k * 8, 116], [0, sg * Math.PI / 2, 0], [76, 6], "lit"); }
    for (let z = 74; z < 170; z += 12) for (const sg of [-1, 1]) { B.add(G.box(1, 18.5, 1.2), "dark", [IX + sg * 15.4, 46.75, z]); B.add(G.box(1, 6, 1.2), "dark", [IX + sg * 15.4, 74.5, z]); }
    for (const [dx, dz, yaw] of [[-10, 76, -2.4], [10, 76, 2.4], [-10, 156, -0.7], [10, 156, 0.7]]) { B.add(G.box(13, 13, 1.2), "dark", [IX + dx, 90, dz], [0.25, yaw, 0]); for (let k = -1; k <= 1; k++) B.add(G.box(12.5, 0.3, 1.3), "metal", [IX + dx, 90 + k * 4, dz], [0.25, yaw, 0]); }
    for (const [lx, ly, lz] of [[IX - 4, 123.5, 118], [IX + 4, 123.5, 118], [IX - 4, 123.5, 126], [IX + 4, 123.5, 126]]) B.add(G.cyl(0.6, 0.6, 52, 6), "metal", [lx * 0.6 + IX * 0.4, ly + 26, lz * 0.6 + 122 * 0.4], [0, 0, 0]);
    for (let y = 128; y < 176; y += 8) { B.add(G.box(4.8, 0.5, 0.5), "metal", [IX, y, 119.6]); B.add(G.box(4.8, 0.5, 0.5), "metal", [IX, y, 124.4]); B.add(G.box(0.5, 0.5, 4.8), "metal", [IX - 2.4, y + 4, 122]); B.add(G.box(0.5, 0.5, 4.8), "metal", [IX + 2.4, y + 4, 122]); }
    for (const [y, w] of [[150, 22], [164, 14]]) { B.add(G.box(w, 0.8, 0.8), "metal", [IX, y, 122]); for (const o of [-1, 1]) B.add(G.cyl(0.25, 0.25, 6, 5), "metal", [IX + o * w / 2, y - 3, 122]); }
    B.add(G.sph(12, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), "white", [IX, 128, 145], [Math.PI / 2 + 0.4, 0, 0], [1, 0.35, 1]); B.add(G.cyl(0.8, 0.8, 12, 6), "metal", [IX, 131, 139], [0.4, 0, 0]);
    for (const [dx, dz] of [[-7, 100], [7, 100]]) B.add(G.sph(3.2, 14, 10), "white", [IX + dx, 125.5, dz]);
    runLight(B, [IX, 178, 122], "lightR", 1.6);
    B.extra.push(letterMesh(letterTex("71", 512, 512), 20, 20, [IX + 15.3, 65, 148], [0, Math.PI / 2, 0]), letterMesh(letterTex("71", 512, 512), 20, 20, [IX - 15.3, 65, 148], [0, -Math.PI / 2, 0]));
    // sponsons: machinery, window decks, vertical-launch cells on top, roundels
    B.mirror(G.box(40, 50, 270), "hull", [80, -20, 160]);
    for (let z = 40; z < 280; z += 22) { B.mirror(G.box(5, 30, 16), "hull2", [101.5, -22, z]); for (let k = 0; k < 6; k++) B.mirror(G.box(1, 1.6, 13), "dark", [104.1, -33 + k * 4.2, z]); B.mirror(G.box(1.2, 4, 4), "metal", [104.4, -8, z + 4]); }
    for (let z = 36; z < 286; z += 18) for (const sg of [-1, 1]) { B.decal(40, [sg * 100.2, -1.5, z + 9], [0, sg * Math.PI / 2, 0], [14, 1.8], "lit"); }
    for (let i = 0; i < 4; i++) for (let z = 92; z < 240; z += 10) for (const sg of [-1, 1]) { B.side(sg, G.box(4.4, 0.5, 4.4), "dark", [68 + i * 6.4, 5.1, z]); B.side(sg, G.box(3.6, 0.6, 3.6), "metal", [68 + i * 6.4, 5.2, z]); }
    for (let z = -330; z < 20; z += 40) { if (z > -322 && z < -68) continue; B.mirror(G.box(4, 10, 24), "dark", [63, -24, z]); }
    B.extra.push(letterMesh(texRoundel(), 34, 34, [80, -20, 24.6], [0, Math.PI, 0]), letterMesh(texRoundel(), 34, 34, [-80, -20, 24.6], [0, Math.PI, 0]));
    // hull lettering: CNS HALCYON along the flanks, 71 on the bow, 71 on the deck
    const zN = -195, xN = half(zN) + 0.65;
    B.extra.push(letterMesh(letterTex("CNS HALCYON"), 236, 31, [xN, 3, zN], [0, Math.PI / 2, 0]), letterMesh(letterTex("CNS HALCYON"), 236, 31, [-xN, 3, zN], [0, -Math.PI / 2, 0]));
    const zB = -404, xB = half(zB) + 0.7, sl = Math.atan(26 / 90 / 2);
    B.extra.push(letterMesh(letterTex("71", 512, 512), 34, 34, [xB, 4, zB], [0, Math.PI / 2 + sl, 0]), letterMesh(letterTex("71", 512, 512), 34, 34, [-xB, 4, zB], [0, -Math.PI / 2 - sl, 0]));
    B.extra.push(letterMesh(letterTex("71", 512, 512), 64, 64, [0, 37.66, -290], [-Math.PI / 2, 0, 0]));
    B.extra.push(letterMesh(letterTex("CNS HALCYON · CV-71", 2048, 256), 60, 7.5, [IX + 15.3, 65, 100], [0, Math.PI / 2, 0]), letterMesh(letterTex("CNS HALCYON · CV-71", 2048, 256), 60, 7.5, [IX - 15.3, 65, 100], [0, -Math.PI / 2, 0]));
    // main batteries: twin heavy turrets — a bow pair ahead of the flight deck, fore and aft guns on each sponson, chin guns under the bow
    heavyGun(B, 26, 29, -398, 1, 1, true);
    heavyGun(B, 82, 5, 58, 1, 1, true); heavyGun(B, 82, 5, 272, -1, 1, true);
    heavyGun(B, 30, -30.5, -372, 1, -1, true);
    // belly: hangar doors, keel, sensor blisters
    for (let z = -300; z < 260; z += 70) { B.add(G.box(80, 3, 50), "dark", [0, -31.5, z]); B.add(G.box(80, 0.5, 1), "light", [0, -33.1, z - 24]); }
    B.add(G.box(10, 8, 600), "hull2", [0, -34, -20]);
    for (const z of [-200, 0, 200]) B.mirror(G.sph(5, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), "white", [40, -31, z]);
    // engines: block, radiator fins, nozzle collars
    B.add(G.box(118, 64, 40), "dark", [0, 6, 370]);
    for (let x = -50; x <= 50; x += 7) B.add(G.box(1.2, 12, 34), "metal", [x, 44, 368]);
    for (const sg of [-1, 1]) for (let y = -18; y <= 30; y += 6) B.side(sg, G.box(10, 1.2, 34), "metal", [64, y, 368]);
    for (const [x, y] of [[-42, -10], [42, -10], [-42, 24], [42, 24]]) { nozzle(B, [x, y, 402], 17, 26); B.add(G.torus(19, 1.6, 28), "metal", [x, y, 389]); B.add(G.cyl(20, 20, 8, 28), "hull2", [x, y, 386.4], [Math.PI / 2, 0, 0]); }
    const out = capBuild(B, R, [[50, 38, -250, 1], [-50, 38, -250, 1], [-50, 38, 60, 1], [50, 38, 260, 1], [-50, 38, 260, 1], [0, -30, -300, -1], [60, -30, 0, -1], [-60, -30, 0, -1], [0, -30, 250, -1], [IX, 124, 100, 1]], "concord", 1.6);
    navLights(out.g, [-75, 34, 0], [75, 34, 0]);
    for (const p of [[IX, 179, 122], [0, 30, -534], [0, 40, 395]]) { const st = engineSprite(0xffffff, 6); st.position.set(...p); st.userData.blink = 1; out.g.add(st); }
    return { obj: out.g, turrets: out.turrets, eng: addEngines(out.g, [[-42, -10, 430], [42, -10, 430], [-42, 24, 430], [42, 24, 430]], 0x8ad0ff, 80), bay: new THREE.Vector3(0, 8, -520) };
  },
  resolute() {
    // Gladius-class destroyer: arrowhead hull with armour belt, raised spine deck, stepped command tower, twin engine nacelles
    const B = new Builder("concord", 1), R = rng(12);
    const S = [{ z: -212, w: 4, h: 3, y: -2 }, { z: -190, w: 18, h: 12, y: -2, n: 3 }, { z: -130, w: 34, h: 24, n: 4 }, { z: -40, w: 48, h: 34, n: 5 }, { z: 80, w: 54, h: 38, n: 6 }, { z: 170, w: 50, h: 34, n: 6 }, { z: 196, w: 42, h: 28, n: 5 }];
    B.add(loft(S, 32), "hull");
    B.add(loft(S.slice(2).map(s => ({ ...s, w: s.w + 3, h: s.h * 0.3, y: -s.h * 0.1 })), 32), "accent");                // armour belt
    B.add(loft(S.slice(1, 6).map(s => ({ ...s, w: s.w * 0.3, h: s.h * 0.4, y: -s.h * 0.36 }))), "hull2");             // keel
    // spine deck, command tower, bridge
    B.add(G.wedge(28, 8, 170, 0.55, 0.4), "hull2", [0, 20, 70]);
    for (let z = 0; z < 150; z += 14) { B.mirror(G.box(4, 3, 9), "dark", [12, 25, z]); B.mirror(G.box(2.4, 1.4, 7), "metal", [12, 27, z]); }
    B.add(G.wedge(22, 26, 44, 0.7, 0.75), "hull", [0, 37, 104]); B.add(G.box(30, 7, 16), "hull", [0, 52, 94]); B.add(G.box(31, 1.4, 17), "dark", [0, 48, 94]);
    B.decal(40, [0, 52, 85.9], [0, Math.PI, 0], [27, 4], "lit"); for (const s of [-1, 1]) B.decal(40, [s * 15.1, 52, 94], [0, s * Math.PI / 2, 0], [14, 3.4], "lit");
    for (let k = 0; k < 3; k++) B.decal(40, [0, 30 + k * 6, 81.7 + k * 0.6], [0, Math.PI, 0], [18, 2.4], "lit");
    B.add(G.cyl(1.4, 1.6, 26, 6), "metal", [0, 68, 100]); B.add(G.box(18, 1.2, 1.2), "metal", [0, 74, 100]); B.add(G.box(1.2, 1.2, 10), "metal", [0, 66, 100]);
    B.add(G.sph(5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), "white", [0, 57, 106], [-Math.PI / 2 - 0.3, 0, 0]); runLight(B, [0, 82, 100], "lightR", 1.2);
    // sponsons with battery turrets
    const SP = [{ z: -70, w: 4, h: 4, x: 22, y: -4 }, { z: -40, w: 16, h: 12, x: 30, y: -4, n: 3 }, { z: 130, w: 18, h: 14, x: 34, y: -4, n: 4 }, { z: 150, w: 10, h: 8, x: 33, y: -4, n: 3 }];
    B.mirror(loft(SP), "hull2"); for (let z = -30; z < 130; z += 16) B.mirror(G.box(1, 6, 10), "dark", [43.2, -4, z]);
    for (const s of [-1, 1]) { runLight(B, [s * 33, -4, -72], s > 0 ? "lightG" : "lightR", 1); for (let z = -20; z < 120; z += 40) B.decal(2, [s * 43.4, -9, z], [0, s * Math.PI / 2, 0], [10, 2]); }
    // engine nacelles
    const N = [{ z: 140, w: 18, h: 20, x: 22 }, { z: 160, w: 26, h: 28, x: 22, n: 3 }, { z: 214, w: 26, h: 28, x: 22, n: 3 }, { z: 222, w: 22, h: 24, x: 22, n: 3 }];
    B.mirror(loft(N), "hull"); B.mirror(G.torus(13.4, 1, 24), "dark", [22, 0, 186]); B.mirror(G.torus(13.4, 1, 24), "dark", [22, 0, 206]);
    for (const s of [-1, 1]) nozzle(B, [s * 22, 0, 228], 10, 12); nozzle(B, [0, 0, 200], 8, 10);
    for (const s of [-1, 1]) for (let z = 168; z < 210; z += 8) B.add(G.box(1, 10, 4), "dark", [s * 35.1, 0, z]);
    // windows, numbers, markings
    for (const s of [-1, 1]) {
      for (let z = -110; z < 150; z += 22) { sideDecal(B, S, 40, s, z, 5, [18, 2.6], "lit", 0.4); if (z > -60) sideDecal(B, S, 40, s, z + 11, -1.5, [14, 2], "lit", 1.9); }
      sideDecal(B, S, 22, s, -158, 2, [24, 24]); sideDecal(B, S, 21, s, -96, 3, [46, 46]); sideDecal(B, S, 0, s, 30, 6, [16, 16]);
      for (let z = -170; z < 140; z += 30) runLight(B, [surfX(S, s, z, -6) + s * 0.6, -6, z], s > 0 ? "lightG" : "lightR", 0.5);
    }
    topDecal(B, S, 0, 0, -150, [16, 16]); topDecal(B, S, 2, 0, -96, [8, 24]);
    // bow: sensor ring, rcs, antenna farm
    for (const s of [-1, 1]) { rcs(B, [s * surfX(S, 1, -170, 0), 0, -170], -1); B.add(G.cyl(0.5, 0.5, 16, 5), "metal", [s * 6, surfY(S, s * 6, -150) + 7, -150]); }
    B.add(G.torus(10, 1, 20), "metal", [0, -2, -194]); runLight(B, [0, -2, -213], "light", 1);
    const tt = (x, z, sg = 1) => [x, surfY(S, x, z, sg) + sg * 1.5, z, sg];
    const out = capBuild(B, R, [tt(0, -120), tt(0, -40), [34, 4.5, 40, 1], [-34, 4.5, 40, 1], tt(0, 0, -1), tt(0, 120, -1)], "concord", 1.3);
    return { obj: out.g, turrets: out.turrets, eng: addEngines(out.g, [[-22, 0, 238], [22, 0, 238], [0, 0, 208]], 0x8ad0ff, 50) };
  },
  transport() {
    // Meridian Lines bulk hauler pressed into service: crew cab, open truss spine with racked containers, engine block
    const B = new Builder("concord", 1), R = rng(13);
    const CAB = [{ z: -86, w: 8, h: 7, y: 1 }, { z: -80, w: 22, h: 19, n: 3 }, { z: -52, w: 28, h: 24, n: 4 }, { z: -42, w: 26, h: 22, n: 4 }, { z: -38, w: 16, h: 14, n: 4 }];
    B.add(loft(CAB), "hull");
    B.add(G.box(16, 6, 13), "hull2", [0, 14, -64]); B.add(G.box(17, 1, 14), "dark", [0, 11.6, -64]);
    B.decal(40, [0, 14.3, -70.6], [0, Math.PI, 0], [14, 3.4], "lit"); for (const s of [-1, 1]) B.decal(40, [s * 8.1, 14.3, -64], [0, s * Math.PI / 2, 0], [11, 3], "lit");
    for (const s of [-1, 1]) { sideDecal(B, CAB, 40, s, -66, 4, [14, 2.2], "lit"); sideDecal(B, CAB, 31, s, -60, -3, [22, 22]); sideDecal(B, CAB, 0, s, -48, 4, [6, 6]); runLight(B, [s * 14.2, 0, -52], s > 0 ? "lightG" : "lightR", 0.6); rcs(B, [s * 10, -6, -76], -1); }
    B.add(G.cyl(0.4, 0.4, 14, 5), "metal", [-4, 24, -62]); B.add(G.sph(3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), "white", [5, 17.2, -58], [-0.6, 0, 0]); runLight(B, [-4, 31, -62], "lightR", 0.5);
    B.decal(2, [0, -12.1, -60], [Math.PI / 2, 0, 0], [20, 5]);
    // spine
    B.add(G.box(5, 5, 104), "dark", [0, 0, 10]); truss(B, [0, 0, -40], [0, 0, 62], 10, 8, "metal", 0.4);
    // racked containers: four per ring, outward faces marked
    const cols = ["hull2", "accent", "red", "white", "hull2", "dark", "accent"], faces = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    for (let k = 0; k < 4; k++) {
      const z = -26 + k * 24;
      for (const [fx, fy] of faces) {
        if (R() < 0.12) continue;
        const p = [fx * 14, fy * 14, z], mk = cols[(R() * cols.length) | 0];
        B.add(G.box(14, 14, 21), mk, p);
        for (const dz of [-10.2, 10.2]) B.add(G.box(14.5, 14.5, 0.8), "dark", [p[0], p[1], z + dz]);
        for (const dz of [-5, 0, 5]) B.add(G.box(14.2, 14.2, 0.4), mk, [p[0], p[1], z + dz]);
        B.add(G.box(fx ? 6 : 3, fy ? 6 : 3, 4), "metal", [fx * 6.5, fy * 6.5, z]);               // clamp
        const rot = fy ? [fy > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0] : [0, fx * Math.PI / 2, 0], o = [fx * 7.3, fy * 7.3];
        const n = R() < 0.25 ? 2 : R() < 0.5 ? 35 : 23;
        B.decal(n, [p[0] + o[0], p[1] + o[1], z + (R() - 0.5) * 6], rot, n === 2 ? [12, 3] : [10, 10]);
      }
    }
    // engine block
    const EN = [{ z: 58, w: 22, h: 20, n: 4 }, { z: 62, w: 32, h: 28, n: 5 }, { z: 84, w: 32, h: 28, n: 5 }, { z: 88, w: 26, h: 22, n: 4 }];
    B.add(loft(EN), "hull"); B.add(G.box(33, 4, 18), "accent", [0, 0, 73]);
    nozzle(B, [0, 3, 93], 7, 10); for (const s of [-1, 1]) nozzle(B, [s * 11, -5, 92], 4.5, 7);
    for (const s of [-1, 1]) { strut(B, [s * 16, 6, 70], [s * 23, 6, 70], 0.8); radiator(B, [s * 24, 6, 72], [0, 0, Math.PI / 2], 18, 24, 7); B.add(G.cyl(4, 4, 18, 10), "white", [s * 9, -15, 72], [Math.PI / 2, 0, 0]); sideDecal(B, EN, 6, s, 74, 9, [8, 8]); }
    for (let z = 64; z < 84; z += 5) B.add(G.box(20, 1, 2.4), "dark", [0, 14.1, z]);
    runLight(B, [0, 15, 86], "light", 0.6);
    const g = B.build(); return { obj: g, turrets: [], eng: addEngines(g, [[0, 3, 100], [-11, -5, 97], [11, -5, 97]], 0x8ad0ff, 26) };
  },
  shuttle() {
    // marine assault / rescue shuttle: lifting body, wraparound windscreen, stub wings with winglets, twin engine pods
    const B = new Builder("concord", 0);
    const S = [{ z: -15.5, w: 0.6, h: 0.5, y: -0.6 }, { z: -14, w: 4, h: 3, y: -0.4 }, { z: -10, w: 7.4, h: 5.6, y: 0.1, n: 3, bot: 0.8 }, { z: -4, w: 9, h: 7, y: 0.4, n: 3.6, bot: 0.85 }, { z: 10, w: 9, h: 7, y: 0.4, n: 4, bot: 0.85 }, { z: 14, w: 7.6, h: 6, y: 0.4, n: 4 }];
    B.add(loft(S, 32), "hull");
    B.add(loft(inset(S.slice(1).map(s => ({ ...s, w: s.w + 0.25, h: s.h * 0.16, y: s.y - s.h * 0.08 })))), "accent");     // waist stripe
    // windscreen: three panes on the sloped nose, framed
    const wz = -10.6, wy = surfY(S, 0, wz) + 0.12;
    for (const [x, ry] of [[0, 0], [-1.9, 0.5], [1.9, -0.5]]) B.add(G.box(1.8, 0.1, 3.2), "glass", [x, wy - Math.abs(x) * 0.25, wz], [-0.36, ry, x * 0.12]);
    for (const x of [-0.95, 0.95]) B.add(G.box(0.14, 0.18, 3.3), "dark", [x, wy + 0.03, wz], [-0.36, 0, 0]);
    // cabin windows, door, markings
    for (const s of [-1, 1]) {
      sideDecal(B, S, 40, s, 2, 1.4, [10, 1.1], "lit", 0.03);
      B.add(G.box(0.14, 3.6, 2.8), "dark", [s * 4.5, 0.2, 6.4]); B.decal(2, [s * 4.6, -1.9, 6.4], [0, s * Math.PI / 2, 0], [2.8, 0.5]);
      sideDecal(B, S, 5, s, 0, -1.6, [6.5, 6.5], "decal", 0.03); sideDecal(B, S, SIDE(), s, -7.4, 0.6, [2.8, 2.8], "decal", 0.03);
      rcs(B, [s * 3.1, 0.4, -11.4], -1); rcs(B, [s * 3.9, 2.6, 12.6], 1);
      B.add(G.box(0.5, 0.8, 1.4), "dark", [s * 1.6, -2.6, -6]); B.add(G.box(0.3, 1.2, 0.3), "metal", [s * 1.6, -3.3, -6]); B.add(G.box(0.4, 0.2, 2.2), "metal", [s * 1.6, -3.9, -6]);
      B.add(G.box(0.5, 0.8, 1.4), "dark", [s * 3, -2.6, 8]); B.add(G.box(0.3, 1.2, 0.3), "metal", [s * 3, -3.3, 8]); B.add(G.box(0.4, 0.2, 2.6), "metal", [s * 3, -3.9, 8]);
    }
    topDecal(B, S, 0, 0, 5, [3.4, 3.4], "decal", 0.03);
    // stub wings + winglets
    B.mirror(G.plate([[0, -3], [6, 1.2], [6, 5], [0, 6]], 0.5), "hull2", [4.2, -1.8, 4]);
    B.mirror(G.wedge(0.4, 3.4, 4, 1, 0.45), "hull2", [10.15, -0.3, 8.2]);
    B.decal(4, [10.4, -0.1, 8.4], [0, Math.PI / 2, 0], [2.8, 2.6]); B.decal(4, [-10.4, -0.1, 8.4], [0, -Math.PI / 2, 0], [2.8, 2.6]);
    B.decal(0, [7.2, -1.24, 7], [-Math.PI / 2, 0, 0], [2.8, 2.8]); B.decal(0, [-7.2, -1.24, 7], [-Math.PI / 2, 0, 0], [2.8, 2.8]);
    runLight(B, [10.2, -1.6, 4.8], "lightG", 0.18); runLight(B, [-10.2, -1.6, 4.8], "lightR", 0.18);
    // engine pods
    const P = [{ z: 6, w: 2, h: 2, x: 3.4, y: 1.8 }, { z: 9, w: 3.6, h: 3.4, x: 3.4, y: 1.8, n: 2.6 }, { z: 15.4, w: 3.6, h: 3.4, x: 3.4, y: 1.8, n: 3 }];
    B.mirror(loft(P), "hull"); for (const s of [-1, 1]) { nozzle(B, [s * 3.4, 1.8, 16.6], 1.5, 2.2); intake(B, [s * 3.4, 1.8, 6.6], 2, 1.6, 1); }
    // tail fin, antenna, lights
    B.add(G.wedge(0.4, 3.2, 5, 1, 0.3), "hull2", [0, 5.2, 11]); B.decal(SIDE(), [0.25, 5.2, 11.6], [0, Math.PI / 2, 0], [1.6, 1.6]);
    antenna(B, [0, 3.9, -2], 1.2, "lightR"); runLight(B, [0, 6.8, 13], "light", 0.14);
    runLight(B, [1.2, -2.2, -11], "light", 0.22); runLight(B, [-1.2, -2.2, -11], "light", 0.22);
    const g = B.build(); return { obj: g, turrets: [], eng: addEngines(g, [[-3.4, 1.8, 18.2], [3.4, 1.8, 18.2]], 0x8ad0ff, 8) };
  },
  lifepod() {
    // civilian lifepod: white capsule, orange bands, nose hatch with porthole, beacon mast
    const B = new Builder("concord", 0);
    B.add(loft([{ z: -3.5, w: 1.6, h: 1.6 }, { z: -3.1, w: 3.4, h: 3.4 }, { z: -1.8, w: 4.4, h: 4.4 }, { z: 2.2, w: 4.6, h: 4.6, n: 2.2 }, { z: 3.3, w: 3.6, h: 3.6 }], 24), "white");
    for (const z of [-1.2, 1.7]) { B.add(G.cyl(2.34, 2.34, 0.55, 28), "orange", [0, 0, z], [Math.PI / 2, 0, 0]); B.add(G.cyl(2.38, 2.38, 0.08, 28), "dark", [0, 0, z + 0.3], [Math.PI / 2, 0, 0]); }
    B.add(G.torus(1.25, 0.14, 20), "dark", [0, 0, -3.35]); B.add(G.cyl(0.7, 0.7, 0.12, 14), "glass", [0, 0, -3.55], [Math.PI / 2, 0, 0]);
    for (const a of [0.6, 2.5, 4.4]) B.add(G.cyl(0.32, 0.32, 0.12, 10), "glass", [Math.cos(a) * 2.24, Math.sin(a) * 2.24, 0.2], [0, 0, a + Math.PI / 2]);
    B.add(G.lathe([[0.5, 0], [0.7, 0.5], [0.95, 1.1], [0.85, 1.12]], 14), "dark", [0, 0, 3.2], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; B.add(G.box(0.36, 0.36, 0.36), "dark", [Math.cos(a) * 1.9, Math.sin(a) * 1.9, 2.8]); }
    for (const s of [-1, 1]) { B.decal(5, [s * 2.36, -0.9, 0.25], [0, s * Math.PI / 2, 0], [2.1, 2.1]); B.add(G.box(0.12, 0.12, 1.6), "metal", [s * 1.6, -1.7, -0.4]); }
    B.decal(2, [0, 2.28, -0.3], [-Math.PI / 2, 0, 0], [2.2, 0.5]);
    B.add(G.cyl(0.05, 0.05, 1.6, 5), "metal", [0, 3, 0.6]); runLight(B, [0, 3.8, 0.6], "lightR", 0.16);
    const g = B.build(); const b = engineSprite(0xff3030, 4); b.position.set(0, 3.8, 0.6); b.userData.blink = 1; g.add(b); return { obj: g, turrets: [], eng: [] };
  },
  lodestar() {
    // GRAVESEND siege platform: a kilometre-long mass-accelerator barrel in coil windings, capacitor halos, reactor stern
    const B = new Builder("concord", 1), R = rng(14);
    B.add(G.cyl(26, 26, 960, 24), "dark", [0, 0, -80], [Math.PI / 2, 0, 0]);
    for (let k = 0, z = -536; z < 392; z += 30, k++) { B.add(G.torus(31, 4.5, 20), k % 3 ? "metal" : "accent", [0, 0, z]); if (k % 2) B.add(G.torus(28, 1.2, 20), "glow", [0, 0, z + 15]); }
    // turret collars and rails
    for (const z of [-400, -140, 120, 380]) { B.add(G.cyl(44, 44, 34, 28), "hull", [0, 0, z], [Math.PI / 2, 0, 0]); B.add(G.torus(44, 1.6, 28), "dark", [0, 0, z - 17]); B.add(G.torus(44, 1.6, 28), "dark", [0, 0, z + 17]); }
    for (let a = 0; a < 6; a++) {
      const an = a * Math.PI / 3 + Math.PI / 12, c = Math.cos(an), s = Math.sin(an);
      B.add(G.box(8, 8, 920), "hull2", [c * 50, s * 50, -80], [0, 0, an]);
      for (let z = -520; z < 400; z += 60) B.add(G.box(6, 14, 4), "metal", [c * 42, s * 42, z], [0, 0, an + Math.PI / 2]);
      B.add(G.cyl(2.4, 2.4, 900, 6), "metal", [Math.cos(an + 0.24) * 37, Math.sin(an + 0.24) * 37, -80], [Math.PI / 2, 0, 0]);
    }
    // muzzle
    B.add(G.lathe([[26, 0], [38, 10], [52, 34], [58, 46], [48, 48], [30, 42], [26, 30]], 28), "hull", [0, 0, -556], [-Math.PI / 2, 0, 0]);
    B.add(G.torus(30, 3, 28), "glow", [0, 0, -596]); B.add(G.cyl(24, 24, 4, 24), "glow", [0, 0, -578], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; B.add(G.box(8, 6, 40), "dark", [Math.cos(a) * 46, Math.sin(a) * 46, -570], [0, 0, a]); runLight(B, [Math.cos(a) * 58, Math.sin(a) * 58, -602], "lightR", 1.6); }
    // capacitor halos on spokes
    for (let i = 0; i < 5; i++) {
      const z = -420 + i * 200;
      B.add(G.torus(110, 10, 48), i % 2 ? "hull2" : "hull", [0, 0, z]); B.add(G.torus(110, 2.2, 48), "glow", [0, 0, z - 10]);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; B.add(G.box(20, 26, 30), "dark", [Math.cos(a) * 110, Math.sin(a) * 110, z], [0, 0, a]); B.add(G.box(16, 2, 31), "light", [Math.cos(a) * 110, Math.sin(a) * 110, z], [0, 0, a + Math.PI / 2]); }
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; strut(B, [Math.cos(a) * 44, Math.sin(a) * 44, z], [Math.cos(a) * 101, Math.sin(a) * 101, z], 5, "hull2", 8); }
      runLight(B, [-122, 0, z], "lightR", 2.2); runLight(B, [122, 0, z], "lightG", 2.2);
    }
    // reactor stern
    const ST = [{ z: 396, w: 70, h: 60, n: 4 }, { z: 420, w: 150, h: 112, n: 5 }, { z: 522, w: 150, h: 112, n: 5 }, { z: 548, w: 120, h: 90, n: 4 }];
    B.add(loft(ST, 32), "hull");
    B.add(loft(inset(ST.map(s => ({ ...s, w: s.w + 4, h: s.h * 0.2 })))), "accent");
    for (const [x, y] of [[-36, -24], [36, -24], [-36, 24], [36, 24]]) nozzle(B, [x, y, 560], 20, 28);
    B.add(G.wedge(46, 40, 70, 0.7, 0.7), "hull2", [0, 72, 470]); B.add(G.box(54, 10, 26), "hull", [0, 96, 458]);
    B.decal(40, [0, 96.3, 444.8], [0, Math.PI, 0], [48, 6], "lit"); for (let k = 0; k < 3; k++) B.decal(41, [0, 64 + k * 10, 434.4 + k * 1.6], [0, Math.PI, 0], [34, 8], "lit");
    B.add(G.cyl(2.4, 2.4, 50, 6), "metal", [0, 126, 470]); B.add(G.sph(14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), "white", [0, 104, 490], [-Math.PI / 2 - 0.5, 0, 0]); runLight(B, [0, 152, 470], "lightR", 2.4);
    for (const s of [-1, 1]) {
      strut(B, [s * 74, 0, 470], [s * 92, 0, 470], 4, "hull2", 8); radiator(B, [s * 160, 0, 470], [0, 0, 0], 136, 88, 12);
      for (let z = 430; z < 520; z += 16) sideDecal(B, ST, 41, s, z, 26, [14, 10], "lit");
      sideDecal(B, ST, 20, s, 470, -8, [110, 110]); sideDecal(B, ST, 0, s, 470, -38, [26, 26]); sideDecal(B, ST, 6, s, 410, 0, [40, 40]);
    }
    for (let k = 0; k < 4; k++) B.decal(2, [0, 0, -604], [0, Math.PI, k * Math.PI / 2], [10, 10]);
    greeble(B, R, [-50, 50, 56, 424, 520, -1], 24, "metal");
    const sp = []; for (let i = 0; i < 12; i++) { const an = i * Math.PI / 6; sp.push([Math.cos(an) * 46, Math.sin(an) * 46, -400 + (i % 4) * 260, 1]); }
    const out = capBuild(B, R, [], "concord", 1.6);
    sp.forEach(([x, y, z]) => { const t = turretMesh("concord", 1.6); t.position.set(x, y, z); t.lookAt(0, 0, z); t.rotateX(-Math.PI / 2); out.g.add(t); out.turrets.push(t); });
    return { obj: out.g, turrets: out.turrets, eng: addEngines(out.g, [[-36, -24, 584], [36, -24, 584], [-36, 24, 584], [36, 24, 584]], 0x8ad0ff, 90) };
  },
  station() {
    // Vigil Station: stepped hub tower, habitat ring on lattice spokes, docking piers, solar mast
    const B = new Builder("concord", 1), R = rng(15);
    B.add(G.lathe([[0, -196], [16, -190], [30, -164], [44, -152], [44, -132], [62, -124], [62, -62], [78, -54], [78, 54], [62, 62], [62, 124], [44, 132], [44, 152], [30, 164], [18, 188], [0, 192]], 32), "hull");
    for (const y of [-124, -62, 62, 124]) B.add(G.torus(Math.abs(y) > 100 ? 53 : 70, 3, 32), "accent", [0, y, 0], [Math.PI / 2, 0, 0]);
    for (const y of [-112, -96, -80, 80, 96, 112]) windowRing(B, 62.4, y, 28, 41, 10);
    for (const y of [-40, -20, 20, 40]) windowRing(B, 78.4, y, 32, 40, 4);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); B.add(G.box(4, 26, 30), "dark", [c * 77.5, 0, s * 77.5], [0, Math.atan2(c, s), 0]); B.add(G.box(1, 1.2, 30), "light", [c * 79.5, -12, s * 79.5], [0, Math.atan2(c, s), 0]); B.decal(32 + (k % 2), [c * 79.6, 18, s * 79.6], [0, Math.atan2(c, s), 0], [26, 26]); }
    B.decal(1, [0, 140, 44.2], [0, 0, 0], [60, 60]); B.decal(0, [0, 140, -44.2], [0, Math.PI, 0], [40, 40]); B.decal(1, [44.2, 140, 0], [0, Math.PI / 2, 0], [60, 60]); B.decal(1, [-44.2, 140, 0], [0, -Math.PI / 2, 0], [60, 60]);
    // habitat ring
    B.add(G.torus(300, 24, 96), "hull", [0, 0, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 32; i++) {
      const an = i / 32 * Math.PI * 2, c = Math.cos(an), s = Math.sin(an);
      B.add(G.torus(26, 3, 14), "hull2", [c * 300, 0, s * 300], [0, -an, 0]);
      const am = an + Math.PI / 32, cm = Math.cos(am), sm = Math.sin(am);
      B.decal(41, [cm * 324.4, 0, sm * 324.4], [0, Math.atan2(cm, sm), 0], [44, 18], "lit"); B.decal(40, [cm * 275.6, 0, sm * 275.6], [0, Math.atan2(cm, sm) + Math.PI, 0], [34, 6], "lit");
      if (i % 2) runLight(B, [c * 300, 27.5, s * 300], i % 4 === 1 ? "lightR" : "light", 1.4);
    }
    // spokes: lattice + transit tube
    for (let a = 0; a < 4; a++) { const an = a * Math.PI / 2 + Math.PI / 4, c = Math.cos(an), s = Math.sin(an); truss(B, [c * 76, 0, s * 76], [c * 278, 0, s * 278], 16, 9, "metal", 0.8); strut(B, [c * 76, 0, s * 76], [c * 278, 0, s * 278], 5, "hull2", 10); }
    // docking piers off the ring
    for (const sg of [-1, 1]) {
      const z = sg * 324; B.add(G.box(16, 12, 90), "hull2", [0, -8, z + sg * 45]); B.add(G.box(40, 4, 16), "dark", [0, -8, z + sg * 82.4]);
      for (const x of [-18, 18]) { B.add(G.box(4, 19.6, 4), "metal", [x, -16.2, z + sg * 82]); runLight(B, [x, -27, z + sg * 82], "lightG", 1.2); }
      for (let k = 0; k < 6; k++) runLight(B, [0, -1.5, z + sg * (10 + k * 14)], "light", 0.9);
      B.decal(2, [0, -1.9, z + sg * 45], [-Math.PI / 2, 0, 0], [12, 80]);
    }
    // solar mast
    B.add(G.cyl(8, 12, 150, 10), "hull2", [0, 266, 0]); for (let y = 210; y < 340; y += 18) B.add(G.torus(9.5, 1.2, 12), "dark", [0, y, 0], [Math.PI / 2, 0, 0]);
    for (const y of [250, 316]) { B.add(G.box(300, 4, 4), "metal", [0, y, 0]); for (const x of [-100, -50, 50, 100]) { B.add(G.box(46, 1.2, 70), "accent", [x, y, 0]); B.add(G.box(47, 1.4, 1.2), "metal", [x, y, 0]); B.add(G.box(1.2, 1.4, 71), "metal", [x, y, 0]); } }
    B.add(G.cyl(1.4, 1.4, 60, 6), "metal", [0, 371, 0]); runLight(B, [0, 402, 0], "lightR", 3);
    B.add(G.sph(26, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), "white", [0, -214, 0], [Math.PI, 0, 0], [1, 0.4, 1]); B.add(G.cyl(1.4, 1.4, 50, 6), "metal", [0, -230, 0]);
    greeble(B, R, [-30, 30, 152, -30, 30, 1], 14, "metal");
    const out = capBuild(B, R, [[300, 26, 0, 1], [-300, 26, 0, 1], [0, 26, 300, 1], [0, 26, -300, 1], [36, 154, 0, 1], [0, -198, 0, -1], [79, 0, -30, 2], [-79, 0, 30, 3]], "concord", 1.6);
    return { obj: out.g, turrets: out.turrets, eng: [] };
  },
  ralthak() {
    // Ral'thak picket corvette: predator prow, swept blade sponsons with bone tusks, ribbed dorsal hump
    const B = new Builder("vharr", 1), R = rng(21);
    const S = [{ z: -108, w: 3, h: 3 }, { z: -95, w: 16, h: 10, n: 2.4, bot: 0.7 }, { z: -60, w: 30, h: 20, n: 2.6, bot: 0.7 }, { z: 0, w: 44, h: 28, n: 2.8, bot: 0.7 }, { z: 60, w: 40, h: 26, n: 3, bot: 0.7 }, { z: 96, w: 30, h: 22, n: 3, bot: 0.7 }, { z: 104, w: 24, h: 18, n: 3, bot: 0.7 }];
    B.add(loft(S, 28), "hull");
    const H = [{ z: -30, w: 4, h: 2, y: 9 }, { z: -10, w: 18, h: 14, y: 12, n: 2.4 }, { z: 40, w: 20, h: 14, y: 12, n: 2.6 }, { z: 60, w: 6, h: 4, y: 10 }];
    B.add(loft(H), "hull2");
    for (let z = -50; z < 90; z += 14) { const s = secAt(S, z); B.add(new THREE.TorusGeometry(1, 0.05, 6, 24, Math.PI), "bone", [0, s.y, z], [0, 0, 0], [s.w / 2 * 1.03, s.h / 2 * 1.06, 1]); }
    for (let i = 0; i < 6; i++) B.add(G.cone(2.4, 16 - i * 1.4, 5), "bone", [0, 20, -10 + i * 10], [0.7, 0, 0]);
    B.mirror(G.wedge(13, 11, 120, 0.25, 0.45), "hull2", [23, -1, -36], [0, -0.18, 0]); for (let z = -70; z < 10; z += 16) B.mirror(G.box(1.4, 4, 8), "glow", [29.6 - (z + 36) * 0.18, -1, z], [0, -0.18, 0]);
    B.mirror(G.cone(5, 30, 6), "bone", [36, -1, -112], [-Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) {
      for (let z = -40; z < 90; z += 16) { const x = surfX(S, s, z, 2); B.add(G.box(4, 6, 10), "dark", [x - s * 1, 2, z]); B.add(G.box(1.4, 4, 8), "glow", [x + s * 0.8, 2, z]); }
      sideDecal(B, S, 24 + (s > 0 ? 1 : 0), s, 30, -2, [22, 22]); sideDecal(B, S, 30, s, -70, -1, [20, 10]); sideDecal(B, S, 27, s, 70, 2, [16, 16]);
      runLight(B, [s * 30, -1, -90], "lightR", 0.8);
    }
    topDecal(B, S, 28, 0, -70, [16, 10]);
    nozzle(B, [0, 0, 110], 10, 12); for (const s of [-1, 1]) nozzle(B, [s * 13, -3, 105], 4.5, 7);
    const tt = (x, z, sg = 1, src = S) => [x, surfY(src, x, z, sg) + sg * 1.5, z, sg];
    const out = capBuild(B, R, [tt(0, -50), tt(0, 20, 1, H), tt(0, 0, -1), tt(0, 60, -1)], "vharr", 1.2);
    return { obj: out.g, turrets: out.turrets, eng: addEngines(out.g, [[0, 0, 118], [-13, -3, 110], [13, -3, 110]], 0xff8a30, 34) };
  },
  kaven() {
    const B = new Builder("vharr", 1), R = rng(22);
    B.add(G.wedge(60, 44, 380, 0.25, 0.4), "hull", [0, 0, 0]);
    B.mirror(G.wedge(18, 12, 260, 0.2, 0.4), "hull2", [50, -6, -20], [0, 0.08, 0]);
    B.mirror(G.cone(7, 50, 6), "bone", [58, -6, -175], [-Math.PI / 2, 0, 0]);
    B.add(G.box(26, 34, 60), "dark", [0, 34, 70]);
    B.add(G.sph(14, 14, 10), "glass", [0, 34, -40]); // shield generator bulb
    B.mirror(G.cyl(16, 14, 30, 10), "dark", [20, 0, 200], [Math.PI / 2, 0, 0]);
    B.mirror(G.cyl(12, 12, 3, 10), "glow", [20, 0, 216], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 10; i++) B.add(G.cone(3.2, 22 - i, 5), "bone", [0, 30, -150 + i * 30], [-0.6, 0, 0]);
    for (let z = -120; z < 200; z += 30) for (const s of [-1, 1]) B.add(G.box(1.6, 5, 14), "glow", [s * 26, 2, z]);
    for (const s of [-1, 1]) { B.decal(25, [s * 28.5, 6, -60], [0, s * Math.PI / 2, 0], [30, 30]); B.decal(29, [s * 28.5, 6, 60], [0, s * Math.PI / 2, 0], [30, 30]); }
    B.decal(28, [0, 22.5, -150], [-Math.PI / 2, 0, 0], [30, 18]);
    greeble(B, R, [-25, 25, 22, -150, 180, 1], 30);
    const out = capBuild(B, R, [[0, 24, -130, 1], [30, 0, -60, 1], [-30, 0, -60, 1], [0, 52, 70, 1], [0, -22, 0, -1], [0, -22, 120, -1]], "vharr", 1.4);
    return { obj: out.g, turrets: out.turrets, eng: addEngines(out.g, [[-20, 0, 222], [20, 0, 222]], 0xff8a30, 55), gen: new THREE.Vector3(0, 34, -40) };
  },
  shroud() {
    // the cloaked hunter: a Hunt-Mother's frame, darker, with a faint violet sheen
    const r = CAPS.gharzen();
    r.obj.traverse(o => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.42); if (o.material.emissive) o.material.emissive.lerp(new THREE.Color(0x5a2a90), 0.5); } });
    r.obj.scale.multiplyScalar(1.15); return r;
  },
  gharzen() {
    const B = new Builder("vharr", 1), R = rng(23);
    B.add(G.lathe([[0, -450], [40, -380], [90, -200], [110, 100], [90, 380], [0, 420]], 12), "hull", [0, 0, 0], [-Math.PI / 2, 0, 0], [1, 1, 0.55]);
    const arc = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * (0.1 + 0.8 * i / 24); arc.push([Math.cos(a) * 320, -Math.sin(a) * 320 + 200]); }
    for (let i = 24; i >= 0; i--) { const a = Math.PI * (0.1 + 0.8 * i / 24); arc.push([Math.cos(a) * 230, -Math.sin(a) * 230 + 200]); }
    B.add(G.plate(arc, 24), "hull2", [0, -12, -40]);
    B.mirror(G.cone(14, 90, 6), "bone", [300, 0, 240], [-Math.PI / 2 - 0.6, 0, 0]);
    B.add(G.box(60, 30, 80), "dark", [0, 0, -420]);
    B.add(G.box(50, 18, 4), "glow", [0, 0, -461]);
    B.add(G.box(40, 60, 90), "hull", [0, 70, 180]);
    B.add(G.sph(20, 14, 10), "glass", [0, 66, -120]);
    B.mirror(G.cyl(30, 26, 40, 12), "dark", [50, 0, 410], [Math.PI / 2, 0, 0]);
    B.mirror(G.cyl(24, 24, 3, 12), "glow", [50, 0, 431], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 9; i++) B.add(G.cone(6, 50, 5), "bone", [0, 56, -300 + i * 70], [-0.6, 0, 0]);
    for (let z = -330; z <= 330; z += 60) B.add(G.torus(96 - Math.abs(z) * 0.08, 5, 28), "bone", [0, 0, z], [0, 0, 0], [1, 0.62, 1]);       // ribs
    for (let z = -280; z < 320; z += 40) for (const s of [-1, 1]) { B.add(G.box(3, 10, 22), "glow", [s * 104.3, 4, z]); B.add(G.box(5, 14, 26), "dark", [s * 103, 4, z]); }
    B.decal(28, [0, 58, -330], [-Math.PI / 2 + 0.3, 0, 0], [90, 50]);
    for (const s of [-1, 1]) { B.decal(24 + (s > 0 ? 0 : 2), [s * 250, 13, 80], [-Math.PI / 2, 0, 0], [80, 80]); B.decal(30, [s * 106, -10, 140], [0, s * Math.PI / 2, 0], [80, 50]); }
    greeble(B, R, [-60, 60, 55, -350, 350, 1], 50);
    const out = capBuild(B, R, [[0, 60, -300, 1], [0, 60, 300, 1], [80, 10, -100, 1], [-80, 10, -100, 1], [200, 12, 80, 1], [-200, 12, 80, 1], [0, -60, -200, -1], [0, -60, 100, -1], [0, 100, 180, 1], [60, -40, 250, -1]], "vharr", 2);
    return { obj: out.g, turrets: out.turrets, eng: addEngines(out.g, [[-50, 0, 440], [50, 0, 440]], 0xff8a30, 110), gen: new THREE.Vector3(0, 66, -120), bay: new THREE.Vector3(0, 0, -470) };
  },
  pyre() {
    // Kar'thask, the Pyre-Mother: two kilometres of bone-white armour around a ventral plasma lance
    const B = new Builder("vharr", 1), R = rng(24);
    const S = [{ z: -960, w: 20, h: 12 }, { z: -900, w: 120, h: 60, n: 2.6, bot: 0.8 }, { z: -700, w: 300, h: 150, n: 3, bot: 0.8 }, { z: -200, w: 440, h: 230, n: 3.2, bot: 0.8 }, { z: 400, w: 420, h: 220, n: 3.4, bot: 0.8 }, { z: 800, w: 340, h: 180, n: 3.4, bot: 0.8 }, { z: 900, w: 300, h: 160, n: 3, bot: 0.8 }];
    B.add(loft(S, 36), "bone");
    B.add(loft(inset(S.slice(1).map(s => ({ ...s, w: s.w + 8, h: s.h * 0.12, y: -s.h * 0.05 })))), "red");                  // blood belt
    // ribs and dorsal crest
    for (let z = -760; z < 860; z += 80) { const s = secAt(S, z); B.add(new THREE.TorusGeometry(1, 0.035, 6, 32, Math.PI), "dark", [0, s.y, z], [0, 0, 0], [s.w / 2 * 1.02, s.h / 2 * 1.04, 1]); }
    for (let i = 0; i < 16; i++) { const z = -760 + i * 100; B.add(G.cone(16, 120 - Math.abs(i - 6) * 5, 5), "bone", [0, surfY(S, 0, z) + 30, z], [0.75, 0, 0]); B.add(G.box(34, 30, 60), "red", [0, surfY(S, 0, z) + 4, z]); }
    // flank spines and vent rows
    for (let i = 0; i < 14; i++) for (const s of [-1, 1]) { const z = -600 + i * 100; B.add(G.cone(14, 150 + R() * 70, 5), "bone", [surfX(S, s, z, 30) - s * 10, 30, z], [0.5, 0, -s * 1.1]); }
    for (const s of [-1, 1]) {
      for (let z = -640; z < 820; z += 36) sideDecal(B, S, 42, s, z, -6, [26, 16], "lit", 0.8);
      for (let z = -560; z < 760; z += 120) { const x = surfX(S, s, z, -40); B.add(G.box(14, 30.6, 70.6), "dark", [x - s * 4, -40, z]); B.add(G.box(3, 22, 60), "glow", [x + s * 3.5, -40, z]); }
      sideDecal(B, S, 24 + (s > 0 ? 2 : 0), s, -420, 40, [180, 180]); sideDecal(B, S, 30, s, -800, 0, [120, 60]); sideDecal(B, S, 29, s, 120, 36, [120, 120]); sideDecal(B, S, 27, s, 520, 20, [140, 140]);
    }
    topDecal(B, S, 28, 0, -780, [200, 110], "decal", 0.8);
    // command domes (one houses the shield generator)
    for (const z of [-200, 300]) { B.add(G.sph(30, 18, 12), "glass", [0, 140, z]); B.add(G.torus(31, 3, 24), "bone", [0, 132, z], [Math.PI / 2, 0, 0]); }
    // the lance: ventral spinal weapon in coil jackets
    B.add(G.cyl(40, 60, 700, 20), "dark", [0, -90, -500], [Math.PI / 2, 0, 0]);
    for (let z = -820; z < -170; z += 40) { B.add(G.torus(48 + (z + 850) / 700 * 14, 5, 20), "bone", [0, -90, z]); B.add(G.torus(44 + (z + 850) / 700 * 14, 1.6, 20), "glow", [0, -90, z + 20]); }
    B.add(G.cyl(30, 30, 6, 20), "glow", [0, -90, -853], [Math.PI / 2, 0, 0]); B.add(G.torus(42, 6, 24), "red", [0, -90, -850]);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; B.add(G.cone(8, 70, 5), "bone", [Math.cos(a) * 50, -90 + Math.sin(a) * 50, -890], [-Math.PI / 2, 0, 0]); }
    // stern
    for (const s of [-1, 1]) nozzle(B, [s * 90, 0, 926], 50, 54); nozzle(B, [0, 40, 916], 34, 40);
    greeble(B, R, [-110, 110, 108, -600, 700, 1], 80, "red");
    const sp = []; for (let i = 0; i < 16; i++) { const s = i % 2 ? 1 : -1, x = s * (100 + (i % 4) * 30), z = -700 + i * 90, sg = i % 3 ? 1 : -1; sp.push([x, surfY(S, x, z, sg) + sg * 3, z, sg]); }
    const out = capBuild(B, R, sp, "vharr", 2.6);
    return { obj: out.g, turrets: out.turrets, eng: addEngines(out.g, [[-90, 0, 960], [90, 0, 960], [0, 40, 945]], 0xff8a30, 240), gen: new THREE.Vector3(0, 140, -200), bay: new THREE.Vector3(0, -90, -860) };
  },
  vtransport() {
    // Thrask hauler: armoured organic hull, cargo sacs slung in bone cradles, dorsal gun
    const B = new Builder("vharr", 1);
    const S = [{ z: -94, w: 3, h: 3, y: -2 }, { z: -80, w: 18, h: 14, y: -1, n: 2.4 }, { z: -50, w: 34, h: 26, n: 2.4, bot: 0.8 }, { z: 20, w: 40, h: 30, n: 2.6, bot: 0.8 }, { z: 70, w: 32, h: 26, n: 2.6, bot: 0.8 }, { z: 90, w: 22, h: 18, n: 2.6 }];
    B.add(loft(S, 28), "hull");
    for (let z = -60; z < 80; z += 16) { const s = secAt(S, z); B.add(new THREE.TorusGeometry(1, 0.05, 6, 22, Math.PI), "bone", [0, s.y, z], [0, 0, 0], [s.w / 2 * 1.03, s.h / 2 * 1.06, 1]); }
    for (let i = 0; i < 5; i++) B.add(G.cone(2.2, 14 - i, 5), "bone", [0, surfY(S, 0, 30 + i * 10) + 4, 30 + i * 10], [0.7, 0, 0]);
    for (const s of [-1, 1]) {
      for (const z of [-30, 2, 34]) {
        B.add(G.sph(1, 16, 12), "hull2", [s * 27, -3, z], [0, 0, 0], [9, 11, 15]);
        for (const dz of [-8, 0, 8]) B.add(new THREE.TorusGeometry(1, 0.08, 6, 18, Math.PI), "bone", [s * 27, -3, z + dz], [0, 0, -s * Math.PI / 2], [11.4 * Math.sqrt(1 - (dz / 15) ** 2), 9.6 * Math.sqrt(1 - (dz / 15) ** 2), 1]);
        B.add(G.box(1.2, 8, 3), "glow", [s * 36, -3, z]);
        strut(B, [s * 14, 2, z], [s * 22, 4, z], 1.6, "bone");
      }
      sideDecal(B, S, 25 + (s > 0 ? 1 : 0), s, -62, 1, [16, 16]); sideDecal(B, S, 30, s, 62, 2, [16, 8]);
    }
    topDecal(B, S, 28, 0, -66, [16, 9]);
    B.add(G.cyl(6, 8, 6, 10), "dark", [0, surfY(S, 0, 0) + 1, 0]);
    nozzle(B, [0, 0, 94], 9, 12); for (const s of [-1, 1]) nozzle(B, [s * 12, -3, 88], 4, 6);
    const g = B.build(); const t = turretMesh("vharr", 1); t.position.set(0, surfY(S, 0, 0) + 4.5, 0); g.add(t);
    return { obj: g, turrets: [t], eng: addEngines(g, [[0, 0, 102], [-12, -3, 93], [12, -3, 93]], 0xff8a30, 26) };
  },
  prison() {
    // Ghul Ankoth: a faceted spined core, six caged cell blocks on bone arms, hanging gibbets
    const B = new Builder("vharr", 1), R = rng(25);
    const PR = [[0, -250], [20, -214], [40, -176], [80, -130], [110, -60], [120, 0], [110, 60], [80, 130], [40, 172], [0, 176]];
    B.add(G.lathe(PR, 10), "hull");
    const rAt = y => { for (let i = 0; i < PR.length - 1; i++) { const [r0, y0] = PR[i], [r1, y1] = PR[i + 1]; if (y >= y0 && y <= y1) return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0; };
    for (const y of [-100, -50, 0, 50, 100]) B.add(G.torus(rAt(y) * 0.97, 5, 30), "bone", [0, y, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), r = 120 * Math.cos(Math.PI / 10) + 0.6; B.decal(42, [c * r * 0.97, 24, s * r * 0.97], [0, Math.atan2(c, s), 0], [44, 28], "lit"); B.decal(42, [c * r * 0.97, -24, s * r * 0.97], [0, Math.atan2(c, s), 0], [44, 28], "lit"); }
    B.decal(28, [0, 80, rAt(80) * 0.95 + 1], [-0.45, 0, 0], [80, 44]); B.decal(28, [0, 80, -rAt(80) * 0.95 - 1], [-0.45, Math.PI, 0], [80, 44]);
    // crown deck, spire, under-spikes
    B.add(G.cyl(62, 44, 10, 10), "dark", [0, 180, 0]); B.add(G.cone(16, 150, 6), "bone", [0, 258, 0]);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; B.add(G.cone(7, 60, 5), "bone", [Math.cos(a) * 48, 200, Math.sin(a) * 48], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]); }
    B.add(G.cyl(50, 30, 10, 10), "dark", [0, -186, 0]);
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, r = k ? 34 : 0; B.add(G.cone(k ? 7 : 12, k ? 70 : 140, 5), "bone", [Math.cos(a) * r, k ? -220 : -260, Math.sin(a) * r], [Math.PI, 0, 0]); }
    // arms and cell blocks (built in each arm's local frame: x radial, z tangential)
    for (let k = 0; k < 6; k++) {
      const an = k * Math.PI / 3, rad = [Math.cos(an), 0, Math.sin(an)], tan = [-Math.sin(an), 0, Math.cos(an)];
      const L = (x, y, z) => [rad[0] * x + tan[0] * z, y, rad[2] * x + tan[2] * z];
      for (const y of [-14, 14]) strut(B, L(100, y, 0), L(184, y, 0), 4.5, "bone", 6);
      B.add(G.box(80, 8, 10), "dark", L(142, 0, 0), [0, -an, 0]);
      B.add(G.box(36, 36, 110), "hull2", L(200, 0, 0), [0, -an, 0]);
      for (const z of [-56, 56]) B.add(G.box(40, 40, 6), "bone", L(200, 0, z), [0, -an, 0]);
      for (let z = -48; z <= 48; z += 8) B.add(G.box(2, 38, 2), "metal", L(219, 0, z), [0, -an, 0]);
      B.decal(42, L(218.4, 6, 0), [0, -an + Math.PI / 2, 0], [100, 20], "lit"); B.decal(42, L(181.6, 6, 0), [0, -an - Math.PI / 2, 0], [100, 20], "lit");
      B.decal(24 + (k % 3), L(218.6, -10, -30), [0, -an + Math.PI / 2, 0], [24, 24]);
      for (const z of [-40, 0, 40]) B.add(G.cone(4, 26, 5), "bone", L(232, -16, z), [0, -an, -Math.PI / 2]);
      if (k % 2) { strut(B, L(170, -4, 0), L(170, -70, 0), 1, "metal", 4); B.add(G.box(14, 18, 14), "dark", L(170, -80, 0), [0, -an, 0]); for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7], [0, -7], [0, 7], [-7, 0], [7, 0]]) B.add(G.box(0.9, 20, 0.9), "metal", L(170 + dx, -80, dz), [0, -an, 0]); B.add(G.box(3, 3, 3), "glow", L(170, -82, 0)); }
    }
    // shuttle dock facing +z
    B.add(G.box(30, 16, 70), "dark", [0, -40, 140]); B.add(G.box(34, 3, 6), "bone", [0, -31, 176]);
    for (let z = 112; z < 176; z += 12) for (const x of [-14, 14]) runLight(B, [x, -31, z], "light", 1.2);
    const out = capBuild(B, R, [[200, 20, 0, 1], [-200, 20, 0, 1], [100, 20, 173, 1], [-100, 20, -173, 1], [0, 187, 30, 1], [0, -193, -30, -1]], "vharr", 2);
    return { obj: out.g, turrets: out.turrets, eng: [] };
  },
  node() {
    // Mantle Node: anchored tectonic spire on buttress legs, bone halo, collared core of molten light
    const B = new Builder("vharr", 1);
    B.add(G.lathe([[0, -112], [62, -104], [96, -82], [100, -50], [82, -18], [70, 40], [50, 70], [34, 92], [0, 96]], 8), "hull");
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); B.add(G.box(3, 70, 3), "glow", [c * 78, 10, s * 78], [Math.sin(a) * 0.17, 0, -Math.cos(a) * 0.17]); B.decal(24 + (k % 3), [c * 92, -66, s * 92], [0, Math.atan2(c, s), 0], [30, 30]); }
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3 + 0.3, c = Math.cos(a), s = Math.sin(a);
      strut(B, [c * 70, 20, s * 70], [c * 170, -130, s * 170], 8, "bone", 6); strut(B, [c * 90, -60, s * 90], [c * 150, -100, s * 150], 5, "dark", 6);
      B.add(G.cone(10, 50, 5), "bone", [c * 172, -160, s * 172], [Math.PI, 0, 0]);
    }
    B.add(G.torus(130, 8, 48), "bone", [0, 40, 0], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, c = Math.cos(a), s = Math.sin(a); B.add(G.cone(5, 34, 5), "bone", [c * 152, 40, s * 152], [0, 0, 0], [1, 1, 1]); strut(B, [c * 130, 40, s * 130], [c * 136, 40, s * 136], 3, "bone"); if (k % 2) strut(B, [c * 54, 66, s * 54], [c * 126, 42, s * 126], 3.5, "dark"); }
    B.add(G.cyl(16, 16, 300, 12), "glow", [0, 210, 0]);
    for (let y = 90; y < 350; y += 30) { B.add(G.cyl(24, 24, 8, 8), "dark", [0, y, 0], [0, Math.PI / 8, 0]); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + y * 0.02; B.add(G.cone(3, 16, 4), "bone", [Math.cos(a) * 24, y + 6, Math.sin(a) * 24], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]); } }
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, r = k ? 18 : 0; B.add(G.cone(k ? 6 : 10, k ? 40 : 70, 5), "glow", [Math.cos(a) * r, 380, Math.sin(a) * r], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]); }
    const g = B.build(); const s = engineSprite(0xff4020, 400); s.position.y = 120; g.add(s);
    return { obj: g, turrets: [], eng: [] };
  },
};

export function buildShip(type) {
  let r;
  if (type === "shkara") r = FIGHTERS.vhaal("white");
  else if (type === "bloodcrown") r = FIGHTERS.vhaal("crown");
  else if (type === "embership") r = FIGHTERS.vhaal();
  else if (FIGHTERS[type]) r = FIGHTERS[type]();
  else r = CAPS[type]();
  r.obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  const box = new THREE.Box3().setFromObject(r.obj); const sz = new THREE.Vector3(); box.getSize(sz);
  r.radius = sz.length() / 2; r.size = sz;
  r.guns = (r.guns || []).map(p => new THREE.Vector3(...p));
  return r;
}

// ---------------------------------------------------------------- ENVIRONMENT
export { makeSky, makeStarfield, makeSun } from "./space.js";
export { makePlanet, makeAsteroidGeo, asteroidMaterial, setSun, setBakeSize, PLANETS } from "./planets.js";

// ---------------------------------------------------------------- COCKPIT
export function buildCockpit(fac = "concord", style = "kestrel") {
  const m = mats(fac, 0);
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.6, metalness: 0.7, bumpMap: TEX.concord0.bump, bumpScale: 0.4, map: TEX.concord0.map });
  frame.map = TEX.concord0.map.clone(); frame.map.repeat.set(0.4, 0.4); frame.color.set(0x5a6068);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.75, metalness: 0.4 });
  // dashboard: a slanted slab across the bottom
  const dash = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.9), dashMat); dash.position.set(0, -0.86, -1.08); dash.rotation.x = 0.55; g.add(dash);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 0.1), frame); lip.position.set(0, -0.44, -1.36); g.add(lip);
  // canopy struts
  const strut = (x1, y1, x2, y2, z = -1.35, w = 0.05) => {
    const len = Math.hypot(x2 - x1, y2 - y1); const s = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.06), frame);
    s.position.set((x1 + x2) / 2, (y1 + y2) / 2, z); s.rotation.z = Math.atan2(-(x2 - x1), y2 - y1); g.add(s);
  };
  const W = 1.62;
  strut(-W, -0.44, -0.86, 0.95, -1.4, 0.07); strut(W, -0.44, 0.86, 0.95, -1.4, 0.07);
  strut(-0.86, 0.95, 0.86, 0.95, -1.4, 0.06);
  strut(-W, -0.44, -W * 1.05, 1.2, -0.6, 0.09); strut(W, -0.44, W * 1.05, 1.2, -0.6, 0.09);
  if (style === "heavy") { strut(0, 0.95, 0, 1.4, -1.0, 0.05); }
  // side consoles
  for (const s of [-1, 1]) {
    const con = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 1.2), dashMat); con.position.set(s * 1.55, -0.62, -0.4); con.rotation.z = -s * 0.3; g.add(con);
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.05), new THREE.MeshBasicMaterial({ color: [0xff4020, 0x20ff60, 0xffc020][i % 3] })); b.position.set(s * (1.4 + (i % 3) * 0.1), -0.43, -0.6 + Math.floor(i / 3) * 0.2); b.rotation.z = -s * 0.3; g.add(b); }
  }
  // stick
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 8), frame); stick.position.set(0, -1.05, -0.5); g.add(stick);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.16, 10), dashMat); grip.position.set(0, -0.78, -0.5); g.add(grip);
  g.userData.stick = stick; g.userData.grip = grip;
  // screen rects (positions referenced for HUD overlay)
  g.userData.screens = [];
  for (const x of [-0.95, 0.95]) { const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshBasicMaterial({ color: 0x050a08 })); sc.position.set(x, -0.64, -1.2); sc.rotation.x = -0.3; g.add(sc); g.userData.screens.push(sc); }
  // radar housing
  const rad = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 32), new THREE.MeshBasicMaterial({ color: 0x040806 })); rad.rotation.x = Math.PI / 2 - 0.3; rad.position.set(0, -0.64, -1.22); g.add(rad); g.userData.screens.push(rad);
  g.traverse(o => { o.layers.set(1); });
  return g;
}
