// HALCYON WING — panel greebling. Paints a cockpit surface as a dense patchwork of fastened
// metal plates (colour + height + roughness + emissive, painted in lockstep) and reports where
// the 3D hardware (toggles, guards, knobs, breakers) should stand.
import * as THREE from "three";

function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function rnd(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function col(hex, k, add = 0) { const c = new THREE.Color(hex); c.multiplyScalar(k); c.r += add; c.g += add; c.b += add; return "#" + c.getHexString(); }

const LBL = ["HYD 1", "HYD 2", "O2 REG", "FUEL XFER", "AUX PWR", "BUS TIE", "INV", "CAP 1", "CAP 2", "ECM PWR", "IFF", "NAV", "LT TEST", "CMPTR", "GEN", "APU", "PITOT", "DEICE", "COOL", "PURGE", "FLT CTL", "RADAR", "TACAN", "MSL PWR", "GUN HTR", "SHLD A", "SHLD B", "BATT", "XMIT", "ANTI-G", "CABIN", "VENT", "REACT", "SYNC", "DAMP", "TRIM", "SEQ", "ARM", "SAFE", "JETT"];
const CAUT = [["CAUTION", "HIGH VOLTAGE"], ["WARNING", "DO NOT OPEN IN FLIGHT"], ["CAUTION", "HOT SURFACE"], ["NO STEP"], ["CAUTION", "VERIFY SAFE"], ["DANGER", "EJECTION SYSTEM"]];

export function paintGreebles(T, w, h, seed, opts = {}) {
  const R = rnd(seed);
  const C = cv(w, h), x = C.getContext("2d");          // albedo
  const Hc = cv(w, h), hx = Hc.getContext("2d");       // height (bump)
  const Rc = cv(w, h), rx = Rc.getContext("2d");       // roughness (green channel)
  const Ec = cv(w, h), ex = Ec.getContext("2d");       // emissive
  const S = opts.scale || 1;                            // px per mm-ish
  const base = T.panel, dark = T.panel2;
  x.fillStyle = col(base, 0.55); x.fillRect(0, 0, w, h);
  hx.fillStyle = "#222"; hx.fillRect(0, 0, w, h);
  rx.fillStyle = "rgb(0,150,0)"; rx.fillRect(0, 0, w, h);
  ex.fillStyle = "#000"; ex.fillRect(0, 0, w, h);
  const spots = [];

  // ---- helpers that draw to all layers
  const rect = (X, Y, W_, H_, c, hgt, rough) => { x.fillStyle = c; x.fillRect(X, Y, W_, H_); if (hgt != null) { hx.fillStyle = `rgb(${hgt},${hgt},${hgt})`; hx.fillRect(X, Y, W_, H_); } if (rough != null) { rx.fillStyle = `rgb(0,${rough},0)`; rx.fillRect(X, Y, W_, H_); } };
  const circ = (X, Y, r, c, hgt, rough) => { x.fillStyle = c; x.beginPath(); x.arc(X, Y, r, 0, 7); x.fill(); if (hgt != null) { hx.fillStyle = `rgb(${hgt},${hgt},${hgt})`; hx.beginPath(); hx.arc(X, Y, r, 0, 7); hx.fill(); } if (rough != null) { rx.fillStyle = `rgb(0,${rough},0)`; rx.beginPath(); rx.arc(X, Y, r, 0, 7); rx.fill(); } };
  const screw = (X, Y, r, kind) => {
    circ(X, Y, r + 1.2 * S, "rgba(0,0,0,.55)", 70);                       // countersink shadow
    const g = x.createRadialGradient(X - r * 0.35, Y - r * 0.35, 0, X, Y, r); g.addColorStop(0, "#c9cbcc"); g.addColorStop(1, "#5d6064");
    x.fillStyle = g; x.beginPath(); x.arc(X, Y, r, 0, 7); x.fill(); hx.fillStyle = "#bbb"; hx.beginPath(); hx.arc(X, Y, r, 0, 7); hx.fill(); rx.fillStyle = "rgb(0,90,0)"; rx.beginPath(); rx.arc(X, Y, r, 0, 7); rx.fill();
    const a = R() * 3; x.strokeStyle = "#1c1d1f"; hx.strokeStyle = "#555"; x.lineWidth = hx.lineWidth = Math.max(1, r * 0.32);
    const cr = (ctx) => { ctx.beginPath(); ctx.moveTo(X - Math.cos(a) * r * 0.7, Y - Math.sin(a) * r * 0.7); ctx.lineTo(X + Math.cos(a) * r * 0.7, Y + Math.sin(a) * r * 0.7); if (kind !== "slot") { ctx.moveTo(X - Math.sin(a) * r * 0.7, Y + Math.cos(a) * r * 0.7); ctx.lineTo(X + Math.sin(a) * r * 0.7, Y - Math.cos(a) * r * 0.7); } ctx.stroke(); };
    if (kind === "hex") { x.fillStyle = "#26282b"; hx.fillStyle = "#666"; for (const ctx of [x, hx]) { ctx.beginPath(); for (let k = 0; k < 6; k++) ctx.lineTo(X + Math.cos(a + k * 1.047) * r * 0.5, Y + Math.sin(a + k * 1.047) * r * 0.5); ctx.fill(); } }
    else { cr(x); cr(hx); }
  };
  const rivet = (X, Y, r) => { circ(X, Y, r + 0.8 * S, "rgba(0,0,0,.35)", 110); const g = x.createRadialGradient(X - r * 0.4, Y - r * 0.4, 0, X, Y, r); g.addColorStop(0, col(base, 1.25, 0.08)); g.addColorStop(1, col(base, 0.6)); x.fillStyle = g; x.beginPath(); x.arc(X, Y, r, 0, 7); x.fill(); hx.fillStyle = "#c8c8c8"; hx.beginPath(); hx.arc(X, Y, r, 0, 7); hx.fill(); };
  const text = (t, X, Y, size, c = "rgba(232,228,214,.9)", align = "left", font = "'Share Tech Mono', 'DejaVu Sans Mono', monospace") => { x.font = `bold ${size}px ${font}`; x.textAlign = align; x.textBaseline = "middle"; x.fillStyle = c; x.fillText(t, X, Y); hx.font = x.font; hx.textAlign = align; hx.textBaseline = "middle"; hx.fillStyle = "rgba(160,160,160,.5)"; hx.fillText(t, X, Y); };
  const led = (X, Y, ww, hh, c, on) => { rect(X - 1, Y - 1, ww + 2, hh + 2, "#0a0a0a", 90); rect(X, Y, ww, hh, on ? c : col(c, 0.18), 140, 40); if (on) { ex.fillStyle = c; ex.fillRect(X, Y, ww, hh); } };

  // ---- plate content painters
  const kinds = {
    grille(X, Y, W_, H_) {
      const m = 10 * S; rect(X + m, Y + m, W_ - 2 * m, H_ - 2 * m, "#0c0d0e", 40, 220);
      const vert = W_ > H_ * 1.3, step = 7 * S;
      if (vert) for (let i = X + m + step * 0.6; i < X + W_ - m - 2; i += step) { rect(i, Y + m + 2, step * 0.45, H_ - 2 * m - 4, col(base, 0.7), 150); rect(i, Y + m + 2, 1.2 * S, H_ - 2 * m - 4, col(base, 1.1, 0.05)); }
      else for (let i = Y + m + step * 0.6; i < Y + H_ - m - 2; i += step) { rect(X + m + 2, i, W_ - 2 * m - 4, step * 0.45, col(base, 0.7), 150); rect(X + m + 2, i, W_ - 2 * m - 4, 1.2 * S, col(base, 1.1, 0.05)); }
    },
    annun(X, Y, W_, H_) {                               // annunciator / push-button matrix
      const cw = 46 * S, ch = 30 * S, nx = Math.max(1, Math.floor((W_ - 16 * S) / cw)), ny = Math.max(1, Math.floor((H_ - 16 * S) / ch));
      const ox = X + (W_ - nx * cw) / 2, oy = Y + (H_ - ny * ch) / 2;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const bx = ox + i * cw + 3 * S, by = oy + j * ch + 3 * S, bw = cw - 6 * S, bh = ch - 6 * S;
        rect(bx - 1.5 * S, by - 1.5 * S, bw + 3 * S, bh + 3 * S, "#070708", 60);
        const lit = R() < 0.3, c = [T.led, "#ff3a20", "#40ff70", "#ffd040", "#e8e8e8"][(R() * 5) | 0];
        rect(bx, by, bw, bh, lit ? col(c, 0.55) : "#1a1b1d", 190, 50);
        if (lit) { ex.fillStyle = col(c, 0.75); ex.fillRect(bx, by, bw, bh); }
        x.font = `bold ${Math.round(9 * S)}px 'Share Tech Mono', monospace`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = lit ? "#111" : "rgba(220,220,210,.55)"; x.fillText(LBL[(R() * LBL.length) | 0].slice(0, 6), bx + bw / 2, by + bh / 2);
        if (lit) { ex.font = x.font; ex.textAlign = "center"; ex.textBaseline = "middle"; ex.fillStyle = "#000"; ex.fillText("", 0, 0); }
      }
    },
    breakers(X, Y, W_, H_) {                            // circuit breaker rows (3D caps added later)
      const st = 26 * S, n = Math.max(1, Math.floor((W_ - 20 * S) / st)), rows = Math.max(1, Math.min(3, Math.floor((H_ - 16 * S) / (34 * S))));
      const ox = X + (W_ - n * st) / 2 + st / 2;
      for (let r = 0; r < rows; r++) { const yy = Y + H_ * (r + 0.5) / rows;
        for (let i = 0; i < n; i++) { const cx = ox + i * st; circ(cx, yy, 8 * S, "#0b0b0c", 60); circ(cx, yy, 6 * S, "#202124", 160); circ(cx, yy - 0.5, 2.2 * S, "#e9e9e9", 180);
          x.font = `${Math.round(7 * S)}px 'Share Tech Mono', monospace`; x.textAlign = "center"; x.fillStyle = "rgba(230,228,215,.75)"; x.fillText(String(5 + ((R() * 30) | 0)), cx, yy + 13 * S);
          spots.push({ kind: "breaker", u: cx / w, v: yy / h }); } }
      text(LBL[(R() * LBL.length) | 0], X + 12 * S, Y + 10 * S, 9 * S);
    },
    toggles(X, Y, W_, H_) {
      const st = 40 * S, n = Math.max(1, Math.min(6, Math.floor((W_ - 20 * S) / st))), ox = X + (W_ - n * st) / 2 + st / 2, yy = Y + H_ * 0.55;
      for (let i = 0; i < n; i++) { const cx = ox + i * st; circ(cx, yy, 9 * S, "#111214", 120); circ(cx, yy, 6 * S, "#8c8f93", 170, 70);
        text(LBL[(R() * LBL.length) | 0].split(" ")[0], cx, yy - 19 * S, 8 * S, "rgba(232,228,214,.85)", "center"); text("ON", cx, yy + 16 * S, 6.5 * S, "rgba(232,228,214,.6)", "center");
        spots.push({ kind: R() < 0.2 ? "guard" : "toggle", u: cx / w, v: yy / h }); }
    },
    knobs(X, Y, W_, H_) {
      const n = Math.max(1, Math.min(3, Math.floor(W_ / (70 * S))));
      for (let i = 0; i < n; i++) { const cx = X + W_ * (i + 0.5) / n, cy = Y + H_ * 0.52, r = Math.min(26 * S, H_ * 0.3);
        for (let k = 0; k <= 10; k++) { const a = Math.PI * 0.75 + k / 10 * Math.PI * 1.5; x.strokeStyle = "rgba(232,228,214,.8)"; x.lineWidth = 1.2 * S; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * 1.15); x.lineTo(cx + Math.cos(a) * r * (k % 5 ? 1.28 : 1.4), cy + Math.sin(a) * r * (k % 5 ? 1.28 : 1.4)); x.stroke(); }
        circ(cx, cy, r, "#0e0e10", 90); text(LBL[(R() * LBL.length) | 0], cx, cy + r * 1.75, 8 * S, "rgba(232,228,214,.85)", "center");
        spots.push({ kind: "knob", u: cx / w, v: cy / h, r: r / w }); }
    },
    dial(X, Y, W_, H_) {
      const r = Math.min(W_, H_) * 0.36, cx = X + W_ / 2, cy = Y + H_ / 2;
      circ(cx, cy, r + 5 * S, "#121214", 160); circ(cx, cy, r, "#0b100d", 110, 30);
      for (let k = 0; k <= 12; k++) { const a = Math.PI * 0.75 + k / 12 * Math.PI * 1.5; x.strokeStyle = "rgba(225,232,220,.8)"; x.lineWidth = 1.4 * S; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78); x.lineTo(cx + Math.cos(a) * r * 0.93, cy + Math.sin(a) * r * 0.93); x.stroke(); }
      const a = Math.PI * 0.75 + R() * Math.PI * 1.5; x.strokeStyle = T.accent; x.lineWidth = 2.2 * S; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); x.stroke();
      ex.strokeStyle = col(T.accent, 0.6); ex.lineWidth = 2.2 * S; ex.beginPath(); ex.moveTo(cx, cy); ex.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); ex.stroke();
      x.fillStyle = "rgba(255,255,255,.1)"; x.beginPath(); x.ellipse(cx - r * 0.3, cy - r * 0.4, r * 0.45, r * 0.2, -0.5, 0, 7); x.fill();
      text(LBL[(R() * LBL.length) | 0], cx, cy + r * 0.45, 7 * S, "rgba(225,232,220,.7)", "center");
      for (let k = 0; k < 4; k++) screw(cx + Math.cos(k * 1.571 + 0.785) * (r + 13 * S), cy + Math.sin(k * 1.571 + 0.785) * (r + 13 * S), 3 * S, "slot");
    },
    caution(X, Y, W_, H_) {
      const t = CAUT[(R() * CAUT.length) | 0], pw = Math.min(W_ - 20 * S, 150 * S), ph = t.length > 1 ? 34 * S : 22 * S, px = X + (W_ - pw) / 2, py = Y + (H_ - ph) / 2;
      const yel = t[0] === "DANGER" ? "#c8261e" : "#d6ae22";
      rect(px - 1, py - 1, pw + 2, ph + 2, "#111", 150); rect(px, py, pw, ph, yel, 160, 120);
      text(t[0], px + pw / 2, py + (t.length > 1 ? 10 * S : ph / 2), 10 * S, t[0] === "DANGER" ? "#fff" : "#111", "center", "'Chakra Petch', 'DejaVu Sans', sans-serif");
      if (t[1]) text(t[1], px + pw / 2, py + 24 * S, 7.5 * S, t[0] === "DANGER" ? "#fff" : "#111", "center");
      for (const [sx, sy] of [[px + 4 * S, py + 4 * S], [px + pw - 4 * S, py + 4 * S], [px + 4 * S, py + ph - 4 * S], [px + pw - 4 * S, py + ph - 4 * S]]) rivet(sx, sy, 1.6 * S);
    },
    hatch(X, Y, W_, H_) {                               // access panel with quarter-turn fasteners
      const m = 12 * S; x.strokeStyle = "rgba(0,0,0,.7)"; x.lineWidth = 2.5 * S; x.strokeRect(X + m, Y + m, W_ - 2 * m, H_ - 2 * m); hx.strokeStyle = "#111"; hx.lineWidth = 2.5 * S; hx.strokeRect(X + m, Y + m, W_ - 2 * m, H_ - 2 * m);
      x.strokeStyle = col(base, 1.2, 0.04); x.lineWidth = 1; x.strokeRect(X + m + 2 * S, Y + m + 2 * S, W_ - 2 * m - 4 * S, H_ - 2 * m - 4 * S);
      for (const [fx, fy] of [[X + m + 10 * S, Y + H_ / 2], [X + W_ - m - 10 * S, Y + H_ / 2]]) { circ(fx, fy, 6 * S, "#2a2b2e", 170, 80); x.strokeStyle = "#0b0b0b"; x.lineWidth = 2 * S; x.beginPath(); x.moveTo(fx - 4 * S, fy); x.lineTo(fx + 4 * S, fy); x.stroke(); }
      text(`ACCESS ${10 + ((R() * 80) | 0)}${"LRC"[(R() * 3) | 0]}`, X + W_ / 2, Y + H_ / 2, 9 * S, "rgba(232,228,214,.55)", "center", "'Chakra Petch', 'DejaVu Sans', sans-serif");
    },
    data(X, Y, W_, H_) {                                // engraved data plate
      const pw = Math.min(W_ - 24 * S, 130 * S), ph = Math.min(H_ - 20 * S, 44 * S), px = X + (W_ - pw) / 2, py = Y + (H_ - ph) / 2;
      const g = x.createLinearGradient(px, py, px + pw, py + ph); g.addColorStop(0, "#a9adb1"); g.addColorStop(1, "#7d8186"); x.fillStyle = g; x.fillRect(px, py, pw, ph); hx.fillStyle = "#aaa"; hx.fillRect(px, py, pw, ph); rx.fillStyle = "rgb(0,70,0)"; rx.fillRect(px, py, pw, ph);
      text(T.label, px + 8 * S, py + ph * 0.3, 8 * S, "#16181b"); text(`S/N ${1000 + ((R() * 9000) | 0)}-${(R() * 99) | 0}  CNS`, px + 8 * S, py + ph * 0.7, 6.5 * S, "#16181b");
      for (const [sx, sy] of [[px + 3.5 * S, py + 3.5 * S], [px + pw - 3.5 * S, py + 3.5 * S], [px + 3.5 * S, py + ph - 3.5 * S], [px + pw - 3.5 * S, py + ph - 3.5 * S]]) rivet(sx, sy, 1.5 * S);
    },
    tape(X, Y, W_, H_) {                                // vertical/horizontal LED bar indicators
      const n = Math.max(2, Math.min(6, Math.floor(W_ / (22 * S)))), bw = 9 * S, bh = H_ - 40 * S;
      for (let i = 0; i < n; i++) { const bx = X + W_ * (i + 0.5) / n - bw / 2, by = Y + 14 * S; rect(bx - 2 * S, by - 2 * S, bw + 4 * S, bh + 4 * S, "#060606", 70);
        const lvl = 0.3 + R() * 0.7, segs = Math.max(4, Math.floor(bh / (6 * S)));
        for (let k = 0; k < segs; k++) { const on = k / segs < lvl, c = k / segs > 0.85 ? "#ff3a20" : k / segs > 0.65 ? "#ffd040" : "#40ff70"; const sy = by + bh - (k + 1) * bh / segs; rect(bx, sy + 0.8 * S, bw, bh / segs - 1.6 * S, on ? col(c, 0.6) : "#141414", 130, 40); if (on) { ex.fillStyle = col(c, 0.7); ex.fillRect(bx, sy + 0.8 * S, bw, bh / segs - 1.6 * S); } }
        text(["FUEL", "PWR", "TEMP", "SHLD", "AMMO", "O2"][(R() * 6) | 0], bx + bw / 2, Y + H_ - 13 * S, 7 * S, "rgba(232,228,214,.8)", "center"); }
    },
    blank(X, Y, W_, H_) {
      text(`P-${100 + ((R() * 800) | 0)}`, X + W_ - 10 * S, Y + H_ - 10 * S, 7 * S, "rgba(232,228,214,.35)", "right");
      if (R() < 0.5) { const n = Math.floor((W_ - 20 * S) / (14 * S)); for (let i = 0; i < n; i++) rivet(X + 10 * S + i * 14 * S + 7 * S, Y + H_ - 22 * S, 1.6 * S); }
    },
  };
  const weights = opts.weights || { annun: 3, breakers: 2, toggles: 3, knobs: 1.5, dial: 1.2, grille: 2, caution: 1, hatch: 1.4, data: 0.7, tape: 1.2, blank: 0.8 };
  const pick = (W_, H_) => {
    let tot = 0; const ok = Object.entries(weights).filter(([k]) => !((k === "dial" || k === "knobs") && Math.min(W_, H_) < 70 * S) && !(k === "tape" && H_ < 80 * S) && !(k === "toggles" && (W_ < 50 * S || H_ < 56 * S)) && !(k === "breakers" && H_ < 40 * S));
    ok.forEach(([, v]) => tot += v); let r = R() * tot; for (const [k, v] of ok) { if ((r -= v) <= 0) return k; } return "blank";
  };

  const seam = 3 * S;
  const brushed = (X, Y, W_, H_, c) => {
    x.fillStyle = c; x.fillRect(X, Y, W_, H_);
    for (let i = 0; i < H_ / 1.5; i++) { x.fillStyle = `rgba(${R() < 0.5 ? "255,255,255" : "0,0,0"},${0.01 + R() * 0.025})`; x.fillRect(X, Y + R() * H_, W_, 1); }
    const g = x.createLinearGradient(X, Y, X, Y + H_); g.addColorStop(0, "rgba(255,255,255,.05)"); g.addColorStop(1, "rgba(0,0,0,.1)"); x.fillStyle = g; x.fillRect(X, Y, W_, H_);
  };
  const clipAll = (X, Y, W_, H_) => { for (const c of [x, hx, rx, ex]) { c.save(); c.beginPath(); c.rect(X, Y, W_, H_); c.clip(); } };
  const unclip = () => { for (const c of [x, hx, rx, ex]) c.restore(); };
  const plates = [];
  if (opts.modules) {
    // ---- structured mode: plain painted skin with a few structural seams, then framed modules
    brushed(0, 0, w, h, col(base, 0.95)); hx.fillStyle = "#808080"; hx.fillRect(0, 0, w, h); rx.fillStyle = "rgb(0,135,0)"; rx.fillRect(0, 0, w, h);
    for (const sx of opts.seamsX || []) { x.fillStyle = "rgba(0,0,0,.7)"; x.fillRect(sx - seam / 2, 0, seam, h); hx.fillStyle = "#151515"; hx.fillRect(sx - seam / 2, 0, seam, h); x.fillStyle = "rgba(255,255,255,.1)"; x.fillRect(sx + seam / 2, 0, 1.2 * S, h);
      for (let yy = 18 * S; yy < h - 10 * S; yy += 90 * S) { rivet(sx - 9 * S, yy, 2 * S); rivet(sx + 9 * S, yy, 2 * S); } }
    for (const sy of opts.seamsY || []) { x.fillStyle = "rgba(0,0,0,.7)"; x.fillRect(0, sy - seam / 2, w, seam); hx.fillStyle = "#151515"; hx.fillRect(0, sy - seam / 2, w, seam); x.fillStyle = "rgba(255,255,255,.1)"; x.fillRect(0, sy + seam / 2, w, 1.2 * S);
      for (let xx = 18 * S; xx < w - 10 * S; xx += 90 * S) rivet(xx, sy + 9 * S, 2 * S); }
    // doubler plates around instrument housings: seam outline, bevel, screws on a regular pitch
    for (const F of opts.frames || []) { const { x: X, y: Y, w: W_, h: H_ } = F;
      x.strokeStyle = "rgba(0,0,0,.75)"; x.lineWidth = seam; x.strokeRect(X, Y, W_, H_); hx.strokeStyle = "#151515"; hx.lineWidth = seam; hx.strokeRect(X, Y, W_, H_);
      x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 1.2 * S; x.strokeRect(X + seam, Y + seam, W_ - 2 * seam, H_ - 2 * seam);
      const pitch = 55 * S, sm = 9 * S;
      for (let xx = X + sm; xx <= X + W_ - sm + 1; xx += (W_ - 2 * sm) / Math.max(1, Math.round((W_ - 2 * sm) / pitch))) { screw(xx, Y + sm, 2.6 * S, "phil"); screw(xx, Y + H_ - sm, 2.6 * S, "phil"); }
      for (let yy = Y + sm; yy <= Y + H_ - sm + 1; yy += (H_ - 2 * sm) / Math.max(1, Math.round((H_ - 2 * sm) / pitch))) { screw(X + sm, yy, 2.6 * S, "phil"); screw(X + W_ - sm, yy, 2.6 * S, "phil"); } }
    for (const [X, Y, W_, H_] of opts.shade || []) { x.fillStyle = "rgba(0,0,0,.38)"; x.fillRect(X, Y, W_, H_); }
    for (const [X, Y, W_, H_] of opts.dark || []) { x.fillStyle = "#08090a"; x.fillRect(X, Y, W_, H_); hx.fillStyle = "#000"; hx.fillRect(X, Y, W_, H_); rx.fillStyle = "rgb(0,230,0)"; rx.fillRect(X, Y, W_, H_); }
    for (const M of opts.modules) {
      const { x: X, y: Y, w: W_, h: H_, kind } = M;
      // recessed frame gap, then the module plate with bevel and four fasteners
      x.fillStyle = "rgba(0,0,0,.8)"; x.fillRect(X - seam, Y - seam, W_ + 2 * seam, H_ + 2 * seam); hx.fillStyle = "#101010"; hx.fillRect(X - seam, Y - seam, W_ + 2 * seam, H_ + 2 * seam);
      brushed(X, Y, W_, H_, col(M.dark ? dark : base, M.dark ? 0.85 : 0.82 + R() * 0.1)); hx.fillStyle = "#9a9a9a"; hx.fillRect(X, Y, W_, H_); rx.fillStyle = `rgb(0,${110 + ((R() * 30) | 0)},0)`; rx.fillRect(X, Y, W_, H_);
      x.fillStyle = "rgba(255,255,255,.16)"; x.fillRect(X, Y, W_, 1.5 * S); x.fillRect(X, Y, 1.5 * S, H_); x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(X, Y + H_ - 2 * S, W_, 2 * S); x.fillRect(X + W_ - 2 * S, Y, 2 * S, H_);
      const sm = 7 * S; if (W_ > 50 * S && H_ > 40 * S) for (const [sx, sy] of [[X + sm, Y + sm], [X + W_ - sm, Y + sm], [X + sm, Y + H_ - sm], [X + W_ - sm, Y + H_ - sm]]) screw(sx, sy, 2.8 * S, "phil");
      const m = 15 * S; clipAll(X + m * 0.6, Y + m * 0.6, W_ - m * 1.2, H_ - m * 1.2);
      if (kinds[kind]) kinds[kind](X + m, Y + m * 0.8, W_ - 2 * m, H_ - 1.6 * m, M);
      unclip();
    }
  } else {
  // ---- BSP plate layout (legacy)
  const split = (X, Y, W_, H_, d) => {
    const minS = (opts.minPlate || 70) * S, maxS = (opts.maxPlate || 260) * S;
    const canV = W_ > minS * 2, canH = H_ > minS * 2;
    if ((!canV && !canH) || (d > 2 && W_ < maxS && H_ < maxS && R() < 0.45)) { plates.push([X, Y, W_, H_]); return; }
    const vert = canV && (!canH || W_ / H_ > 1.2 || (W_ / H_ > 0.8 && R() < 0.5));
    if (vert) { const s = Math.round(W_ * (0.3 + R() * 0.4)); split(X, Y, s, H_, d + 1); split(X + s, Y, W_ - s, H_, d + 1); }
    else { const s = Math.round(H_ * (0.3 + R() * 0.4)); split(X, Y, W_, s, d + 1); split(X, Y + s, W_, H_ - s, d + 1); }
  };
  for (const [X, Y, W_, H_] of opts.regions || [[0, 0, w, h]]) split(X, Y, W_, H_, 0);
  for (const [X, Y, W_, H_] of plates) {
    const k = 0.85 + R() * 0.25, inset = R() < 0.22;            // some plates are recessed and darker
    brushed(X, Y, W_, H_, col(inset ? dark : base, k * (inset ? 0.9 : 1)));
    hx.fillStyle = inset ? "#6a6a6a" : "#808080"; hx.fillRect(X, Y, W_, H_);
    rx.fillStyle = `rgb(0,${inset ? 170 : 120 + ((R() * 40) | 0)},0)`; rx.fillRect(X, Y, W_, H_);
    // seam: dark recessed gap + highlight bevel on the upper/left edge, worn bare metal on corners
    x.fillStyle = "rgba(0,0,0,.85)"; x.fillRect(X, Y, W_, seam); x.fillRect(X, Y, seam, H_);
    hx.fillStyle = "#101010"; hx.fillRect(X, Y, W_, seam); hx.fillRect(X, Y, seam, H_);
    x.fillStyle = "rgba(255,255,255,.14)"; x.fillRect(X + seam, Y + seam, W_ - seam, 1.2 * S); x.fillRect(X + seam, Y + seam, 1.2 * S, H_ - seam);
    x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(X + seam, Y + H_ - 1.5 * S, W_ - seam, 1.5 * S); x.fillRect(X + W_ - 1.5 * S, Y + seam, 1.5 * S, H_ - seam);
    if (W_ > 40 * S && H_ > 40 * S) {
      const sr = 3.4 * S, m = 8 * S, kind = ["phil", "hex", "phil", "slot"][(R() * 4) | 0];
      for (const [sx, sy] of [[X + m, Y + m], [X + W_ - m, Y + m], [X + m, Y + H_ - m], [X + W_ - m, Y + H_ - m]]) screw(sx, sy, sr, kind);
      if (W_ > 200 * S) { screw(X + W_ / 2, Y + m, sr, kind); screw(X + W_ / 2, Y + H_ - m, sr, kind); }
      if (H_ > 200 * S) { screw(X + m, Y + H_ / 2, sr, kind); screw(X + W_ - m, Y + H_ / 2, sr, kind); }
    }
    const kind = pick(W_, H_); kinds[kind](X + 6 * S, Y + 6 * S, W_ - 12 * S, H_ - 12 * S);
    if (kind === "blank" || kind === "hatch" || kind === "grille") spots.push({ kind: "plate", u: (X + W_ / 2) / w, v: (Y + H_ / 2) / h, pw: W_ / w, ph: H_ / h });
    // subtle wear: polished bare metal at exposed corners
    for (let i = 0; i < 3; i++) { const cx = R() < 0.5 ? X + seam : X + W_, cy = R() < 0.5 ? Y + seam : Y + H_; const g = x.createRadialGradient(cx, cy, 0, cx, cy, 14 * S); g.addColorStop(0, "rgba(200,200,195,.12)"); g.addColorStop(1, "rgba(200,200,195,0)"); x.fillStyle = g; x.fillRect(cx - 14 * S, cy - 14 * S, 28 * S, 28 * S); }
  }
  }
  // hazard border strips where asked (e.g. around the eject handle / centre pod)
  for (const [X, Y, W_, H_] of opts.hazard || []) { x.save(); x.beginPath(); x.rect(X, Y, W_, H_); x.clip(); x.fillStyle = "#151515"; x.fillRect(X, Y, W_, H_); x.fillStyle = "#d6ae22"; for (let i = -H_; i < W_ + H_; i += 20 * S) { x.beginPath(); x.moveTo(X + i, Y); x.lineTo(X + i + 10 * S, Y); x.lineTo(X + i + 10 * S - H_, Y + H_); x.lineTo(X + i - H_, Y + H_); x.fill(); } x.restore(); }
  for (const [tx, ty, t, s] of opts.labels || []) text(t, tx, ty, s, "rgba(235,225,205,.85)", "left", "'Chakra Petch', 'DejaVu Sans', sans-serif");

  const mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  // soften the height a touch so bump lighting reads as bevels, not stairs
  const Hs = cv(w, h), hs = Hs.getContext("2d"); hs.filter = `blur(${Math.max(0.6, 0.8 * S)}px)`; hs.drawImage(Hc, 0, 0);
  return { map: mk(C, true), bump: mk(Hs), rough: mk(Rc), emissive: mk(Ec, true), spots, plates };
}

// a reusable material from a greeble paint
export function greebleMaterial(G, extra = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ map: G.map, bumpMap: G.bump, bumpScale: 3.0, roughnessMap: G.rough, roughness: 1, metalness: 0.55, emissiveMap: G.emissive, emissive: 0xffffff, emissiveIntensity: 0.55 }, extra));
}

// ---------------------------------------------------------------- 3D hardware placed on spots
export function hardware(spots, toWorld, filter, T) {
  const g = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc4c7ca, metalness: 0.95, roughness: 0.22 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.3, roughness: 0.55 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb01a14, metalness: 0.2, roughness: 0.45 });
  const yel = new THREE.MeshStandardMaterial({ color: 0xd6ae22, metalness: 0.2, roughness: 0.5 });
  const geo = {
    nut: new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 6),
    bat: new THREE.CylinderGeometry(0.0022, 0.0032, 0.03, 8),
    batTip: new THREE.SphereGeometry(0.0038, 10, 8),
    brk: new THREE.CylinderGeometry(0.0055, 0.006, 0.012, 14),
    knob: new THREE.CylinderGeometry(1, 1.08, 1, 24),
    skirt: new THREE.CylinderGeometry(1.25, 1.35, 0.35, 28),
    lid: new THREE.BoxGeometry(0.026, 0.034, 0.0035),
    post: new THREE.BoxGeometry(0.003, 0.004, 0.03),
  };
  const lists = {}; const add = (k, gk, mat, m) => { (lists[k] = lists[k] || { gk, mat, mats: [] }).mats.push(m.clone()); };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), L = new THREE.Matrix4();
  const R = rnd(spots.length * 31 + 7);
  for (const s of spots) {
    if (!filter(s)) continue;
    const { p, q } = toWorld(s.u, s.v); if (!p) continue;
    const base = new THREE.Matrix4().compose(p, q, S);
    const local = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { Q.setFromEuler(new THREE.Euler(rx, ry, rz)); L.compose(P.set(x, y, z), Q, new THREE.Vector3(sx, sy, sz)); return M.multiplyMatrices(base, L); };
    if (s.kind === "toggle" || s.kind === "guard") {
      const up = R() < 0.5 ? 1 : -1;
      add("nut", "nut", chrome, local(0, 0, 0.003, Math.PI / 2));
      add("bat", "bat", chrome, local(0, up * 0.006, 0.017, Math.PI / 2 - up * 0.45));
      add("batTip", "batTip", chrome, local(0, up * 0.0125, 0.03));
      if (s.kind === "guard") { const m = R() < 0.65 ? red : yel, th = R() < 0.5 ? 0 : 1.15;          // hinged flip cover, closed or raised
        add("post", "post", chrome, local(-0.012, 0.017, 0.015)); add("post", "post", chrome, local(0.012, 0.017, 0.015));
        add("lid" + m.uuid, "lid", m, local(0, 0.017 - 0.017 * Math.cos(th), 0.032 + 0.017 * Math.sin(th), -th)); }
    } else if (s.kind === "breaker") {
      add("brk", "brk", black, local(0, 0, 0.006, Math.PI / 2));
    } else if (s.kind === "knob") {
      const r = Math.min(0.022, Math.max(0.01, (s.rw || 0.014)));
      add("knob", "knob", black, local(0, 0, 0.012, Math.PI / 2, 0, 0, r * 0.75, 0.022, r * 0.75));
      add("skirt", "skirt", chrome, local(0, 0, 0.002, Math.PI / 2, 0, 0, r * 0.75, 0.012, r * 0.75));
    }
  }
  for (const k in lists) { const { gk, mat, mats } = lists[k]; const im = new THREE.InstancedMesh(geo[gk], mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; g.add(im); }
  return g;
}
