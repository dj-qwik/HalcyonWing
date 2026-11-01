// HALCYON WING — shipboard interiors (metres). Each builder adds geometry and lights to a
// parent group and returns anchor points: crew spots, camera marks, interactive props.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as M from "./models.js";
import * as IK from "./interior.js";

const V3 = THREE.Vector3;
function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function rnd(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const TX = {};
function deckTex(base = "#3a3e44", stripe = true) {
  const k = base + stripe; if (TX[k]) return TX[k];
  const c = cv(1024, 1024), x = c.getContext("2d"), R = rnd(5);
  x.fillStyle = base; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const v = (R() - 0.5) * 18; x.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},.08)`; x.fillRect(i * 256 + 3, j * 256 + 3, 250, 250);
    x.strokeStyle = "rgba(0,0,0,.6)"; x.lineWidth = 4; x.strokeRect(i * 256 + 2, j * 256 + 2, 252, 252);
    x.strokeStyle = "rgba(255,255,255,.07)"; x.lineWidth = 2; x.strokeRect(i * 256 + 6, j * 256 + 6, 244, 244);
    for (const [a, b] of [[14, 14], [242, 14], [14, 242], [242, 242]]) { x.fillStyle = "#151515"; x.beginPath(); x.arc(i * 256 + a, j * 256 + b, 5, 0, 7); x.fill(); }
    if (R() < 0.3) { for (let k2 = 0; k2 < 10; k2++) { x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(i * 256 + 60, j * 256 + 60 + k2 * 14, 136, 6); } }
  }
  if (stripe) { x.save(); x.beginPath(); x.rect(0, 490, 1024, 44); x.clip(); for (let i = -60; i < 1100; i += 40) { x.fillStyle = "#c8a020"; x.beginPath(); x.moveTo(i, 490); x.lineTo(i + 20, 490); x.lineTo(i - 24, 534); x.lineTo(i - 44, 534); x.fill(); } x.restore(); }
  for (let i = 0; i < 60; i++) { const px = R() * 1024, py = R() * 1024, r = 30 + R() * 120; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, "rgba(0,0,0,.18)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; TX[k] = t; return t;
}
function wallTex(base = "#2c323a", accent = "#c89040") {
  const k = "w" + base + accent; if (TX[k]) return TX[k];
  const c = cv(1024, 512), x = c.getContext("2d"), R = rnd(9);
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, base); g.addColorStop(1, "#14171b"); x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 8; i++) {
    const px = i * 128; x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(px, 0, 6, 512); x.fillStyle = "rgba(255,255,255,.06)"; x.fillRect(px + 6, 0, 2, 512);
    x.strokeStyle = "rgba(0,0,0,.4)"; x.lineWidth = 3; x.strokeRect(px + 18, 60, 92, 300);
    if (R() < 0.4) { for (let k2 = 0; k2 < 6; k2++) { x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(px + 30, 90 + k2 * 18, 68, 8); } }
    x.fillStyle = "rgba(0,0,0,.3)"; x.fillRect(px + 10, 400, 108, 70);
  }
  x.fillStyle = accent; x.globalAlpha = 0.85; x.fillRect(0, 378, 1024, 8); x.globalAlpha = 1;
  x.fillStyle = "rgba(240,230,210,.55)"; x.font = "bold 22px 'Barlow Semi Condensed', sans-serif"; x.fillText("DECK 4  ·  FRAME 212", 40, 36); x.fillText("CNS HALCYON  CV-71", 560, 36);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; TX[k] = t; return t;
}
function signTex(text, col = "#ffb040", sub = "") {
  const c = cv(512, 128), x = c.getContext("2d"); x.fillStyle = "#0a0c10"; x.fillRect(0, 0, 512, 128); x.strokeStyle = col; x.lineWidth = 4; x.strokeRect(6, 6, 500, 116);
  x.fillStyle = col; x.font = "bold 54px 'Chakra Petch', 'Arial Narrow', sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 256, sub ? 54 : 66);
  if (sub) { x.font = "22px 'Share Tech Mono', monospace"; x.fillText(sub, 256, 100); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const box = (w, h, d, mat, p, parent, r = [0, 0, 0]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(...p); m.rotation.set(...r); parent.add(m); return m; };
const rbox = (w, h, d, rad, mat, p, parent, r = [0, 0, 0]) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, rad), mat); m.position.set(...p); m.rotation.set(...r); parent.add(m); return m; };
function uvScale(mesh, sx, sy) { const t = mesh.material.map; if (t) { mesh.material = mesh.material.clone(); mesh.material.map = t.clone(); mesh.material.map.needsUpdate = true; mesh.material.map.repeat.set(sx, sy); } return mesh; }
function lamp(parent, p, col, inten, dist, shade = true) {
  const l = new THREE.PointLight(col, inten, dist, 2); l.position.set(...p); parent.add(l);
  if (shade) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.32, 0.22, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide })); s.position.set(p[0], p[1] + 0.15, p[2]); parent.add(s); const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: col })); b.position.set(p[0], p[1] + 0.08, p[2]); parent.add(b); const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 6), new THREE.MeshBasicMaterial({ color: 0x111111 })); cord.position.set(p[0], p[1] + 0.75, p[2]); parent.add(cord); }
  return l;
}
function chair(parent, p, ry, mat, padMat) {
  const g = new THREE.Group(); g.position.set(...p); g.rotation.y = ry; parent.add(g);
  // seat height matches where a seated crew figure's hips actually rest (pad top 0.41), so nobody sinks into the cushion
  rbox(0.5, 0.08, 0.48, 0.03, padMat, [0, 0.37, 0], g); rbox(0.5, 0.55, 0.07, 0.03, padMat, [0, 0.67, -0.22], g, [0.12, 0, 0]);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.35, 10), mat); leg.position.y = 0.175; g.add(leg);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 20), mat); base.position.y = 0.015; g.add(base);
  return g;
}

// ---------------------------------------------------------------- LOUNGE
// TRAINSIM pod: a cut-down cockpit shell on a plinth, canopy hinged open, attract screen running
function simPod(parent, p, ry) {
  const g = new THREE.Group(); g.position.set(...p); g.rotation.y = ry; parent.add(g);
  const white = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.35, metalness: 0.25 });
  const red = new THREE.MeshStandardMaterial({ color: 0xa8231c, roughness: 0.4, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.5 });
  const seatM = new THREE.MeshStandardMaterial({ color: 0x7a1c16, roughness: 0.8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x223040, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1 });
  rbox(1.25, 0.22, 2.3, 0.05, dark, [0, 0.11, 0], g);                                   // plinth
  for (const s of [-1, 1]) { const st = rbox(0.06, 0.03, 2.2, 0.01, new THREE.MeshBasicMaterial({ color: 0x7dffa8 }), [s * 0.6, 0.235, 0], g); }
  // hull: tub with a sloped nose, painted white with a red flash
  rbox(1.05, 0.62, 1.7, 0.12, white, [0, 0.55, 0.2], g);
  rbox(0.95, 0.42, 0.9, 0.12, white, [0, 0.62, -0.85], g, [0.32, 0, 0]);
  rbox(1.07, 0.1, 1.52, 0.04, red, [0, 0.62, 0.3], g);   // stands proud of the hull at the back, not flush
  rbox(0.4, 0.66, 0.08, 0.03, red, [0, 0.9, 1.04], g);                                  // tail fin
  // cockpit interior: seat, side consoles, attract screen in the nose
  rbox(0.82, 0.12, 0.95, 0.04, dark, [0, 0.86, 0.15], g);
  rbox(0.55, 0.14, 0.5, 0.05, seatM, [0, 0.98, 0.45], g); rbox(0.55, 0.62, 0.14, 0.06, seatM, [0, 1.22, 0.72], g, [-0.2, 0, 0]);
  const c = cv(512, 320), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.set(0, 1.08, -0.38); scr.rotation.x = -0.35; g.add(scr);
  rbox(0.72, 0.46, 0.06, 0.03, dark, [0, 1.08, -0.41], g, [-0.35, 0, 0]);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 10), dark); stick.position.set(0, 1.05, 0.1); g.add(stick);
  // canopy hinged up at the back
  const hinge = new THREE.Group(); hinge.position.set(0, 1.0, 0.95); hinge.rotation.x = -1.05; g.add(hinge);
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass); can.scale.set(0.8, 0.5, 1.45); can.position.set(0, 0, -0.85); hinge.add(can);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 40), red); rim.rotation.x = Math.PI / 2; rim.scale.set(0.8, 1.45, 1); rim.position.set(0, 0, -0.85); hinge.add(rim);
  // side placard
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshBasicMaterial({ map: signTex("TRAINSIM 3", "#7dffa8", "VIGIL SQUADRON"), toneMapped: false }));
  pl.position.set(0.53, 0.5, 0.25); pl.rotation.y = Math.PI / 2; g.add(pl);
  const lampL = new THREE.PointLight(0x7dffa8, 1.2, 2.5, 2); lampL.position.set(0, 1.4, -0.2); g.add(lampL);
  return { g, screen: { canvas: c, tex }, top: new V3(...p).add(new V3(0.7, 1.05, -0.6)) };
}
// structure, services and fixtures for the crew lounge (x -7..7, z -6..5, ceiling 3.4)
function dressLounge(g) {
  const H = 3.4, K = new IK.Kit();
  const wallT = IK.bulkheadTex({ base: "#3a4048", accent: "#c89040", th: H, seed: 11, deck: "4", frame: 212 });
  IK.floorPlane(g, -7, 7, -6, 5, 0, IK.deckPlateTex({ base: "#33373d", m: 4, tread: true, seed: 5 }), 4);
  IK.ceilingPlane(g, -7, 7, -6, 5, H, IK.ceilingTex({ base: "#262a30", seed: 7, warm: "#ffe2b8" }), 2.4);
  for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) IK.iBeam(K, [x, H - 0.16, -5.9], [x, H - 0.16, 4.9], { h: 0.3 });
  for (const z of [-3.6, -1.2, 1.2, 3.6]) IK.iBeam(K, [-6.9, H - 0.12, z], [6.9, H - 0.12, z], { h: 0.2, w: 0.12 });
  // west wall (killboard, emblem): s runs z = 5 -> -6
  const W = IK.run([-6.92, 4.95], [-6.92, -5.85]); IK.wallPlane(g, W, H, wallT);
  const wSkip = [[1.85, 3.35], [4.8, 7.6]];
  IK.ribs(K, W, { H, every: 2.0, from: 0.15, skip: wSkip });
  IK.pipeRun(K, W, { y: 3.0, r: 0.06, band: "paintBlue" }); IK.pipeRun(K, W, { y: 2.84, r: 0.04, d: 0.12, band: "paintGreen", valve: false });
  IK.conduits(K, W, { y: 2.55, skip: wSkip }); IK.baseboard(K, W, {});
  IK.junctionBox(K, W, 9.1, 1.25); IK.wallVent(K, W, 0.9, 0.42); IK.emergencyLight(K, W, 8.2, 2.35, "lightA"); IK.intercom(K, W, 10.2, 1.45);
  // east wall (back bar from s 2.5 to 6.9)
  const E = IK.run([6.92, -5.85], [6.92, 4.95]); IK.wallPlane(g, E, H, wallT);
  const eSkip = [[2.3, 7.1]];
  IK.ribs(K, E, { H, every: 2.0, from: 0.15, skip: eSkip });
  IK.pipeRun(K, E, { y: 3.0, r: 0.06, band: "paintRed" }); IK.cableTray(K, E, { y: 2.78, d: 0.3, w: 0.36 });
  IK.baseboard(K, E, { skip: eSkip }); IK.fireCabinet(K, E, 8.6); IK.junctionBox(K, E, 1.3, 1.2); IK.emergencyLight(K, E, 9.8, 2.35, "lightA");
  // back wall (doors at s 4.1-6.3 and 11.3-13.7, wall screen s 7.9-10.5)
  const B = IK.run([6.92, 4.95], [-6.92, 4.95]); IK.wallPlane(g, B, H, wallT);
  const bSkip = [[3.95, 6.45], [7.8, 10.6], [11.15, 13.85]];
  IK.ribs(K, B, { H, every: 1.9, from: 0.2, skip: [...bSkip, [0.55, 2.35]] });
  IK.pipeRun(K, B, { y: 3.02, r: 0.05, band: "paintYellow", valve: false }); IK.conduits(K, B, { y: 2.7, skip: bSkip });
  IK.baseboard(K, B, { skip: bSkip }); IK.fireCabinet(K, B, 2.6); IK.intercom(K, B, 6.75); IK.junctionBox(K, B, 11.0 - 0.0, 0.75, { w: 0.3, h: 0.4 });
  IK.doorFrame(K, B, 5.2, 1.35, 2.45, { lit: "lightB" }); IK.doorFrame(K, B, 12.5, 1.35, 2.45, { lit: "lightA" });
  IK.signPlate(g, B, 1.4, 2.55, "CREW LOUNGE", "DECK 4 · FRAME 212-218", { w: 1.5, h: 0.34 });
  IK.signPlate(g, W, 8.9, 2.6, "VIGIL SQUADRON", "READY ROOM 2", { w: 1.4, h: 0.3, col: "#7dbbff" });
  // window wall: armoured sill and header with bulkhead skin, heavy bolted mullions, handrail, shutter tracks
  const F = IK.run([-6.92, -5.86], [6.92, -5.86]);
  const sillT = IK.bulkheadTex({ base: "#3a4048", accent: "#c89040", th: 0.9, tw: 2.4, seed: 21, frame: 214 });
  const m1 = IK.wallPlane(g, F, 0.9, sillT); const hdr = IK.wallPlane(g, F, 0.72, IK.ceilingTex({ base: "#2a2e34", seed: 9, lights: false }), { y0: H - 0.72, bay: 2.4 });
  K.rbox(14, 0.1, 0.55, 0.02, "metal", [0, 0.93, -5.62]); K.box(14, 0.03, 0.04, "lightC", [0, 0.885, -5.36]);
  K.rbox(14, 0.16, 0.5, 0.02, "metal", [0, H - 0.8, -5.66]); K.box(14, 0.025, 0.03, "lightW", [0, H - 0.885, -5.43]);
  IK.handrail(K, IK.run([-6.8, -5.55], [6.8, -5.55]), { y: 1.06, d: 0.12, every: 1.3 });
  for (let x = -6.5; x <= 6.6; x += 2.6) {
    K.rbox(0.34, H - 1.6, 0.46, 0.04, "metal", [x, 0.95 + (H - 1.75) / 2, -5.78]); K.box(0.2, H - 1.8, 0.02, "dark", [x, 0.95 + (H - 1.75) / 2, -5.535]);
    for (let y = 1.15; y < H - 0.9; y += 0.22) for (const o of [-1, 1]) K.cyl(0.014, 0.014, 0.02, "steel", [x + o * 0.12, y, -5.54], [Math.PI / 2, 0, 0], 6);
    for (const y of [1.0, H - 0.85]) for (const o of [-1, 1]) K.box(0.05, 0.38, 0.3, "metal", [x + o * 0.26, y + (y < 2 ? 0.17 : -0.17), -5.7], [0, 0, o * (y < 2 ? -0.75 : 0.75)]);   // gussets
    for (const o of [-1, 1]) K.box(0.035, H - 1.75, 0.05, "dark", [x + o * 0.21, 0.95 + (H - 1.75) / 2, -5.98]);                                                       // shutter tracks
  }
  // corner columns
  for (const [cx, cz] of [[-6.8, 4.85], [6.8, 4.85], [-6.8, -5.75], [6.8, -5.75]]) { K.rbox(0.36, H, 0.36, 0.04, "metal", [cx, H / 2, cz]); for (let y = 0.4; y < H; y += 0.5) K.box(0.38, 0.03, 0.38, "dark", [cx, y, cz]); }
  // carpet trim and floor services
  K.box(6.6, 0.025, 0.08, "dark", [-1.5, 0.012, -3.34]); K.box(6.6, 0.025, 0.08, "dark", [-1.5, 0.012, 1.74]); K.box(0.08, 0.025, 5.1, "dark", [-4.8, 0.012, -0.8]); K.box(0.08, 0.025, 5.1, "dark", [1.8, 0.012, -0.8]);
  for (const x of [-6.2, 6.2]) K.rbox(0.5, 0.04, 0.9, 0.01, "paintGrey", [x, 0.02, 3.4]);
  K.build(g);
}
export function buildLounge(parent) {
  const g = new THREE.Group(); parent.add(g);
  const metal = new THREE.MeshStandardMaterial({ color: 0x3c4148, roughness: 0.45, metalness: 0.8 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.6, metalness: 0.5 });
  const pad = new THREE.MeshStandardMaterial({ color: 0x5a2a20, roughness: 0.75 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.45, metalness: 0.1 });
  const carpet = box(6.5, 0.02, 5, new THREE.MeshStandardMaterial({ color: 0x2a1c1c, roughness: 0.95 }), [-1.5, 0.012, -0.8], g);
  dressLounge(g);
  const wz = -6;
  // bar (right)
  const barTop = rbox(0.8, 0.08, 4.2, 0.03, new THREE.MeshPhysicalMaterial({ color: 0x2a1a10, roughness: 0.25, clearcoat: 0.8 }), [4.6, 1.1, -1.3], g);
  rbox(0.6, 1.06, 4.0, 0.04, new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.6, metalness: 0.3, map: deckTex("#4a3a2c", false) }), [4.65, 0.53, -1.3], g);
  box(0.03, 0.03, 4.0, new THREE.MeshBasicMaterial({ color: 0xffa040 }), [4.3, 0.15, -1.3], g);
  // back bar shelves with glowing bottles
  const shelfM = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.5 });
  box(0.4, 2.0, 4.4, darkM, [6.75, 1.6, -1.3], g);
  const backlight = box(0.02, 1.4, 4.0, new THREE.MeshBasicMaterial({ color: 0x8a4a22 }), [6.54, 1.75, -1.3], g);
  const R = rnd(3);
  // 36 bottles in one instanced draw (was 36 meshes + materials); per-bottle colour drives both tint and glow
  const bottleM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.85, emissive: 0xffffff, emissiveIntensity: 0.25 });
  bottleM.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("vec3 totalEmissiveRadiance = emissive;", "vec3 totalEmissiveRadiance = emissive * vColor;"); };
  bottleM.customProgramCacheKey = () => "bottleGlow";
  const bottles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.04, 1, 10), bottleM, 36); let bi = 0; const bm = new THREE.Matrix4(), bq = new THREE.Quaternion();
  for (let row = 0; row < 3; row++) { box(0.35, 0.03, 4.2, shelfM, [6.4, 1.15 + row * 0.5, -1.3], g); for (let i = 0; i < 12; i++) { const col = new THREE.Color().setHSL(R() * 0.15 + (R() < 0.3 ? 0.5 : 0), 0.7, 0.35); const hgt = 0.26 + R() * 0.12; bm.compose(new THREE.Vector3(6.4 + (R() - 0.5) * 0.1, 1.3 + row * 0.5, -3.2 + i * 0.34), bq, new THREE.Vector3(1, hgt, 1)); bottles.setMatrixAt(bi, bm); bottles.setColorAt(bi, col); bi++; } }
  g.add(bottles);
  for (let i = 0; i < 4; i++) { const st = new THREE.Group(); st.position.set(3.75, 0, -2.8 + i * 1.0); g.add(st); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), pad); s.position.y = 0.78; st.add(s); const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), metal); p2.position.y = 0.38; st.add(p2); const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 16), metal); st.add(b2); }
  // tables
  const tables = [[-3.2, -2.2], [-0.6, -3.4], [-3.4, 1.2]];
  for (const [x, z] of tables) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 32), new THREE.MeshPhysicalMaterial({ color: 0x1c1e22, roughness: 0.3, metalness: 0.6, clearcoat: 0.6 })); top.position.set(x, 0.76, z); g.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.015, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffb060 })); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.79, z); g.add(ring);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.74, 10), metal); p2.position.set(x, 0.37, z); g.add(p2);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 14), new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.5 })); mug.position.set(x + 0.2, 0.84, z - 0.1); g.add(mug);
    const cards = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.09), new THREE.MeshStandardMaterial({ color: 0xf0ece0 })); cards.position.set(x - 0.15, 0.795, z + 0.12); cards.rotation.y = 0.4; g.add(cards);
    lamp(g, [x, 2.55, z], 0xffc080, 6, 6);
  }
  // killboard screen on left wall
  const kb = cv(1024, 640); const kbt = new THREE.CanvasTexture(kb); kbt.colorSpace = THREE.SRGBColorSpace;
  const killboard = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.62), new THREE.MeshBasicMaterial({ map: kbt, toneMapped: false })); killboard.position.set(-6.86, 1.85, -1.2); killboard.rotation.y = Math.PI / 2; g.add(killboard);
  rbox(0.1, 1.82, 2.8, 0.03, darkM, [-6.93, 1.85, -1.2], g);
  // wall screen (broadcasts) on back wall
  const ws = cv(768, 432); const wst = new THREE.CanvasTexture(ws); wst.colorSpace = THREE.SRGBColorSpace;
  const wallScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), new THREE.MeshBasicMaterial({ map: wst, toneMapped: false })); wallScreen.position.set(-2.2, 1.9, 4.88); wallScreen.rotation.y = Math.PI; g.add(wallScreen);
  rbox(2.6, 1.55, 0.1, 0.03, darkM, [-2.2, 1.9, 4.95], g);
  // squadron emblem
  const em = cv(512, 512), ex = em.getContext("2d"); ex.fillStyle = "#14285a"; ex.beginPath(); ex.arc(256, 256, 240, 0, 7); ex.fill(); ex.strokeStyle = "#c8a040"; ex.lineWidth = 16; ex.stroke(); ex.fillStyle = "#e8e8f0"; ex.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 60 : 150; ex.lineTo(256 + Math.cos(a) * r, 236 + Math.sin(a) * r); } ex.fill(); ex.fillStyle = "#c8a040"; ex.font = "bold 54px 'Chakra Petch', sans-serif"; ex.textAlign = "center"; ex.fillText("VIGIL", 256, 440);
  const emt = new THREE.CanvasTexture(em); emt.colorSpace = THREE.SRGBColorSpace;
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), new THREE.MeshStandardMaterial({ map: emt, roughness: 0.5, metalness: 0.3 })); emblem.position.set(-6.88, 1.9, 2.4); emblem.rotation.y = Math.PI / 2; g.add(emblem);
  // doors
  const door = (x, z, ry, label, sub, col) => {
    const d = new THREE.Group(); d.position.set(x, 0, z); d.rotation.y = ry; g.add(d);
    rbox(1.6, 2.6, 0.15, 0.04, metal, [0, 1.3, 0], d);
    const leaf = rbox(1.3, 2.35, 0.1, 0.03, new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.4, metalness: 0.8, map: deckTex("#4a5058", false) }), [0, 1.2, 0.06], d);
    box(1.3, 0.03, 0.02, new THREE.MeshBasicMaterial({ color: col }), [0, 2.42, 0.13], d); for (const s of [-1, 1]) box(0.03, 2.35, 0.02, new THREE.MeshBasicMaterial({ color: col }), [s * 0.67, 1.2, 0.13], d);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), new THREE.MeshBasicMaterial({ map: signTex(label, "#" + new THREE.Color(col).getHexString(), sub), toneMapped: false })); sg.position.set(0, 2.85, 0.1); d.add(sg);
    return d;
  };
  const briefDoor = door(-5.5, 4.9, Math.PI, "BRIEFING", "MISSION READY ROOM", 0xff8a30);
  const deckDoor = door(1.8, 4.9, Math.PI, "FLIGHT DECK", "HANGAR BAY 2", 0x60b0ff);
  const sim = simPod(g, [-2.75, 0, 1.0], 1.2);
  // ambient lighting
  const amb = new THREE.HemisphereLight(0x8098b8, 0x3a2a1c, 0.95); g.add(amb);
  // wall wash: soft fills that pick out the bulkheads, ribs and pipe runs
  for (const [x, y, z, c, i] of [[-5.6, 2.9, 2.5, 0xffd8a8, 5], [-5.6, 2.9, -3.0, 0xc8d8ff, 4], [5.6, 2.9, 2.6, 0xffd0a0, 4], [0, 2.9, 3.9, 0xffe0b8, 5], [-3.5, 2.9, 3.9, 0xffe0b8, 4]]) { const l = new THREE.PointLight(c, i, 7, 1.6); l.position.set(x, y, z); g.add(l); }
  const winL = new THREE.DirectionalLight(0x9ac0ff, 1.2); winL.position.set(0, 2, -8); winL.target.position.set(0, 0, 0); g.add(winL, winL.target);
  lamp(g, [5.0, 2.6, -1.3], 0xffa060, 5, 5, false);
  return {
    g, killboard: { mesh: killboard, canvas: kb, tex: kbt }, wallScreen: { mesh: wallScreen, canvas: ws, tex: wst },
    doors: { brief: briefDoor, deck: deckDoor }, sim,
    spots: [
      { p: [3.75, 0, -2.8], ry: -Math.PI / 2, pose: "sit", seat: 0.4 }, { p: [3.6, 0, -0.6], ry: -Math.PI / 2 + 0.3, pose: "lean" },
      { p: [-3.2, 0, -1.45], ry: Math.PI, pose: "sitTable" }, { p: [-3.95, 0, -2.2], ry: Math.PI / 2, pose: "sitTable" },
      { p: [-0.6, 0, -2.65], ry: Math.PI, pose: "sitTable" }, { p: [0.15, 0, -3.4], ry: -Math.PI / 2, pose: "sitTable" },
      { p: [2.2, 0, -5.2], ry: Math.PI - 0.4, pose: "armsCrossed" }, { p: [-3.4, 0, 1.95], ry: Math.PI, pose: "sitTable" },
      { p: [-1.15, 0, -0.1], ry: Math.PI - 0.5, pose: "stand" }, { p: [1.2, 0, -0.6], ry: Math.PI + 0.3, pose: "stand" },
    ],
    chairsFor: (spot) => spot.pose === "sitTable" ? chair(g, [spot.p[0] - Math.sin(spot.ry) * 0.12, 0, spot.p[2] - Math.cos(spot.ry) * 0.12], spot.ry, metal, pad) : null,
    establish: { pos: new V3(-0.4, 1.75, 4.2), look: new V3(0.2, 1.1, -2.8) },
  };
}

// ---------------------------------------------------------------- BRIEFING ROOM
// mission ready room (x -6..6, z -5.2..6, ceiling 4): screen wall, ribbed side bulkheads, ducted ceiling
function statusPanel(parent, p, ry, w, h, seed, title) {
  const c = cv(256, Math.round(256 * h / w)), x = c.getContext("2d"), R = rnd(seed);
  x.fillStyle = "#050806"; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = "#2a6a3a"; x.lineWidth = 3; x.strokeRect(4, 4, c.width - 8, c.height - 8);
  x.fillStyle = "#ffb040"; x.font = "bold 20px 'Chakra Petch', sans-serif"; x.textAlign = "center"; x.fillText(title, c.width / 2, 30);
  x.font = "13px 'Share Tech Mono', monospace"; x.textAlign = "left";
  for (let i = 0; i < Math.floor((c.height - 60) / 18); i++) { x.fillStyle = R() < 0.12 ? "#ff5a3a" : R() < 0.3 ? "#ffd060" : "#5aff90"; x.fillText(["SQDN", "CAP", "NAV", "FUEL", "ORD", "SHLD", "TUBE", "COMM", "DECK", "MED"][(R() * 10) | 0] + " " + String((R() * 9999) | 0).padStart(4, "0") + "  " + ["OK", "OK", "RDY", "HOLD", "OK", "AMB"][(R() * 6) | 0], 16, 56 + i * 18); }
  for (let i = 0; i < 4; i++) { x.fillStyle = "#123a1e"; x.fillRect(16, c.height - 40 - i * 0, c.width - 32, 0); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); m.position.set(...p); m.rotation.y = ry; parent.add(m); return m;
}
function dressBriefing(g) {
  const H = 4, K = new IK.Kit();
  const wallT = IK.bulkheadTex({ base: "#3a302e", accent: "#e0602a", th: H, seed: 31, deck: "4", frame: 230 });
  IK.floorPlane(g, -6, 6, -5.2, 6, 0, IK.deckPlateTex({ base: "#2c2826", m: 4, tread: false, seed: 9 }), 4);
  K.box(1.4, 0.012, 7.6, new THREE.MeshStandardMaterial({ color: 0x2a1614, roughness: 0.95 }), [0, 0.006, 2.2]);                              // centre aisle runner
  IK.ceilingPlane(g, -6, 6, -5.2, 6, H, IK.ceilingTex({ base: "#221c1c", seed: 13, warm: "#ffc8a0" }), 2.4);
  for (const x of [-3.6, -1.2, 1.2, 3.6]) IK.iBeam(K, [x, H - 0.16, -5.1], [x, H - 0.16, 5.9], { h: 0.3 });
  K.rod([-4.8, H - 0.45, -5.0], [-4.8, H - 0.45, 5.8], 0.22, "paintGrey", 16); K.rod([4.8, H - 0.45, -5.0], [4.8, H - 0.45, 5.8], 0.22, "paintGrey", 16);       // air ducts
  for (let z = -4.2; z < 5.8; z += 2.0) for (const x of [-4.8, 4.8]) { K.torus(0.23, 0.02, "steel", [x, H - 0.45, z], [0, 0, 0], 20); K.box(0.04, 0.24, 0.04, "dark", [x, H - 0.12, z]); }
  // side walls
  const Wl = IK.run([-5.9, 5.9], [-5.9, -5.1]); IK.wallPlane(g, Wl, H, wallT);
  const Wr = IK.run([5.9, -5.1], [5.9, 5.9]); IK.wallPlane(g, Wr, H, wallT);
  for (const R of [Wl, Wr]) { IK.ribs(K, R, { H, every: 2.2, from: 0.3 }); IK.pipeRun(K, R, { y: 3.45, r: 0.05, band: "paintRed" }); IK.conduits(K, R, { y: 3.1 }); IK.baseboard(K, R, {}); }
  IK.fireCabinet(K, Wl, 2.0); IK.junctionBox(K, Wl, 7.6, 1.2); IK.emergencyLight(K, Wl, 5.0, 2.8); IK.intercom(K, Wr, 8.8); IK.junctionBox(K, Wr, 3.4, 1.0); IK.emergencyLight(K, Wr, 6.4, 2.8); IK.wallVent(K, Wr, 1.0, 0.45);
  // back wall with entrance
  const Bk = IK.run([5.9, 5.9], [-5.9, 5.9]); IK.wallPlane(g, Bk, H, wallT);
  IK.ribs(K, Bk, { H, every: 2.0, from: 0.3, skip: [[8.6, 11.2]] }); IK.doorFrame(K, Bk, 9.9, 1.35, 2.45, { lit: "lightR" }); IK.baseboard(K, Bk, { skip: [[8.6, 11.2]] }); IK.pipeRun(K, Bk, { y: 3.45, r: 0.05, valve: false });
  IK.signPlate(g, Bk, 9.9, 3.1, "BRIEFING", "MISSION READY ROOM", { w: 1.3, h: 0.3, col: "#ff8a30" });
  // screen wall: framed main display, flanking status columns, speaker stacks, emblem, sign
  const Fr = IK.run([-5.9, -5.1], [5.9, -5.1]); IK.wallPlane(g, Fr, H, wallT);
  IK.ribs(K, Fr, { H, every: 2.2, from: 0.15, skip: [[1.6, 8.9]] }); IK.baseboard(K, Fr, { skip: [[1.4, 10.6]] });
  for (const y of [2.35 - 1.52, 2.35 + 1.52]) { K.rbox(5.5, 0.34, 0.3, 0.04, "dark", [-0.6, y, -4.98]); K.box(5.3, 0.06, 0.04, "metal", [-0.6, y + (y > 2 ? -0.13 : 0.13), -4.82]); }
  for (const x of [-0.6 - 2.58, -0.6 + 2.58]) { K.rbox(0.36, 3.38, 0.3, 0.04, "dark", [x, 2.35, -4.98]); K.box(0.06, 3.0, 0.04, "metal", [x + (x < 0 ? 0.13 : -0.13), 2.35, -4.82]); }
  for (const [x, y] of [[-3.2, 3.9], [2.0, 3.9], [-3.2, 0.8], [2.0, 0.8]]) for (let i = 0; i < 4; i++) K.cyl(0.02, 0.02, 0.03, "steel", [x + (x < 0 ? 0.12 : -0.12), y + (y > 2 ? -0.12 : 0.12) - (y > 2 ? i * 0.0 : 0), -4.82], [Math.PI / 2, 0, 0], 6);
  for (const x of [-4.3, 3.1]) { K.rbox(0.9, 2.6, 0.22, 0.04, "dark", [x, 2.2, -4.98]); }
  statusPanel(g, [-4.3, 2.35, -4.86], 0, 0.72, 1.6, 41, "SQUADRON"); statusPanel(g, [3.1, 2.35, -4.86], 0, 0.72, 1.6, 57, "FLEET");
  for (const x of [-4.3, 3.1]) { K.rbox(0.62, 0.42, 0.24, 0.03, "black", [x, 0.6, -4.95]); for (let i = 0; i < 5; i++) K.box(0.5, 0.012, 0.02, "dark", [x, 0.46 + i * 0.07, -4.82]); K.box(0.6, 0.02, 0.02, "lightA", [x, 3.62, -4.86]); }
  const em = cv(256, 256), ex = em.getContext("2d"); ex.fillStyle = "#14285a"; ex.beginPath(); ex.arc(128, 128, 120, 0, 7); ex.fill(); ex.strokeStyle = "#c8a040"; ex.lineWidth = 10; ex.stroke(); ex.fillStyle = "#e8e8f0"; ex.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 32 : 78; ex.lineTo(128 + Math.cos(a) * r, 124 + Math.sin(a) * r); } ex.fill();
  const emt = new THREE.CanvasTexture(em); emt.colorSpace = THREE.SRGBColorSpace; const emb = new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), new THREE.MeshStandardMaterial({ map: emt, roughness: 0.4, metalness: 0.4 })); emb.position.set(5.0, 3.3, -5.06); g.add(emb);
  K.torus(0.36, 0.03, "brass", [5.0, 3.3, -5.06], [0, 0, 0], 40);
  // stage: edge trim with hazard nosing and step lights, side steps
  K.box(9.02, 0.04, 0.12, "paintYellow", [0, 0.29, -2.6]); for (let x = -4.2; x <= 4.2; x += 0.7) K.box(0.18, 0.04, 0.02, "lightA", [x, 0.16, -2.59]);
  for (const x of [-4.9, 4.9]) { K.box(0.8, 0.15, 0.5, "metal", [x, 0.075, -2.35]); K.box(0.8, 0.02, 0.06, "paintYellow", [x, 0.155, -2.12]); }
  K.build(g);
}
export function buildBriefing(parent) {
  const g = new THREE.Group(); parent.add(g);
  const red = new THREE.MeshStandardMaterial({ map: wallTex("#3a1414", "#ff6030"), roughness: 0.6, metalness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.8 });
  const pad = new THREE.MeshStandardMaterial({ color: 0x3a1a18, roughness: 0.8 });
  dressBriefing(g);
  // stage + podium
  box(9, 0.3, 2.4, metal, [0, 0.15, -3.8], g); box(9, 0.02, 0.05, new THREE.MeshBasicMaterial({ color: 0xffa060 }), [0, 0.31, -2.6], g);
  const pod = rbox(0.9, 1.15, 0.55, 0.05, new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.4, metalness: 0.4 }), [1.8, 0.88, -3.2], g);
  const podSeal = new THREE.Mesh(new THREE.CircleGeometry(0.24, 32), new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 1, roughness: 0.3 })); podSeal.position.set(1.8, 0.95, -2.92); g.add(podSeal);
  // tactical screen
  const sc = cv(1280, 720); const sct = new THREE.CanvasTexture(sc); sct.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.7), new THREE.MeshBasicMaterial({ map: sct, toneMapped: false })); screen.position.set(-0.6, 2.35, -4.95); g.add(screen);
  rbox(5.1, 3.0, 0.15, 0.05, metal, [-0.6, 2.35, -5.12], g);
  const scrGlow = new THREE.PointLight(0x60ff90, 2.5, 7, 2); scrGlow.position.set(-0.6, 2.2, -4.2); g.add(scrGlow);
  // seat rows
  const seats = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x = -2.4 + c * 1.6, z = -0.8 + r * 1.5; chair(g, [x, 0, z + 0.1], Math.PI, metal, pad); seats.push({ p: [x, 0, z], ry: Math.PI }); }
  // lights
  g.add(new THREE.HemisphereLight(0xc07060, 0x200808, 1.25));
  for (const [x, z] of [[-5.0, -2.5], [-5.0, 2.5], [5.0, -2.5], [5.0, 2.5], [-3, 5.2], [3, 5.2]]) { const l = new THREE.PointLight(0xff9a70, 7, 7, 1.6); l.position.set(x, 3.3, z); g.add(l); }
  const key = new THREE.SpotLight(0xffd0b0, 9, 12, 0.6, 0.7, 1.5); key.position.set(1.8, 3.8, -1.0); key.target.position.set(1.8, 1.5, -3.4); g.add(key, key.target);
  for (const x of [-3.5, 0, 3.5]) { const l = new THREE.PointLight(0xff7a50, 6, 9, 2); l.position.set(x, 3.6, 2); g.add(l); }
  return { g, screen: { canvas: sc, tex: sct, mesh: screen }, seats, podium: { p: [1.8, 0.3, -3.65], ry: Math.PI * 0 }, front: [{ p: [3.3, 0.3, -3.9], ry: -0.4 }, { p: [-3.8, 0.3, -3.9], ry: 0.4 }],
    wide: { pos: new V3(0.4, 1.9, 4.6), look: new V3(-0.2, 1.7, -4) } };
}

// ---------------------------------------------------------------- HANGAR
// parking spots sized to the fighters (13–27 m): two light fighters up front, mediums in the middle, the Longbow at the back
const HANGAR_PADS = [[-16, 8], [16, 8], [-15, -13], [15, -13], [0, -38]];
export function buildHangar(parent, alert = false) {
  const g = new THREE.Group(); parent.add(g);
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.45, metalness: 0.8 });
  const beam = new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.5, metalness: 0.8 });
  const wallM = new THREE.MeshStandardMaterial({ map: wallTex("#2a3038", "#d8b020"), roughness: 0.6, metalness: 0.5 });
  dressHangar(g, alert);
  // launch tube mouths at the far end
  for (const x of [-15, 0, 15]) {
    const fr = new THREE.Group(); fr.position.set(x, 0, -54); g.add(fr);
    // frame, door leaves and chevrons come from dressHangar
    for (let i = 0; i < 6; i++) box(0.5, 0.3, 0.3, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb040 : 0x60b0ff }), [-4.5 + i * 1.8, 9.4, -0.2], fr);

  }
  // clutter: crates, carts, fuel lines, missile racks
  const crate = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.7, map: deckTex("#4a5a3a", false) });
  const R = rnd(4);
  for (let i = 0; i < 14; i++) { const s = 0.9 + R() * 0.9; rbox(s, s, s, 0.05, crate, [(R() < 0.5 ? -1 : 1) * (26 + R() * 2.2), s / 2, -40 + R() * 70], g, [0, R() * 1, 0]); }
  for (let i = 0; i < 4; i++) { const c = new THREE.Group(); c.position.set(-8 + i * 6, 0, 10 + (i % 2) * 6); g.add(c); rbox(1.6, 0.6, 2.6, 0.08, new THREE.MeshStandardMaterial({ color: 0xc8a020, roughness: 0.6 }), [0, 0.55, 0], c); for (const s of [-1, 1]) for (const t of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x111111 })); w.rotation.z = Math.PI / 2; w.position.set(s * 0.85, 0.25, t * 0.9); c.add(w); } const ms = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 12), new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.7, roughness: 0.3 })); ms.rotation.x = Math.PI / 2; ms.position.y = 1.1; c.add(ms); }
  g.add(new THREE.HemisphereLight(0x8098b8, 0x302820, alert ? 0.8 : 1.1));
  const keyL = new THREE.DirectionalLight(0xfff0e0, alert ? 1.4 : 2.2); keyL.position.set(10, 20, 15); g.add(keyL);
  const beacons = [];
  if (alert) for (const [x, z] of [[-20, -30], [20, -30], [-20, 10], [20, 10], [0, -45]]) { const l = new THREE.PointLight(0xff2010, 0, 30, 1.8); l.position.set(x, 12, z); g.add(l); const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff2010 })); b.position.copy(l.position); g.add(b); beacons.push({ l, b }); }
  return { g, beacons, pads: HANGAR_PADS.map(([x, z]) => [x, 0, z]) };
}

// flight deck dressing (x -30..30, z -55..35, 22 m high): two catwalk tiers, giant columns, ducts,
// gantry crane, painted pads and taxi lines, tube hazard zones, control room, ground equipment
function hangarText(parent, p, ry, w, h, text, col = "rgba(230,200,90,.85)", rx = 0) {
  const c = cv(1024, Math.round(1024 * h / w)), x = c.getContext("2d"); x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = col; x.font = `800 ${Math.round(c.height * 0.8)}px 'Chakra Petch', 'DejaVu Sans', sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, c.width / 2, c.height * 0.54);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.2, roughness: 0.7, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(...p); m.rotation.set(rx, ry, 0); parent.add(m); return m;
}
function padDecal(parent, x, z, n) {
  const c = cv(1024, 1024), k = c.getContext("2d"); k.translate(512, 512);
  k.strokeStyle = "rgba(220,180,40,.9)"; k.lineWidth = 26; k.setLineDash([90, 40]); k.beginPath(); k.arc(0, 0, 470, 0, 7); k.stroke(); k.setLineDash([]);
  k.lineWidth = 10; k.beginPath(); k.arc(0, 0, 400, 0, 7); k.stroke();
  k.fillStyle = "rgba(220,180,40,.9)"; for (let i = 0; i < 4; i++) { k.save(); k.rotate(i * Math.PI / 2); k.fillRect(-12, -470, 24, 120); k.restore(); }
  k.font = "800 150px 'Chakra Petch', sans-serif"; k.textAlign = "center"; k.textBaseline = "middle"; k.fillText("PAD " + n, 0, 250);
  k.strokeStyle = "rgba(230,230,230,.6)"; k.lineWidth = 8; k.beginPath(); k.moveTo(0, -330); k.lineTo(0, 150); k.moveTo(-60, -250); k.lineTo(0, -330); k.lineTo(60, -250); k.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.15, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); parent.add(m);
}
function dressHangar(g, alert) {
  const H = 22, K = new IK.Kit(), tier = H / 3;
  IK.floorPlane(g, -30, 30, -55, 35, 0, IK.deckPlateTex({ base: "#34383e", m: 8, tread: false, hangar: true, seed: 17 }), 8, { bumpScale: 1.2 });
  IK.ceilingPlane(g, -30, 30, -55, 35, H, IK.ceilingTex({ base: "#1c1f24", m: 6, seed: 19, lights: false }), 6);
  const wallT = IK.bulkheadTex({ base: "#353b43", accent: "#d8b020", th: tier, tw: 4.8, seed: 23, deck: "3", frame: 140 });
  // painted floor: pads, taxi lines to the tubes, hazard aprons, walkway lanes along the walls
  HANGAR_PADS.forEach(([x, z], i) => padDecal(g, x, z, i + 1));
  const paint = (x, z, w, d, mk = "paintYellow") => K.box(w, 0.012, d, mk, [x, 0.02, z]);   // top at 0.026: clearly above the hazard aprons (0.015)
  for (const x of [-15, 0, 15]) { paint(x, -40, 0.3, 26); for (let z = -52; z < -28; z += 3) paint(x, z, 1.2, 0.25); }
  for (const x of [-14, 14]) paint(x, -16, 0.25, 10);
  for (const x of [-26.5, 26.5]) { paint(x, -10, 0.2, 86); }
  const hz = IK.deckPlateTex({ base: "#2a2c30", m: 2, tread: false, seed: 3, lines: [{ hazard: true, x: 0, y: 0, w: 2, h: 2 }] });
  for (const x of [-15, 0, 15]) { const m = IK.floorPlane(g, x - 6, x + 6, -54.5, -50.5, 0.015, hz, 2); }
  // walls: two tiers of bulkhead, giant columns every 10 m, catwalks at each tier
  const runs = { w: IK.run([-29.75, 34.75], [-29.75, -54.75]), e: IK.run([29.75, -54.75], [29.75, 34.75]), b: IK.run([29.75, 34.75], [-29.75, 34.75]), f: IK.run([-29.75, -54.75], [29.75, -54.75]) };
  for (const R of Object.values(runs)) IK.wallPlane(g, R, H, wallT, { bay: 4.8, tileH: tier });
  for (const k of ["w", "e"]) {
    const R = runs[k];
    IK.ribs(K, R, { H, every: 10, from: 4.75, w: 0.9, d: 0.7, bolt: 0.9, knee: true });
    for (const y of [tier, tier * 2]) {
      // grated catwalk with toe-board, two rails and posts, brackets under each column
      K.box(R.L - 1, 0.08, 1.6, "grate", R.at(R.L / 2, y, 0.8 + 0.7), [0, R.ry + Math.PI / 2, 0]);
      for (let s = 1; s < R.L - 1; s += 0.6) K.box(0.03, 0.06, 1.55, "dark", R.at(s, y - 0.05, 1.5), [0, R.ry, 0]);
      K.box(R.L - 1, 0.15, 0.03, "paintYellow", R.at(R.L / 2, y + 0.11, 2.3), [0, R.ry + Math.PI / 2, 0]);
      for (const hh of [0.55, 1.1]) K.rod(R.at(0.6, y + hh, 2.3), R.at(R.L - 0.6, y + hh, 2.3), 0.035, "paintYellow", 8);
      for (let s = 0.6; s < R.L; s += 2.5) K.rod(R.at(s, y, 2.3), R.at(s, y + 1.1, 2.3), 0.03, "paintYellow", 6);
      for (let s = 4.75; s < R.L; s += 10) K.box(0.25, 1.2, 1.5, "metal", R.at(s, y - 0.65, 1.45), [Math.PI / 4.5, R.ry, 0]);
      IK.pipeRun(K, R, { y: y + 2.6, d: 0.3, r: 0.18, flange: 4, band: k === "w" ? "paintBlue" : "paintRed" });
      IK.conduits(K, R, { y: y + 2.1, d: 0.12, n: 4 });
      for (let s = 9.75; s < R.L; s += 10) { IK.emergencyLight(K, R, s, y + 2.0, "lightA"); IK.junctionBox(K, R, s - 2.4, y + 1.2, { w: 0.6, h: 0.8 }); }
    }
    IK.pipeRun(K, R, { y: 1.6, d: 0.25, r: 0.12, flange: 3.2, band: "paintYellow" });
    for (let s = 7; s < R.L - 3; s += 20) IK.fireCabinet(K, R, s, 1.4);
    IK.baseboard(K, R, {});
    // stairs from the deck to the first catwalk at the back end
    const s0 = R.L - 12; for (let i = 0; i < 24; i++) K.box(1.2, 0.05, 0.32, "grate", R.at(s0 + i * 0.3, (i + 1) * tier / 24, 1.5), [0, R.ry + Math.PI / 2, 0]);
    for (const d of [0.85, 2.15]) K.rod(R.at(s0, 0, d), R.at(s0 + 7.2, tier, d), 0.05, "paintYellow", 8);
  }
  // big ducts and lights overhead; ceiling trusses
  for (const x of [-12, 12]) { K.rod([x, H - 2.6, -54], [x, H - 2.6, 34], 0.9, "paintGrey", 20); for (let z = -50; z < 34; z += 6) { K.torus(0.93, 0.06, "steel", [x, H - 2.6, z], [0, 0, 0], 24); K.box(0.12, 1.7, 0.12, "dark", [x, H - 1.0, z]); } }
  for (let z = -50; z <= 30; z += 10) { IK.iBeam(K, [-29.5, H - 1.0, z], [29.5, H - 1.0, z], { h: 1.6, w: 0.7 }); for (const x of [-20, -6, 6, 20]) IK.ceilingLight(K, [x, H - 1.8, z + 5], { w: 3.4, d: 0.8 }); }
  for (let x = -24; x <= 24; x += 12) IK.iBeam(K, [x, H - 0.7, -54.5], [x, H - 0.7, 34.5], { h: 1.0, w: 0.5 });
  // gantry crane on rails along the side walls
  for (const x of [-27, 27]) K.box(0.6, 0.8, 89, "paintYellow", [x, H - 4.2, -10]);
  K.box(54, 1.0, 1.2, "paintYellow", [0, H - 4.8, 4]); K.box(54, 0.3, 0.3, "dark", [0, H - 5.4, 3.3]); K.box(54, 0.3, 0.3, "dark", [0, H - 5.4, 4.7]);
  K.rbox(2.2, 1.2, 2.2, 0.1, "paintGrey", [-6, H - 5.9, 4]); for (const o of [-0.4, 0.4]) K.rod([-6 + o, H - 6.5, 4], [-6 + o, 6.5, 4], 0.03, "steel", 6);
  K.rbox(0.9, 0.7, 0.5, 0.06, "paintYellow", [-6, 6.2, 4]); K.torus(0.25, 0.07, "steel", [-6, 5.6, 4], [0, 0, 0], 16);
  for (const x of [-26.5, 26.5]) K.box(1.6, 1.4, 1.6, "paintYellow", [x, H - 4.8, 4]);
  // tube wall: hazard chevron surrounds, big painted numerals, blast door leaves, light bars
  const F = runs.f;
  for (const [x, n] of [[-15, 1], [0, 2], [15, 3]]) {
    const s = x + 29.75;
    for (const o of [-1, 1]) { K.box(0.8, 11, 0.5, "paintYellow", [x + o * 6.4, 5.5, -54.5]); for (let y = 0.6; y < 11; y += 1.2) K.box(0.82, 0.5, 0.05, "black", [x + o * 6.4, y, -54.22], [0, 0, o * 0.7]); }
    K.box(13.6, 0.8, 0.5, "paintYellow", [x, 10.4, -54.5]); for (let i = -6; i <= 6; i += 1.2) K.box(0.5, 0.82, 0.05, "black", [x + i, 10.4, -54.22], [0, 0, 0.7]);
    for (const o of [-1, 1]) K.box(4.9, 7.6, 0.3, "paintGrey", [x + o * 2.5, 4.4, -54.6]);
    K.box(0.06, 7.6, 0.32, "black", [x, 4.4, -54.6]); for (let y = 1.2; y < 8; y += 1.6) for (const o of [-1, 1]) K.box(4.4, 0.08, 0.32, "dark", [x + o * 2.5, y, -54.58]);
    hangarText(g, [x, 13.4, -54.68], 0, 5, 3.4, String(n), "rgba(230,200,90,.9)");
    IK.signPlate(g, F, s, 11.6, "TUBE " + n, "CATAPULT · " + ["PORT", "CENTRE", "STBD"][n - 1], { w: 3.2, h: 0.7, col: "#ffb040" });
  }
  // back wall: control room window over the deck, bay lettering, personnel door, equipment
  const B = runs.b;
  K.rbox(26, 4.4, 1.6, 0.2, "metal", [0, tier + 2.4, 34.1]); K.box(24, 2.8, 0.1, "lightC", [0, tier + 2.6, 33.3]); for (let x = -11; x <= 11; x += 2.75) K.box(0.25, 3.0, 0.3, "dark", [x, tier + 2.6, 33.25]);
  K.box(26, 0.3, 2.4, "metal", [0, tier, 33.6]); for (const hh of [0.55, 1.1]) K.rod([-13, tier + hh, 32.5], [13, tier + hh, 32.5], 0.035, "paintYellow", 8);
  hangarText(g, [-17, 16.5, 34.68], Math.PI, 14, 4.2, "BAY 2", "rgba(230,200,90,.8)"); hangarText(g, [16, 16.5, 34.68], Math.PI, 18, 2.2, "CNS HALCYON · CV-71", "rgba(230,230,230,.6)");
  IK.doorFrame(K, B, 36, 2.6, 3.0, { lit: "lightG" }); IK.doorFrame(K, B, 23.5, 2.6, 3.0, { lit: "lightA" });
  IK.pipeRun(K, B, { y: 1.6, d: 0.25, r: 0.12, flange: 3.2, skip: [[22, 25], [34.5, 37.5]] });
  // ground equipment along the walls
  const R = rnd(12);
  for (const side of [-1, 1]) for (let z = -44; z < 26; z += 14) {
    const x = side * 26.2;
    // missile rack: cradle frame with three rounds
    K.box(0.15, 1.6, 4.2, "paintGrey", [x - side * 0.6, 0.8, z]); K.box(0.15, 1.6, 4.2, "paintGrey", [x + side * 0.6, 0.8, z]);
    for (let r = 0; r < 3; r++) { K.cyl(0.18, 0.18, 3.4, "steel", [x, 0.45 + r * 0.5, z], [Math.PI / 2, 0, 0], 12); K.add(new THREE.ConeGeometry(0.18, 0.5, 12), "paintRed", [x, 0.45 + r * 0.5, z - 1.95], [-Math.PI / 2, 0, 0]); }
    // tool chest and gas cylinders
    K.rbox(1.0, 1.1, 0.6, 0.03, "paintRed", [x, 0.6, z + 4.5]); for (let i = 0; i < 5; i++) K.box(0.9, 0.012, 0.02, "steel", [x, 0.25 + i * 0.18, z + 4.5 - side * 0.0 + 0.31]);
    for (let i = 0; i < 4; i++) K.cyl(0.13, 0.13, 1.5, i % 2 ? "paintGreen" : "paintBlue", [x + side * 0.2, 0.75, z + 6.0 + i * 0.32], [0, 0, 0], 12);
    K.box(0.06, 1.2, 1.4, "dark", [x + side * 0.42, 0.9, z + 6.5]);
    if (R() < 0.6) { K.cyl(0.6, 0.6, 0.35, "paintYellow", [x - side * 0.4, 1.0, z + 8.6], [0, 0, Math.PI / 2], 18); K.torus(0.42, 0.1, "black", [x - side * 0.4, 1.0, z + 8.6], [0, Math.PI / 2, 0], 20); }
  }
  // fuel bowser
  K.rbox(2.2, 1.9, 5.2, 0.4, "paintOrange", [-21, 1.55, 22]); K.rbox(2.3, 0.4, 5.6, 0.05, "dark", [-21, 0.55, 22]);
  for (const sx of [-1, 1]) for (const sz of [-1.8, 1.8]) K.cyl(0.42, 0.42, 0.3, "rubber", [-21 + sx * 1.15, 0.42, 22 + sz], [0, 0, Math.PI / 2], 18);
  K.add(new THREE.CylinderGeometry(0.04, 0.04, 6, 8), "black", [-19.7, 0.6, 19], [Math.PI / 2, 0, 0.3]);
  K.build(g);
  // wall wash and work lights
  for (const [x, y, z] of [[-24, 4, -38], [24, 4, -38], [-24, 4, -12], [24, 4, -12], [-24, 4, 14], [24, 4, 14], [-24, 12, -25], [24, 12, -25], [-24, 12, 5], [24, 12, 5], [0, 9, 28], [-15, 9, -47], [15, 9, -47], [0, 12, -47]]) { const l = new THREE.PointLight(alert ? 0xffd0b0 : 0xffe8d0, alert ? 70 : 105, 34, 1.5); l.position.set(x, y, z); g.add(l); }
}

// a hinged canopy for the scramble: pivot at the rear of the cockpit glass
export const CANOPY = {
  kestrel: { c: [0, 0.8, -3], s: [0.95, 0.72, 1.9] }, lancer: { c: [0, 1.2, -4], s: [1.0, 0.7, 2.0] }, warden: { c: [0, 2.0, -4.5], s: [1.1, 0.66, 2.1] },
  longbow: { c: [0, 2.6, -7], s: [1.3, 0.66, 2.2] }, wraith: { c: [0, 1.4, -3], s: [0.9, 0.5, 2.0] },
};
export function makeCanopy(type, fit) {
  const C = fit ? { c: fit.p, s: fit.sz } : (CANOPY[type] || CANOPY.lancer);   // fit = the model's own dome, so it matches the fuselage
  const piv = new THREE.Group(); piv.position.set(C.c[0], C.c[1], C.c[2] + C.s[2] * 0.95);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x88aacc, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }));
  glass.scale.set(C.s[0], C.s[1], C.s[2]); glass.position.set(0, 0, -C.s[2] * 0.95); piv.add(glass);
  const fr = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.8, roughness: 0.4 });
  // thin frame: sill ring and one bow, both scaled to sit on the glass rather than stand off it
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 48), fr); rim.rotation.x = Math.PI / 2; rim.scale.set(C.s[0], C.s[2], 1); rim.position.copy(glass.position); piv.add(rim);
  const bz = 0.35, ry = Math.sqrt(1 - bz * bz);   // bow sits where the dome's cross-section is (ry * size)
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 24, Math.PI), fr); arch.scale.set(C.s[0] * ry, C.s[1] * ry, 1); arch.position.set(0, 0, -C.s[2] * 0.95 + C.s[2] * bz); piv.add(arch);
  piv.userData.seat = new V3(C.c[0], C.c[1] - C.s[1] * 0.9 - 0.4, C.c[2]);
  return piv;
}

// A canvas tarp draped over a parked ship (for prototypes the player hasn't been cleared for): the sheet is a
// heightfield raycast down onto the ship, dilated so it slumps to the deck, with wrinkles, tie-downs and a stencil.
export function makeTarp(shipObj, stencil = "R&D") {
  shipObj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(shipObj), size = box.getSize(new V3()), ctr = box.getCenter(new V3());
  const W = size.x + 3, L = size.z + 3, N = 64, base = shipObj.parent ? shipObj.parent.worldToLocal(new V3(0, 0, 0)).y : 0;
  const meshes = []; shipObj.traverse(o => { if (o.isMesh && o.visible && !(o.material && o.material.transparent)) meshes.push(o); });
  const ray = new THREE.Raycaster(); const H = new Float32Array((N + 1) * (N + 1)).fill(-1), down = new V3(0, -1, 0);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = ctr.x - W / 2 + (i / N) * W, z = ctr.z - L / 2 + (j / N) * L;
    ray.set(new V3(x, box.max.y + 5, z), down); const hit = ray.intersectObjects(meshes, false)[0];
    if (hit) H[j * (N + 1) + i] = hit.point.y + 0.12;
  }
  // smooth over gaps (fins, antennae) and let the cloth fall away to the deck
  const floorY = box.min.y - 2.0, step = (W / N) * 0.9;
  for (let pass = 0; pass < N; pass++) for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * (N + 1) + i; let m = H[k];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > N || jj > N) continue; m = Math.max(m, H[jj * (N + 1) + ii] - step); }
    H[k] = Math.max(m, floorY);
  }
  const g = new THREE.PlaneGeometry(W, L, N, N); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * (N + 1) + i, x = ctr.x - W / 2 + (i / N) * W, z = ctr.z - L / 2 + (j / N) * L;
    const wr = Math.sin(x * 1.7 + z * 0.4) * 0.05 + Math.sin(z * 2.3 - x * 0.7) * 0.04;
    p.setXYZ(k, x, Math.max(floorY + 0.03, H[k] + wr), z);
  }
  g.computeVertexNormals();
  // canvas texture: olive drab, seams, grime, big stencil
  const c = document.createElement("canvas"); c.width = 1024; c.height = Math.round(1024 * L / W); const x = c.getContext("2d");
  x.fillStyle = "#4a4a32"; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? "20,20,10" : "120,120,90"},${Math.random() * 0.08})`; x.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 3); }
  x.strokeStyle = "rgba(25,25,15,.6)"; x.lineWidth = 4; for (let t = 1; t < 4; t++) { x.beginPath(); x.moveTo(c.width * t / 4, 0); x.lineTo(c.width * t / 4, c.height); x.stroke(); }
  x.save(); x.translate(c.width / 2, c.height * 0.5);   // reads upright from the deck's main viewpoint (nose toward the camera)
  x.fillStyle = "rgba(225,215,170,.82)"; x.font = `800 ${Math.round(c.width * 0.26)}px 'Chakra Petch', 'DejaVu Sans', sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(stencil, 0, 0);
  x.font = `700 ${Math.round(c.width * 0.05)}px 'Share Tech Mono', monospace`; x.fillText("RESTRICTED · AUTHORIZED PERSONNEL ONLY", 0, c.width * 0.2);
  x.restore();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const tarp = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
  const grp = new THREE.Group(); grp.add(tarp);
  // tie-down straps at the corners and a ring of hazard stanchions with rope
  const yel = new THREE.MeshStandardMaterial({ color: 0xd8b020, roughness: 0.6 }), dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
  const R = Math.max(W, L) * 0.5 + 1.5, posts = 10;
  for (let i = 0; i < posts; i++) {
    const a = i / posts * Math.PI * 2, px = ctr.x + Math.cos(a) * (W / 2 + 1.6), pz = ctr.z + Math.sin(a) * (L / 2 + 1.6);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 10), yel); post.position.set(px, floorY + 0.5, pz); grp.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.08, 14), dark); foot.position.set(px, floorY + 0.04, pz); grp.add(foot);
    const b = i + 1, bx = ctr.x + Math.cos(b / posts * Math.PI * 2) * (W / 2 + 1.6), bz = ctr.z + Math.sin(b / posts * Math.PI * 2) * (L / 2 + 1.6);
    const len = Math.hypot(bx - px, bz - pz), rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), i % 2 ? yel : dark);
    rope.position.set((px + bx) / 2, floorY + 0.92, (pz + bz) / 2); rope.rotation.set(0, -Math.atan2(bz - pz, bx - px), Math.PI / 2); grp.add(rope);
  }
  const sign = document.createElement("canvas"); sign.width = 512; sign.height = 256; const sx = sign.getContext("2d");
  sx.fillStyle = "#b8201a"; sx.fillRect(0, 0, 512, 256); sx.fillStyle = "#fff"; sx.textAlign = "center"; sx.font = "800 70px 'Chakra Petch', sans-serif"; sx.fillText("RESTRICTED", 256, 110); sx.font = "700 34px 'Share Tech Mono', monospace"; sx.fillText("R&D · PAD 4 · NO ENTRY", 256, 180);
  const st = new THREE.CanvasTexture(sign); st.colorSpace = THREE.SRGBColorSpace;
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshStandardMaterial({ map: st, roughness: 0.6, side: THREE.DoubleSide }));
  sm.position.set(ctr.x, floorY + 1.45, ctr.z + L / 2 + 1.7); grp.add(sm);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), dark); sp.position.set(ctr.x, floorY + 0.7, ctr.z + L / 2 + 1.7); grp.add(sp);
  return grp;
}
