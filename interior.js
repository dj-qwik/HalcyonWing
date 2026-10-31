// HALCYON WING — shipboard architecture kit. Painted surfaces (colour + bump + roughness + glow in
// lockstep) for bulkheads, deck plate and ceilings, and a set of merged 3D parts — structural ribs,
// pipe runs, cable trays, junction boxes, vents, lights, door frames, rails — that dress a room.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function rnd(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function shade(hex, k, add = 0) { const c = new THREE.Color(hex); c.multiplyScalar(k); c.r += add; c.g += add; c.b += add; return "#" + c.getHexString(); }

// ---------------------------------------------------------------- PAINTER (4 layers in lockstep)
function painter(w, h, seed) {
  const R = rnd(seed);
  const L = { c: cv(w, h), h: cv(w, h), r: cv(w, h), e: cv(w, h) };
  const x = L.c.getContext("2d"), hx = L.h.getContext("2d"), rx = L.r.getContext("2d"), ex = L.e.getContext("2d");
  hx.fillStyle = "#808080"; hx.fillRect(0, 0, w, h); rx.fillStyle = "rgb(0,140,0)"; rx.fillRect(0, 0, w, h); ex.fillStyle = "#000"; ex.fillRect(0, 0, w, h);
  const P = {
    R, x, hx, rx, ex, w, h,
    rect(X, Y, W, H, c, ht, ro, em) { if (c) { x.fillStyle = c; x.fillRect(X, Y, W, H); } if (ht != null) { hx.fillStyle = `rgb(${ht},${ht},${ht})`; hx.fillRect(X, Y, W, H); } if (ro != null) { rx.fillStyle = `rgb(0,${ro},0)`; rx.fillRect(X, Y, W, H); } if (em) { ex.fillStyle = em; ex.fillRect(X, Y, W, H); } },
    circ(X, Y, r, c, ht, ro, em) { for (const [ctx, col] of [[x, c], [hx, ht != null ? `rgb(${ht},${ht},${ht})` : null], [rx, ro != null ? `rgb(0,${ro},0)` : null], [ex, em]]) { if (!col) continue; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill(); } },
    brushed(X, Y, W, H, c, dir = 0) { x.fillStyle = c; x.fillRect(X, Y, W, H); const n = (dir ? W : H) / 1.6; for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${R() < 0.5 ? "255,255,255" : "0,0,0"},${0.012 + R() * 0.03})`; if (dir) x.fillRect(X + R() * W, Y, 1, H); else x.fillRect(X, Y + R() * H, W, 1); } },
    grime(X, Y, W, H, n = 20, a = 0.12) { for (let i = 0; i < n; i++) { const px = X + R() * W, py = Y + R() * H, r = 10 + R() * Math.min(W, H) * 0.3, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(10,8,6,${a})`); g.addColorStop(1, "rgba(10,8,6,0)"); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); } },
    drip(X, Y, len, a = 0.18) { const g = x.createLinearGradient(X, Y, X, Y + len); g.addColorStop(0, `rgba(20,14,8,${a})`); g.addColorStop(1, "rgba(20,14,8,0)"); x.fillStyle = g; x.fillRect(X - 1.5, Y, 3 + R() * 3, len); },
    seam(X, Y, W, H, s = 3) { x.fillStyle = "rgba(0,0,0,.8)"; x.fillRect(X, Y, W, H); hx.fillStyle = "#1a1a1a"; hx.fillRect(X, Y, W, H); x.fillStyle = "rgba(255,255,255,.12)"; if (W > H) x.fillRect(X, Y + H, W, 1.2); else x.fillRect(X + W, Y, 1.2, H); },
    bevelPanel(X, Y, W, H, c, inset = false) {
      P.brushed(X, Y, W, H, c); hx.fillStyle = inset ? "#6a6a6a" : "#909090"; hx.fillRect(X, Y, W, H);
      x.fillStyle = "rgba(0,0,0,.75)"; x.fillRect(X - 2, Y - 2, W + 4, 3); x.fillRect(X - 2, Y - 2, 3, H + 4); x.fillRect(X - 2, Y + H - 1, W + 4, 3); x.fillRect(X + W - 1, Y - 2, 3, H + 4);
      hx.fillStyle = "#202020"; hx.fillRect(X - 2, Y - 2, W + 4, 3); hx.fillRect(X - 2, Y - 2, 3, H + 4); hx.fillRect(X - 2, Y + H - 1, W + 4, 3); hx.fillRect(X + W - 1, Y - 2, 3, H + 4);
      x.fillStyle = inset ? "rgba(0,0,0,.25)" : "rgba(255,255,255,.13)"; x.fillRect(X + 1, Y + 1, W - 2, 1.5); x.fillRect(X + 1, Y + 1, 1.5, H - 2);
      x.fillStyle = inset ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.28)"; x.fillRect(X + 1, Y + H - 2.5, W - 2, 1.5); x.fillRect(X + W - 2.5, Y + 1, 1.5, H - 2);
    },
    rivet(X, Y, r) { P.circ(X, Y, r + 1, "rgba(0,0,0,.35)", 100); const g = x.createRadialGradient(X - r * 0.4, Y - r * 0.4, 0, X, Y, r); g.addColorStop(0, "rgba(220,220,215,.9)"); g.addColorStop(1, "rgba(80,82,86,.9)"); x.fillStyle = g; x.beginPath(); x.arc(X, Y, r, 0, 7); x.fill(); hx.fillStyle = "#d0d0d0"; hx.beginPath(); hx.arc(X, Y, r, 0, 7); hx.fill(); rx.fillStyle = "rgb(0,80,0)"; rx.beginPath(); rx.arc(X, Y, r, 0, 7); rx.fill(); },
    screw(X, Y, r) { P.circ(X, Y, r + 1.2, "rgba(0,0,0,.6)", 60); const g = x.createRadialGradient(X - r * 0.35, Y - r * 0.35, 0, X, Y, r); g.addColorStop(0, "#c9cbcc"); g.addColorStop(1, "#5d6064"); x.fillStyle = g; x.beginPath(); x.arc(X, Y, r, 0, 7); x.fill(); hx.fillStyle = "#b0b0b0"; hx.beginPath(); hx.arc(X, Y, r, 0, 7); hx.fill(); const a = R() * 3; for (const ctx of [x, hx]) { ctx.strokeStyle = ctx === x ? "#1c1d1f" : "#555"; ctx.lineWidth = Math.max(1, r * 0.3); ctx.beginPath(); ctx.moveTo(X - Math.cos(a) * r * 0.65, Y - Math.sin(a) * r * 0.65); ctx.lineTo(X + Math.cos(a) * r * 0.65, Y + Math.sin(a) * r * 0.65); ctx.moveTo(X - Math.sin(a) * r * 0.65, Y + Math.cos(a) * r * 0.65); ctx.lineTo(X + Math.sin(a) * r * 0.65, Y - Math.cos(a) * r * 0.65); ctx.stroke(); } },
    rivetLine(X0, Y0, X1, Y1, pitch, r) { const L = Math.hypot(X1 - X0, Y1 - Y0), n = Math.max(1, Math.round(L / pitch)); for (let i = 0; i <= n; i++) P.rivet(X0 + (X1 - X0) * i / n, Y0 + (Y1 - Y0) * i / n, r); },
    text(t, X, Y, size, c = "rgba(230,225,210,.85)", align = "left", font = "'Share Tech Mono', 'DejaVu Sans Mono', monospace", weight = "bold") { x.font = `${weight} ${size}px ${font}`; x.textAlign = align; x.textBaseline = "middle"; x.fillStyle = c; x.fillText(t, X, Y); hx.font = x.font; hx.textAlign = align; hx.textBaseline = "middle"; hx.fillStyle = "rgba(150,150,150,.5)"; hx.fillText(t, X, Y); },
    stencil(t, X, Y, size, c = "rgba(235,228,205,.7)", align = "left") { P.text(t, X, Y, size, c, align, "'Chakra Petch', 'DejaVu Sans', sans-serif", "700"); },
    hazard(X, Y, W, H, k = 18, a = 1) { x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip(); x.globalAlpha = a; x.fillStyle = "#161616"; x.fillRect(X, Y, W, H); x.fillStyle = "#d4aa22"; for (let i = -H - k * 2; i < W + H; i += k * 2) { x.beginPath(); x.moveTo(X + i, Y + H); x.lineTo(X + i + k, Y + H); x.lineTo(X + i + k + H, Y); x.lineTo(X + i + H, Y); x.fill(); } x.restore(); P.rect(X, Y, W, H, null, 135, 120); },
    grille(X, Y, W, H, slot = 6) { P.rect(X - 3, Y - 3, W + 6, H + 6, "#0b0c0d", 40, 200); P.bevelPanel(X, Y, W, H, "#34383e"); for (let yy = Y + slot; yy < Y + H - slot; yy += slot * 2) P.rect(X + slot, yy, W - slot * 2, slot, "#060708", 25, 220); },
    label(X, Y, W, H, lines, bg = "#d8d2c0", fg = "#141414") { P.rect(X, Y, W, H, bg, 150, 170); x.strokeStyle = fg; x.lineWidth = 1.5; x.strokeRect(X + 2, Y + 2, W - 4, H - 4); lines.forEach((l, i) => { x.font = `bold ${Math.round(H / (lines.length + 1.2))}px 'Share Tech Mono', monospace`; x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(l, X + W / 2, Y + H * (i + 1) / (lines.length + 1)); }); },
    caution(X, Y, W, H, head = "CAUTION", body = "HIGH VOLTAGE") { P.rect(X, Y, W, H, "#e8c020", 150, 170); P.rect(X, Y, W, H * 0.36, "#141414"); x.font = `bold ${Math.round(H * 0.24)}px 'Chakra Petch', sans-serif`; x.fillStyle = "#e8c020"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(head, X + W / 2, Y + H * 0.19); x.fillStyle = "#141414"; x.font = `bold ${Math.round(H * 0.2)}px 'Chakra Petch', sans-serif`; x.fillText(body, X + W / 2, Y + H * 0.68); },
    led(X, Y, r, c) { P.circ(X, Y, r + 1.5, "#0a0a0a", 70); P.circ(X, Y, r, c, 150, 60, c); },
    hatch(X, Y, W, H, c) {
      P.bevelPanel(X, Y, W, H, c); const m = Math.min(W, H) * 0.09; for (const [a, b] of [[X + m, Y + m], [X + W - m, Y + m], [X + m, Y + H - m], [X + W - m, Y + H - m]]) P.screw(a, b, Math.max(2.5, m * 0.32));
      const hw = W * 0.34, hh = Math.min(H * 0.14, 22); P.rect(X + (W - hw) / 2, Y + H / 2 - hh / 2, hw, hh, "#0a0b0c", 30, 200); P.rect(X + (W - hw) / 2 + 3, Y + H / 2 - hh / 2 + 3, hw - 6, 3, "#2a2c2e");
      if (R() < 0.6) P.label(X + W * 0.15, Y + m * 2.2, W * 0.7, Math.max(12, H * 0.08), [["ACCESS", "SERVICE", "ELEC", "HYD", "O2 VALVES", "DATA"][(R() * 6) | 0] + " " + (10 + ((R() * 80) | 0))]);
    },
    out(srgbMap = true) {
      const mk = (c, s) => { const t = new THREE.CanvasTexture(c); if (s) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
      const hs = cv(w, h), hc = hs.getContext("2d"); hc.filter = "blur(0.8px)"; hc.drawImage(L.h, 0, 0);
      return { map: mk(L.c, srgbMap), bump: mk(hs), rough: mk(L.r), emissive: mk(L.e, true) };
    },
  };
  return P;
}

const TXC = {};
// ---------------------------------------------------------------- BULKHEAD (one wall bay: tw m wide x th m tall)
// zones: kickplate, lower panel, main panel with inset hatches/vents/labels, upper service band
export function bulkheadTex({ base = "#3a4048", accent = "#c89040", th = 3.4, tw = 2.4, seed = 1, deck = "4", frame = 212, red = false } = {}) {
  const k = [base, accent, th, tw, seed, deck, frame].join("|"); if (TXC[k]) return TXC[k];
  const ppm = 360, W = Math.round(tw * ppm), H = Math.round(th * ppm), P = painter(W, H, seed), R = P.R;
  const mm = v => v * ppm / 1000;                       // millimetres to pixels
  const yOf = m => H - mm(m);                            // height above deck (mm) to canvas y
  P.brushed(0, 0, W, H, shade(base, 0.95));
  // upper service band (cable runs in front of it are 3D): darker, louvred
  const upper = Math.min(th * 1000 - 300, 2550);
  P.rect(0, 0, W, yOf(upper), shade(base, 0.55), 70, 175);
  for (let xx = mm(80); xx < W - mm(80); xx += mm(560)) P.grille(xx, yOf(upper) - mm(260), mm(420), mm(170), 5);
  P.seam(0, yOf(upper) - 2, W, 4);
  // kickplate: dark, scuffed, hazard band on top
  P.rect(0, yOf(260), W, mm(260), shade(base, 0.45), 110, 160);
  P.hazard(0, yOf(300), W, mm(40), 10, 0.9);
  for (let i = 0; i < 26; i++) { const px = R() * W, py = yOf(240) + R() * mm(220); P.x.strokeStyle = `rgba(200,200,190,${0.05 + R() * 0.12})`; P.x.lineWidth = 1 + R() * 2; P.x.beginPath(); P.x.moveTo(px, py); P.x.lineTo(px + (R() - 0.5) * 60, py + (R() - 0.5) * 8); P.x.stroke(); }
  P.rivetLine(mm(30), yOf(150), W - mm(30), yOf(150), mm(120), 3.2);
  // lower and main panels: bevelled plates with rivet borders
  const pan = (y0, y1, inset) => { const X = mm(60), Y = yOf(y1), PW = W - mm(120), PH = mm(y1 - y0); P.bevelPanel(X, Y, PW, PH, shade(base, inset ? 0.82 : 1.02 + R() * 0.06), inset);
    P.rivetLine(X + mm(25), Y + mm(25), X + PW - mm(25), Y + mm(25), mm(90), 2.6); P.rivetLine(X + mm(25), Y + PH - mm(25), X + PW - mm(25), Y + PH - mm(25), mm(90), 2.6);
    P.rivetLine(X + mm(25), Y + mm(25), X + mm(25), Y + PH - mm(25), mm(90), 2.6); P.rivetLine(X + PW - mm(25), Y + mm(25), X + PW - mm(25), Y + PH - mm(25), mm(90), 2.6); return [X, Y, PW, PH]; };
  const lo = pan(330, 1050, true);
  const mid = pan(1110, upper - 60, false);
  // accent stripe across the main panel
  P.rect(0, yOf(1220), W, mm(38), accent, 120, 120); P.rect(0, yOf(1160), W, mm(10), shade(accent, 0.7), 120, 120);
  // inset furniture on the main panel: an access hatch, a vent, data plates, a warning label, LEDs
  const [mx, my, mw, mh] = mid;
  const hx0 = mx + mm(90 + R() * 200), hw = mm(420 + R() * 200), hh = mm(520 + R() * 300);
  if (mh > hh + mm(300)) { P.hatch(hx0, my + mm(160), hw, hh, shade(base, 0.9)); P.led(hx0 + hw + mm(40), my + mm(200), 3.5, R() < 0.5 ? "#40ff70" : "#ffb030"); }
  const gx = mx + mw - mm(380), gy = my + mm(140); if (mw > mm(900)) P.grille(gx, gy, mm(260), mm(320), 5);
  P.label(mx + mw - mm(400), my + mh - mm(260), mm(300), mm(90), [`FR ${frame}`, `DK ${deck} · ${["P", "S"][seed % 2]}-${10 + (seed * 7) % 80}`], "#cbc5b4");
  if (R() < 0.7) P.caution(mx + mm(60), my + mh - mm(330), mm(260), mm(130), ...[["CAUTION", "HIGH VOLTAGE"], ["WARNING", "PRESSURE LINE"], ["CAUTION", "HOT SURFACE"], ["NOTICE", "KEEP CLEAR"]][(R() * 4) | 0]);
  // lower panel: a small service box and a stencil
  const [lx, ly, lw, lh] = lo;
  P.hatch(lx + lw * (0.15 + R() * 0.4), ly + mm(130), mm(300), mm(260), shade(base, 0.78));
  P.stencil(["O2 · 1", "H2O · 2", "PWR · A", "COOL · 3", "N2 · 4"][(R() * 5) | 0], lx + lw - mm(60), ly + lh - mm(80), mm(50), "rgba(230,222,200,.55)", "right");
  // wear: grime gathered at the bottom, drips under fittings, polished edges at hand height
  P.grime(0, yOf(700), W, mm(700), 18, 0.13); P.grime(0, 0, W, H, 14, 0.07);
  for (let i = 0; i < 4; i++) P.drip(mm(100) + R() * (W - mm(200)), yOf(upper - 120), mm(200 + R() * 500), 0.14);
  if (red) { P.x.fillStyle = "rgba(90,8,4,.28)"; P.x.fillRect(0, 0, W, H); }
  return (TXC[k] = P.out());
}

// ---------------------------------------------------------------- DECK PLATE (tile = m x m)
export function deckPlateTex({ base = "#3a3e44", m = 4, tread = true, lines = null, seed = 3, hangar = false } = {}) {
  const k = ["d", base, m, tread, seed, hangar, JSON.stringify(lines)].join("|"); if (TXC[k]) return TXC[k];
  const S = 2048, P = painter(S, S, seed), R = P.R, ppm = S / m;
  P.brushed(0, 0, S, S, shade(base, 0.92));
  const plate = hangar ? 2 : 1, pp = plate * ppm;
  for (let i = 0; i < m / plate; i++) for (let j = 0; j < m / plate; j++) {
    const X = i * pp, Y = j * pp, v = 0.88 + R() * 0.16;
    P.bevelPanel(X + 3, Y + 3, pp - 6, pp - 6, shade(base, v));
    const sm = pp * 0.05; for (const [a, b] of [[X + sm, Y + sm], [X + pp - sm, Y + sm], [X + sm, Y + pp - sm], [X + pp - sm, Y + pp - sm], [X + pp / 2, Y + sm], [X + pp / 2, Y + pp - sm], [X + sm, Y + pp / 2], [X + pp - sm, Y + pp / 2]]) P.screw(a, b, Math.max(3, pp * 0.012));
    // diamond tread inserts on alternating plates
    if (tread && (i + j) % 2 === 0) { const ix = X + pp * 0.15, iy = Y + pp * 0.15, iw = pp * 0.7; P.rect(ix, iy, iw, iw, shade(base, 0.75), 110, 120);
      const st = Math.max(10, pp * 0.035); for (let yy = 0; yy < iw / st; yy++) for (let xx = 0; xx < iw / st; xx++) { const cx = ix + xx * st + (yy % 2) * st / 2, cy = iy + yy * st; P.x.save(); P.x.translate(cx, cy); P.x.rotate((yy % 2 ? 0.7 : -0.7)); P.rect(-st * 0.32, -st * 0.07, st * 0.64, st * 0.14, shade(base, 1.18), 175, 90); P.x.restore(); P.hx.save(); P.hx.translate(cx, cy); P.hx.rotate((yy % 2 ? 0.7 : -0.7)); P.hx.fillStyle = "#c0c0c0"; P.hx.fillRect(-st * 0.32, -st * 0.07, st * 0.64, st * 0.14); P.hx.restore(); } }
    // tie-down pad or drain on some plates
    if (R() < (hangar ? 0.5 : 0.18)) { const cx = X + pp / 2, cy = Y + pp / 2, r = pp * (hangar ? 0.08 : 0.06); P.circ(cx, cy, r * 1.35, "#121314", 60, 200); P.circ(cx, cy, r, shade(base, 0.7), 100, 120); for (let a = 0; a < 8; a++) P.rect(cx + Math.cos(a * 0.785) * r * 0.55 - 2, cy + Math.sin(a * 0.785) * r * 0.55 - 2, 4, 4, "#0a0a0a", 30); P.circ(cx, cy, r * 0.28, "#9a9c9e", 170, 70); }
  }
  // painted markings
  for (const L of lines || []) {
    if (L.hazard) P.hazard(L.x * ppm, L.y * ppm, L.w * ppm, L.h * ppm, Math.max(14, L.h * ppm * 0.6), 0.9);
    else { P.x.globalAlpha = L.a ?? 0.8; P.rect(L.x * ppm, L.y * ppm, L.w * ppm, L.h * ppm, L.c || "#d4aa22", 125, 110); P.x.globalAlpha = 1; }
  }
  // wear: scuffs, tyre marks, oil stains, worn paths
  for (let i = 0; i < (hangar ? 40 : 14); i++) { const px = R() * S, py = R() * S, r = 20 + R() * (hangar ? 140 : 70), g = P.x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(12,10,8,${hangar ? 0.28 : 0.16})`); g.addColorStop(1, "rgba(12,10,8,0)"); P.x.fillStyle = g; P.x.fillRect(px - r, py - r, r * 2, r * 2); P.rx.fillStyle = "rgba(0,60,0,.25)"; P.rx.beginPath(); P.rx.arc(px, py, r * 0.5, 0, 7); P.rx.fill(); }
  if (hangar) for (let i = 0; i < 18; i++) { const px = R() * S, py = R() * S, a = R() * 6, l = 200 + R() * 500; P.x.strokeStyle = "rgba(10,10,10,.22)"; P.x.lineWidth = 10 + R() * 8; P.x.beginPath(); P.x.moveTo(px, py); P.x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (R() - 0.5) * 120, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); P.x.stroke(); }
  for (let i = 0; i < 60; i++) { const px = R() * S, py = R() * S; P.x.strokeStyle = `rgba(210,210,200,${0.04 + R() * 0.08})`; P.x.lineWidth = 1; P.x.beginPath(); P.x.moveTo(px, py); P.x.lineTo(px + (R() - 0.5) * 120, py + (R() - 0.5) * 120); P.x.stroke(); }
  return (TXC[k] = P.out());
}

// ---------------------------------------------------------------- CEILING (tile = m x m): coffers, lights, vents
export function ceilingTex({ base = "#24282e", m = 2.4, seed = 7, warm = "#ffe6c0", lights = true } = {}) {
  const k = ["c", base, m, seed, warm, lights].join("|"); if (TXC[k]) return TXC[k];
  const S = 1024, P = painter(S, S, seed), R = P.R, ppm = S / m;
  P.brushed(0, 0, S, S, shade(base, 0.8));
  const cof = S / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const X = i * cof, Y = j * cof; P.bevelPanel(X + 10, Y + 10, cof - 20, cof - 20, shade(base, 1.0), true);
    P.rivetLine(X + 24, Y + 24, X + cof - 24, Y + 24, 46, 2.4); P.rivetLine(X + 24, Y + cof - 24, X + cof - 24, Y + cof - 24, 46, 2.4);
    if (lights && (i + j) % 2 === 0) { const lx = X + cof * 0.18, ly = Y + cof * 0.38, lw = cof * 0.64, lh = cof * 0.24; P.rect(lx - 8, ly - 8, lw + 16, lh + 16, "#0d0e10", 40, 200); P.rect(lx, ly, lw, lh, shade(warm, 0.9), 150, 40, warm); for (let s = 1; s < 6; s++) P.rect(lx + lw * s / 6 - 2, ly, 4, lh, "#2a2c2e", 120, 100, "#000"); }
    else P.grille(X + cof * 0.25, Y + cof * 0.3, cof * 0.5, cof * 0.4, 7);
  }
  P.grime(0, 0, S, S, 10, 0.1);
  return (TXC[k] = P.out());
}

export function surfaceMat(T, o = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ map: T.map, bumpMap: T.bump, bumpScale: 2.2, roughnessMap: T.rough, roughness: 1, metalness: 0.55, emissiveMap: T.emissive, emissive: 0xffffff, emissiveIntensity: 1 }, o));
}

// ---------------------------------------------------------------- MERGED PART BUILDER
const MAT = {};
export function kitMats() {
  if (MAT.metal) return MAT;
  const S = (c, r, m, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
  Object.assign(MAT, {
    metal: S(0x4a5058, 0.42, 0.85), dark: S(0x1e2125, 0.55, 0.7), steel: S(0x8a8f96, 0.3, 0.95), black: S(0x0e0f10, 0.6, 0.4),
    paintGrey: S(0x5a6068, 0.55, 0.5), paintYellow: S(0xc8a020, 0.5, 0.3), paintRed: S(0x9a1a14, 0.45, 0.3), paintBlue: S(0x22406a, 0.5, 0.4), paintGreen: S(0x2e5a3a, 0.55, 0.3), paintOrange: S(0xc0601c, 0.5, 0.3),
    rubber: S(0x101010, 0.85, 0.0), copper: S(0xb06a3a, 0.35, 0.95), brass: S(0xb89040, 0.3, 0.95),
    grate: S(0x3a3e44, 0.5, 0.8),
    lightW: new THREE.MeshBasicMaterial({ color: 0xfff0d8 }), lightC: new THREE.MeshBasicMaterial({ color: 0xcfe6ff }), lightR: new THREE.MeshBasicMaterial({ color: 0xff2a14 }),
    lightG: new THREE.MeshBasicMaterial({ color: 0x40ff70 }), lightA: new THREE.MeshBasicMaterial({ color: 0xffa020 }), lightB: new THREE.MeshBasicMaterial({ color: 0x4aa8ff }), lightDim: new THREE.MeshBasicMaterial({ color: 0x5a3c14 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x334455, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.35, clearcoat: 1 }),
  });
  return MAT;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export class Kit {
  constructor() { this.parts = {}; this.M = kitMats(); this.custom = {}; }
  add(geo, mk, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    if (typeof mk !== "string") { this.custom[mk.uuid] = mk; mk = mk.uuid; }
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    _m.compose(_p.set(...p), _q.setFromEuler(_e.set(r[0], r[1], r[2], "YXZ")), _s.set(...s)); g.applyMatrix4(_m); (this.parts[mk] ||= []).push(g); return this;
  }
  box(w, h, d, mk, p, r) { return this.add(new THREE.BoxGeometry(w, h, d), mk, p, r); }
  rbox(w, h, d, rad, mk, p, r) { return this.add(new RoundedBoxGeometry(w, h, d, 2, rad), mk, p, r); }
  cyl(rt, rb, h, mk, p, r, seg = 12) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), mk, p, r); }
  // cylinder between two points
  rod(a, b, rad, mk, seg = 10) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length(); if (L < 1e-4) return this; _q.setFromUnitVectors(_up, d.normalize()); _e.setFromQuaternion(_q, "YXZ"); return this.add(new THREE.CylinderGeometry(rad, rad, L, seg), mk, A.add(B).multiplyScalar(0.5).toArray(), [_e.x, _e.y, _e.z]); }
  torus(r, t, mk, p, rot, seg = 20) { return this.add(new THREE.TorusGeometry(r, t, 6, seg), mk, p, rot); }
  build(parent) { const g = new THREE.Group(); for (const [mk, list] of Object.entries(this.parts)) { const geo = mergeGeometries(list, false); if (!geo) continue; const m = new THREE.Mesh(geo, this.M[mk] || this.custom[mk]); g.add(m); } parent.add(g); return g; }
}

// ---------------------------------------------------------------- DRESSING (everything works along a "run": a wall in local coords)
// A run is a straight wall from a to b (x/z), with the room interior on the left of a->b; parts are placed by
// (s along the wall in metres, y height, d out from the wall).
export function run(a, b) {
  const ax = a[0], az = a[1], dx = b[0] - ax, dz = b[1] - az, L = Math.hypot(dx, dz), tx = dx / L, tz = dz / L, nx = -tz, nz = tx;   // n = inward normal (left of travel)
  const ry = Math.atan2(nx, nz);          // rotation that turns +z to face the interior
  return { L, ry, at: (s, y, d = 0) => [ax + tx * s + nx * d, y, az + tz * s + nz * d], n: [nx, nz], t: [tx, tz] };
}
const inSkip = (s, w, skip) => skip.some(([a, b]) => s + w / 2 > a && s - w / 2 < b);

// structural ribs: chamfered columns with cap plates and bolt rows; optional ceiling knee braces
export function ribs(K, R, { H = 3.4, every = 2.4, from = 0, w = 0.32, d = 0.22, skip = [], knee = true, mk = "metal", bolt = 0.32, y0 = 0 } = {}) {
  const out = [];
  for (let s = from; s <= R.L + 1e-3; s += every) {
    if (inSkip(s, w, skip)) continue; out.push(s);
    const br = Math.max(0.016, w * 0.05);
    K.rbox(w, H, d, Math.min(0.03, w * 0.08), mk, R.at(s, y0 + H / 2, d / 2), [0, R.ry, 0]);
    K.box(w * 0.55, H - 0.2, 0.02, "dark", R.at(s, y0 + H / 2, d + 0.005), [0, R.ry, 0]);            // recessed web
    for (const y of [0.12, H - 0.12]) K.box(w + 0.08, 0.06 * Math.max(1, w * 3), d + 0.06, "dark", R.at(s, y0 + y, d / 2), [0, R.ry, 0]);
    for (let y = 0.35; y < H - 0.3; y += bolt) for (const o of [-1, 1]) K.cyl(br, br, br * 1.5, "steel", R.at(s + o * w * 0.36, y0 + y, d + br * 0.7), [Math.PI / 2, R.ry, 0], 6);
    if (knee) { const k = 0.45 * Math.max(1, w * 3); K.box(0.06 * Math.max(1, w * 3), k * 1.41, 0.12 * Math.max(1, w * 3), "metal", R.at(s, y0 + H - k / 2 - 0.05, d + k / 2 - 0.05), [-Math.PI / 4, R.ry, 0]); }
  }
  return out;
}
// pipe run along the wall at height y, d off the wall, with flanges, wall brackets, colour bands and a valve
export function pipeRun(K, R, { y, d = 0.18, r = 0.05, from = 0.2, to = null, mk = "paintGrey", band = "paintBlue", flange = 1.6, valve = true, skip = [] } = {}) {
  to = to ?? R.L - 0.2;
  K.rod(R.at(from, y, d), R.at(to, y, d), r, mk, 14);
  for (let s = from + 0.4; s < to - 0.2; s += flange) {
    K.cyl(r * 1.55, r * 1.55, 0.05, "steel", R.at(s, y, d), [0, R.ry, Math.PI / 2], 14);
    if (inSkip(s + flange / 2, 0.1, skip)) continue;
    K.box(0.04, r * 2.6, d + 0.02, "dark", R.at(s + flange / 2, y, d / 2), [0, R.ry, 0]);                           // bracket
    K.torus(r * 1.12, 0.012, "steel", R.at(s + flange / 2, y, d), [0, R.ry + Math.PI / 2, 0], 16);                 // clamp
    if (band) K.cyl(r * 1.06, r * 1.06, 0.12, band, R.at(s + flange * 0.28, y, d), [0, R.ry, Math.PI / 2], 14);
  }
  if (valve) { const s = from + (to - from) * 0.62; K.cyl(r * 1.7, r * 1.7, 0.16, "dark", R.at(s, y, d), [0, R.ry, Math.PI / 2], 14); K.rod(R.at(s, y, d), R.at(s, y, d + 0.16), 0.012, "steel"); K.torus(0.09, 0.012, "paintRed", R.at(s, y, d + 0.17), [0, R.ry, 0], 24); }
}
// bundle of thin conduits with junction boxes
export function conduits(K, R, { y, d = 0.07, n = 3, from = 0.2, to = null, skip = [] } = {}) {
  to = to ?? R.L - 0.2;
  for (let i = 0; i < n; i++) K.rod(R.at(from, y + i * 0.045, d), R.at(to, y + i * 0.045, d), 0.014, i === 1 ? "paintYellow" : "dark", 8);
  for (let s = from + 0.6; s < to - 0.3; s += 2.2) { if (inSkip(s, 0.3, skip)) continue; K.rbox(0.26, 0.2 + n * 0.03, 0.1, 0.012, "paintGrey", R.at(s, y + n * 0.02, d + 0.02), [0, R.ry, 0]); K.box(0.06, 0.03, 0.01, "lightG", R.at(s + 0.08, y + n * 0.02 + 0.06, d + 0.075), [0, R.ry, 0]); }
}
// cable tray along the wall top
export function cableTray(K, R, { y, d = 0.35, w = 0.4, from = 0, to = null } = {}) {
  to = to ?? R.L; const mid = (from + to) / 2, len = to - from;
  K.box(len, 0.02, w, "metal", R.at(mid, y, d), [0, R.ry + Math.PI / 2, 0]);
  for (const o of [-1, 1]) K.box(len, 0.08, 0.015, "metal", R.at(mid, y + 0.04, d + o * w / 2), [0, R.ry + Math.PI / 2, 0]);
  for (let i = 0; i < 5; i++) K.rod(R.at(from, y + 0.03, d - w * 0.35 + i * w * 0.17), R.at(to, y + 0.03, d - w * 0.35 + i * w * 0.17), 0.018, ["black", "paintRed", "black", "paintBlue", "black"][i], 6);
  for (let s = from + 0.6; s < to; s += 1.2) K.box(0.04, 0.3, 0.04, "dark", R.at(s, y + 0.16, d - w / 2 - 0.02), [0, R.ry, 0]);
}
// wall fixtures
export function junctionBox(K, R, s, y, { w = 0.42, h = 0.55, d = 0.16 } = {}) {
  K.rbox(w, h, d, 0.015, "paintGrey", R.at(s, y, d / 2), [0, R.ry, 0]); K.box(w * 0.86, h * 0.86, 0.01, "dark", R.at(s, y, d + 0.004), [0, R.ry, 0]);
  K.box(0.04, 0.1, 0.03, "steel", R.at(s + w * 0.36, y, d + 0.02), [0, R.ry, 0]); K.box(w * 0.5, 0.06, 0.012, "paintYellow", R.at(s, y + h * 0.36, d + 0.01), [0, R.ry, 0]);
  K.box(0.03, 0.03, 0.01, "lightG", R.at(s - w * 0.32, y - h * 0.32, d + 0.012), [0, R.ry, 0]); K.box(0.03, 0.03, 0.01, "lightA", R.at(s - w * 0.24, y - h * 0.32, d + 0.012), [0, R.ry, 0]);
  K.rod(R.at(s, y - h / 2, d / 2), R.at(s, 0.05, d / 2), 0.02, "dark", 8);
}
export function fireCabinet(K, R, s, y = 1.3) {
  K.rbox(0.5, 0.8, 0.22, 0.02, "paintRed", R.at(s, y, 0.11), [0, R.ry, 0]); K.box(0.36, 0.6, 0.01, "glass", R.at(s, y, 0.225), [0, R.ry, 0]);
  K.cyl(0.08, 0.08, 0.5, "paintRed", R.at(s, y - 0.02, 0.12), [0, R.ry, 0]); K.box(0.42, 0.06, 0.01, "lightW", R.at(s, y + 0.46, 0.18), [0, R.ry, 0]);
}
export function emergencyLight(K, R, s, y, col = "lightR") { K.rbox(0.3, 0.14, 0.12, 0.02, "dark", R.at(s, y, 0.06), [0, R.ry, 0]); K.box(0.22, 0.08, 0.02, col, R.at(s, y, 0.125), [0, R.ry, 0]); for (let i = -1; i <= 1; i++) K.box(0.005, 0.09, 0.025, "steel", R.at(s + i * 0.06, y, 0.13), [0, R.ry, 0]); }
export function wallVent(K, R, s, y, w = 0.7, h = 0.35) { K.box(w + 0.08, h + 0.08, 0.05, "dark", R.at(s, y, 0.025), [0, R.ry, 0]); for (let i = 0; i < Math.round(h / 0.05); i++) K.box(w, 0.02, 0.06, "metal", R.at(s, y - h / 2 + 0.03 + i * 0.05, 0.05), [-0.5, R.ry, 0]); }
export function intercom(K, R, s, y = 1.45) { K.rbox(0.18, 0.28, 0.06, 0.015, "paintGrey", R.at(s, y, 0.03), [0, R.ry, 0]); for (let i = 0; i < 4; i++) K.box(0.11, 0.008, 0.01, "black", R.at(s, y + 0.07 - i * 0.02, 0.065), [0, R.ry, 0]); K.box(0.06, 0.04, 0.012, "lightA", R.at(s, y - 0.08, 0.066), [0, R.ry, 0]); }
export function handrail(K, R, { y = 1.0, d = 0.08, from = 0.3, to = null, every = 1.2, skip = [] } = {}) {
  to = to ?? R.L - 0.3; K.rod(R.at(from, y, d), R.at(to, y, d), 0.022, "steel", 10);
  for (let s = from; s <= to + 1e-3; s += every) { if (inSkip(s, 0.1, skip)) continue; K.rod(R.at(s, y, d), R.at(s, y, 0), 0.015, "steel", 8); K.cyl(0.04, 0.04, 0.02, "steel", R.at(s, y, 0.01), [Math.PI / 2, R.ry, 0], 10); }
}
export function baseboard(K, R, { from = 0, to = null, skip = [] } = {}) {
  to = to ?? R.L;
  let s0 = from; const segs = []; for (const [a, b] of [...skip].sort((p, q) => p[0] - q[0])) { if (a > s0) segs.push([s0, Math.min(a, to)]); s0 = Math.max(s0, b); } if (s0 < to) segs.push([s0, to]);
  for (const [a, b] of segs) if (b - a > 0.05) { K.box(b - a, 0.14, 0.05, "dark", R.at((a + b) / 2, 0.07, 0.025), [0, R.ry + Math.PI / 2, 0]); K.box(b - a, 0.012, 0.055, "lightDim", R.at((a + b) / 2, 0.15, 0.028), [0, R.ry + Math.PI / 2, 0]); }
}
// a heavy door frame (hazard-striped jambs, header with status lights, keypad) around an opening of w x h at s
export function doorFrame(K, R, s, w = 1.5, h = 2.5, { lit = "lightG" } = {}) {
  const fw = 0.22;
  for (const o of [-1, 1]) { K.rbox(fw, h + fw, 0.24, 0.03, "metal", R.at(s + o * (w / 2 + fw / 2), (h + fw) / 2, 0.12), [0, R.ry, 0]); for (let y = 0.15; y < h; y += 0.24) K.box(fw * 0.8, 0.1, 0.01, y % 0.48 < 0.24 ? "paintYellow" : "black", R.at(s + o * (w / 2 + fw / 2), y, 0.245), [0, R.ry, o * 0.6]); }
  K.rbox(w + fw * 2 + 0.1, 0.3, 0.28, 0.03, "metal", R.at(s, h + 0.15, 0.14), [0, R.ry, 0]);
  for (let i = 0; i < 5; i++) K.box(0.1, 0.05, 0.01, i % 2 ? "lightA" : lit, R.at(s - 0.35 + i * 0.175, h + 0.15, 0.285), [0, R.ry, 0]);
  K.rbox(0.13, 0.2, 0.05, 0.01, "paintGrey", R.at(s + w / 2 + fw + 0.17, 1.35, 0.025), [0, R.ry, 0]); K.box(0.08, 0.06, 0.01, "lightB", R.at(s + w / 2 + fw + 0.17, 1.39, 0.052), [0, R.ry, 0]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) K.box(0.018, 0.012, 0.008, "black", R.at(s + w / 2 + fw + 0.14 + i * 0.03, 1.32 - j * 0.022, 0.052), [0, R.ry, 0]);
}
// placard sign (canvas) facing out of the wall
export function signPlate(parent, R, s, y, text, sub = "", { w = 1.2, h = 0.26, col = "#e8c060", bg = "#101318" } = {}) {
  const c = cv(512, Math.round(512 * h / w)), x = c.getContext("2d"); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = col; x.lineWidth = 6; x.strokeRect(5, 5, c.width - 10, c.height - 10);
  x.fillStyle = col; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `700 ${Math.round(c.height * (sub ? 0.42 : 0.55))}px 'Chakra Petch', 'DejaVu Sans', sans-serif`; x.fillText(text, c.width / 2, c.height * (sub ? 0.38 : 0.52));
  if (sub) { x.font = `${Math.round(c.height * 0.2)}px 'Share Tech Mono', monospace`; x.fillStyle = "rgba(230,225,210,.8)"; x.fillText(sub, c.width / 2, c.height * 0.76); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.3 }));
  m.position.set(...R.at(s, y, 0.03)); m.rotation.y = R.ry; parent.add(m);
  const K = new Kit(); K.box(w + 0.04, h + 0.04, 0.025, "dark", R.at(s, y, 0.012), [0, R.ry, 0]); for (const o of [-1, 1]) for (const v of [-1, 1]) K.cyl(0.01, 0.01, 0.01, "steel", R.at(s + o * (w / 2 - 0.02), y + v * (h / 2 - 0.02), 0.036), [Math.PI / 2, R.ry, 0], 6); K.build(parent);
  return m;
}
// a wall: a plane facing the interior with the bulkhead texture tiled bay by bay
export function wallPlane(parent, R, H, tex, { y0 = 0, bay = 2.4, tileH = 0, mat = null } = {}) {
  const g = new THREE.PlaneGeometry(R.L, H); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * R.L / bay, tileH ? uv.getY(i) * H / tileH : uv.getY(i));
  const m = new THREE.Mesh(g, mat || surfaceMat(tex)); m.position.set(...R.at(R.L / 2, y0 + H / 2, 0)); m.rotation.y = R.ry; parent.add(m); return m;
}
export function floorPlane(parent, x0, x1, z0, z1, y, tex, tile = 4, o = {}) {
  const w = x1 - x0, d = z1 - z0, g = new THREE.PlaneGeometry(w, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  const m = new THREE.Mesh(g, surfaceMat(tex, { metalness: 0.6, bumpScale: 1.6, ...o })); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); parent.add(m); return m;
}
export function ceilingPlane(parent, x0, x1, z0, z1, y, tex, tile = 2.4) {
  const w = x1 - x0, d = z1 - z0, g = new THREE.PlaneGeometry(w, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  const m = new THREE.Mesh(g, surfaceMat(tex, { metalness: 0.4, emissiveIntensity: 1.4 })); m.rotation.x = Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); parent.add(m); return m;
}
// overhead beam (I-section) between two points at ceiling height
export function iBeam(K, a, b, { h = 0.3, w = 0.18, mk = "metal" } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B), mid = A.clone().add(B).multiplyScalar(0.5), ry = Math.atan2(B.x - A.x, B.z - A.z);
  K.box(w, 0.03, L, mk, [mid.x, mid.y + h / 2 - 0.015, mid.z], [0, ry, 0]); K.box(w, 0.03, L, mk, [mid.x, mid.y - h / 2 + 0.015, mid.z], [0, ry, 0]); K.box(0.02, h, L, "dark", mid.toArray(), [0, ry, 0]);
  for (let t = 0.6; t < L - 0.3; t += 0.9) { const p = A.clone().lerp(B, t / L); for (const o of [-1, 1]) K.box(0.012, h - 0.06, 0.04, "metal", [p.x + Math.cos(ry) * o * 0.05, p.y, p.z - Math.sin(ry) * o * 0.05], [0, ry, 0]); }
}
// a lit ceiling fixture: housing with diffuser
export function ceilingLight(K, p, { w = 1.2, d = 0.3, mk = "lightW" } = {}) {
  K.rbox(w + 0.12, 0.08, d + 0.12, 0.02, "dark", [p[0], p[1] - 0.04, p[2]]); K.box(w, 0.02, d, mk, [p[0], p[1] - 0.085, p[2]]);
  for (let i = 1; i < 4; i++) K.box(0.015, 0.025, d, "metal", [p[0] - w / 2 + w * i / 4, p[1] - 0.09, p[2]]);
}
