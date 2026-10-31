// HALCYON WING — full crew figures for rooms and cutscenes: a live bust (face, hair, jaw,
// blinking, eye contact) on a posable flight-suit body. Built in MakeHuman units (~10 cm),
// scaled to metres. Root sits at floor level; +Z is the direction the figure faces.
import * as THREE from "three";
import { makeBust, poseBust, SUIT, fabricTex } from "./portraits.js";

const V3 = THREE.Vector3;
export const FIG_SCALE = 0.104;
const cache = new Map();

// tapered, muscle-shaped limb: prof is [[t 0..1 down the bone, radius], ...]; depth squashes front-to-back
function limb(len, prof, mat, depth = 0.9, fwd = 0) {
  const g = new THREE.Group();
  const pts = [new THREE.Vector2(0.001, 0)];
  for (const [t, r] of prof) pts.push(new THREE.Vector2(r, -t * len));
  pts.push(new THREE.Vector2(0.001, -len));
  // round the ends: extra rings near the joints
  const geo = new THREE.LatheGeometry(pts, 20); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.scale.set(1, 1, depth); m.position.z = fwd; g.add(m);
  return g;
}
// superellipse loft for the torso: sections of [y, halfWidth, halfDepth, zOffset, exponent]
function loftBody(secs, seg = 40) {
  const pos = [], idx = [], uv = [];
  secs.forEach(([y, w, d, z0, n], j) => {
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const px = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * w, pz = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * d + z0;
      pos.push(px, y, pz); uv.push(i / seg, j / (secs.length - 1)); }
  });
  for (let j = 0; j < secs.length - 1; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  // caps
  const capOf = (j, down) => { const c = pos.length / 3; const [y, , , z0] = secs[j]; pos.push(0, y, z0); uv.push(0.5, 0.5);
    for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i; down ? idx.push(c, a + 1, a) : idx.push(c, a, a + 1); } };
  capOf(0, true); capOf(secs.length - 1, false);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function gloveHand(mat, s) {
  // palm, four fingers in a loose curl, thumb angled in front
  const h = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), mat); palm.scale.set(1.25, 1, 0.62); palm.position.y = -0.3; h.add(palm);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42 - Math.abs(i - 1.5) * 0.06, 3, 8), mat); f.position.set((i - 1.5) * 0.115, -0.78, 0.05); f.rotation.x = 0.35; h.add(f); }
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.32, 3, 8), mat); th.position.set(s * -0.24, -0.38, 0.14); th.rotation.set(0.5, 0, s * 0.55); h.add(th);
  return h;
}
export function makeFigure(id, opts = {}) {
  const rig = makeBust(id); if (!rig) return null;
  // the cast was sculpted at different heights, so align each head by its own anatomy: the bust's collar band marks
  // the base of its neck; shift the head so that point lands on the body's collar, and trim relative to it
  const NECK_BASE = 6.08;   // where the bust's neck meets the suit collar: a natural chin-to-shoulder distance
  let band = null; rig.group.traverse(o => { if (!o.isMesh || o.material.map) return; const n = o.geometry.attributes.position.count; if (n < 700 || n > 1200) return;
    o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; if (bb.max.x - bb.min.x > 1.0 && bb.max.y - bb.min.y < 0.7) band = o; });
  const dy = band ? NECK_BASE - band.geometry.boundingBox.min.y : 0;
  rig.group.position.y = dy;
  // trim the portrait bust down to head and neck, so the sculpted body takes over cleanly below
  rig.group.traverse(o => {
    if (!o.isMesh || !o.geometry.index || o.geometry.attributes.position.count < 500) return;
    const p = o.geometry.attributes.position, idx = o.geometry.index.array, keep = [];
    const ok = i => { const y = p.getY(i) + dy; return y > NECK_BASE - 0.5 && (Math.abs(p.getX(i)) < 0.86 || y > NECK_BASE + 0.3); };   // side cut only below the jaw
    for (let i = 0; i < idx.length; i += 3) if (ok(idx[i]) && ok(idx[i + 1]) && ok(idx[i + 2])) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    o.geometry.setIndex(keep);
  });
  // drop the bust's own clothing — its sculpted collar layer, collar band, suit shoulders and what rides on them
  // (patch, rank bars): the body below supplies the collar, so the bare neck rises cleanly out of it
  let patchMat = null, spikeMat = null; rig.group.updateMatrixWorld(true); const drop = band ? [band] : [];
  let skinN = 0; rig.group.traverse(o => { if (o.isMesh && o.geometry.index && o.geometry.index.count > skinN) skinN = o.geometry.index.count; });
  rig.group.traverse(o => { if (!o.isMesh || o === band) return; const g = o.geometry; g.computeBoundingBox(); const bb = g.boundingBox, n = g.attributes.position.count;
    const wp = o.getWorldPosition(new V3());   // includes dy
    if (n >= 500 && o.material.type === "MeshStandardMaterial" && o.material.map && g.index && g.index.count < skinN) { drop.push(o); return; }   // cloth collar layer
    if (n < 500 && bb.max.x - bb.min.x > 3 && bb.max.y + dy < 7.2) drop.push(o);                    // suit shoulder shell
    else if (n < 100 && wp.y < NECK_BASE + 0.45 && Math.abs(wp.x) > 0.5) { if (o.material.map && !patchMat) patchMat = o.material; drop.push(o); }   // patch / insignia on it
    else if (wp.y < NECK_BASE + 0.45 && Math.abs(wp.x) > 1.0) { if (!spikeMat) spikeMat = o.material; drop.push(o); }   // Vharr pauldron spikes: remounted on the shoulders below
  });
  for (const o of drop) o.parent.remove(o);
  const vh = DATA_VHARR.has(id);
  const suitCol = opts.suit || SUIT[id] || "#3a4a5a";
  const suit = new THREE.MeshStandardMaterial({ map: fabricTex(suitCol, vh), roughness: 0.85, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.65, metalness: 0.2 });
  const glove = new THREE.MeshStandardMaterial({ color: vh ? 0x2a1810 : 0x241c16, roughness: 0.7 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.9, roughness: 0.3 });
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body); body.scale.setScalar(FIG_SCALE * (vh ? 1.08 : 1));
  body.add(rig.group);
  // torso: pelvis, waist, ribcage, chest, armpits, deltoid line, trapezius slope, neck base
  const torso = new THREE.Mesh(loftBody([
    [-0.1, 1.45, 0.92, 0.12, 2.6], [0.6, 1.58, 0.98, 0.14, 2.6], [1.4, 1.5, 0.92, 0.16, 2.5], [2.1, 1.42, 0.9, 0.17, 2.4],
    [3.0, 1.55, 0.98, 0.2, 2.4], [3.8, 1.72, 1.06, 0.24, 2.5], [4.4, 1.9, 1.02, 0.2, 2.7], [4.85, 1.98, 0.88, 0.14, 3.0],
    [5.12, 1.68, 0.74, 0.1, 2.6], [5.38, 1.08, 0.66, 0.08, 2.2], [5.55, 0.78, 0.64, 0.1, 2], [5.8, 0.64, 0.58, 0.08, 2], [6.1, 0.6, 0.56, 0.04, 2]]), suit);   // high flight-suit collar up under the jaw
  body.add(torso);
  // flight-suit details: collar ring, belt, buckle, zip, chest pockets, shoulder seams
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 28), dark); collar.rotation.x = Math.PI / 2; collar.scale.set(1, 0.92, 1); collar.position.set(0, 6.1, 0.04); body.add(collar);
  const belt = new THREE.Mesh(loftBody([[0.62, 1.6, 1.0, 0.14, 2.6], [1.02, 1.56, 0.97, 0.15, 2.6]]), dark); body.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 0.12), metal); buckle.position.set(0, 0.82, 1.14); body.add(buckle);
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 4.5, 0.05), metal); zip.position.set(0, 3.25, 1.24); zip.rotation.x = -0.035; body.add(zip);
  for (const s of [-1, 1]) { const pk = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.66, 0.06), suit); pk.position.set(s * 0.92, 3.85, 1.25); pk.rotation.y = s * 0.2; body.add(pk); }
  // limbs — joints sit inside the body volume so nothing reads as a ball stuck on the outside
  const L = {};
  for (const s of [-1, 1]) {
    const k = s < 0 ? "r" : "l";
    const sh = new THREE.Group(); sh.position.set(s * 1.56, 4.68, 0.14); body.add(sh);
    // deltoid: an ellipsoid that rides with the arm and overlaps the torso's shoulder line
    const del = new THREE.Mesh(new THREE.SphereGeometry(0.56, 18, 12), suit); del.scale.set(0.9, 1.2, 0.95); del.position.set(s * 0.1, -0.36, 0); sh.add(del);
    const ua = limb(2.75, [[0, 0.5], [0.15, 0.56], [0.45, 0.52], [0.8, 0.43], [1, 0.4]], suit, 0.92); ua.position.x = s * 0.18; sh.add(ua);
    const el = new THREE.Group(); el.position.y = -2.72; ua.add(el);
    if (vh && !spikeMat) spikeMat = new THREE.MeshStandardMaterial({ color: { ember: 0xc8b8a0, kaerr: 0x9a1a1a, shkara: 0xefeae0 }[id] || 0xa08060, roughness: 0.45, metalness: 0.1 });
    if (vh && spikeMat) for (let j = 0; j < 3; j++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.15 - j * 0.18, 8), spikeMat); sp.position.set(s * (0.5 + j * 0.04), 0.42 - j * 0.04, -0.3 + j * 0.3); sp.rotation.set(-0.2 + j * 0.2, 0, -s * (0.55 + j * 0.15)); sh.add(sp); }   // Vharr shoulder spikes
    if (s > 0 && patchMat) { const pt = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), patchMat); pt.position.set(0.5, -0.78, 0.02); pt.rotation.y = Math.PI / 2; ua.add(pt); }   // squadron patch on the left sleeve
    const fa = limb(2.4, [[0, 0.4], [0.18, 0.43], [0.5, 0.38], [0.9, 0.3], [1, 0.29]], suit, 0.85); el.add(fa);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.3, 16), dark); cuff.scale.z = 0.85; cuff.position.y = -2.3; fa.add(cuff);
    const hand = gloveHand(glove, s); hand.position.y = -2.42; fa.add(hand);
    L["sh" + k] = sh; L["el" + k] = el; L["hand" + k] = hand;
    const hip = new THREE.Group(); hip.position.set(s * 0.78, 0.1, 0.14); body.add(hip);
    const th = limb(3.95, [[0, 0.8], [0.12, 0.82], [0.45, 0.72], [0.85, 0.56], [1, 0.52]], suit, 0.95); hip.add(th);
    const kn = new THREE.Group(); kn.position.y = -3.95; th.add(kn);
    
    const sn = limb(3.55, [[0, 0.52], [0.25, 0.58], [0.6, 0.45], [0.9, 0.36], [1, 0.35]], suit, 0.92); kn.add(sn);
    // boot: shaft, ankle, foot and sole
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.42, 1.4, 18), dark); shaft.scale.z = 0.95; shaft.position.y = -3.25; sn.add(shaft);
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.15, 4, 12), dark); foot.rotation.x = Math.PI / 2; foot.scale.set(1.0, 1, 0.78); foot.position.set(0, -4.12, 0.42); sn.add(foot);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.14, 2.05), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 })); sole.position.set(0, -4.48, 0.42); sn.add(sole);
    L["hip" + k] = hip; L["kn" + k] = kn;
  }
  root.userData = { id, rig, L, body, pose: opts.pose || "stand", phase: Math.random() * 6, vh };
  setPose(root, root.userData.pose);
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return root;
}
const DATA_VHARR = new Set(["ember", "kaerr", "shkara", "vharrpilot"]);

export function setPose(f, pose) {
  const U = f.userData, L = U.L; U.pose = pose;
  const set = (g, x = 0, y = 0, z = 0) => g.rotation.set(x, y, z);
  // standing defaults
  set(L.shl, 0.05, 0, 0.12); set(L.shr, 0.05, 0, -0.12); set(L.ell, -0.22); set(L.elr, -0.22);
  set(L.hipl, 0, 0, 0.03); set(L.hipr, 0, 0, -0.03); set(L.knl); set(L.knr);
  U.body.position.set(0, 8.75 * FIG_SCALE, 0); U.body.rotation.set(0, 0, 0);
  if (pose === "sit" || pose === "sitTable" || pose === "sitBack") {
    U.body.position.y = 4.55 * FIG_SCALE * (U.vh ? 1.08 : 1);
    for (const k of ["l", "r"]) { set(L["hip" + k], -1.5, 0, k === "l" ? 0.08 : -0.08); set(L["kn" + k], 1.45); }
    if (pose === "sitTable") { set(L.shl, -0.95, 0, 0.25); set(L.shr, -0.95, 0, -0.25); set(L.ell, -1.2); set(L.elr, -1.2); }
    else { set(L.shl, -0.35, 0, 0.12); set(L.shr, -0.35, 0, -0.12); set(L.ell, -1.15); set(L.elr, -1.15); }
    if (pose === "sitBack") U.body.rotation.x = -0.08;
  }
  if (pose === "lean") { set(L.shr, -1.1, 0, -0.35); set(L.elr, -1.4); set(L.hipl, 0, 0, 0.1); set(L.knl, 0.15); U.body.rotation.z = 0.04; }
  if (pose === "point") { set(L.shr, -1.4, 0, -0.55); set(L.elr, -0.15); }
  if (L.handl) { L.handl.visible = L.handr.visible = true; }
  if (pose === "armsCrossed") {   // forearms fold across the chest; hands tuck under the opposite upper arm
    set(L.shl, -0.36, 0, -0.16); set(L.shr, -0.52, 0, 0.16); set(L.ell, -1.95, 0.0, -0.86); set(L.elr, -1.8, 0.0, 0.86);
    if (L.handl) { L.handl.visible = L.handr.visible = false; } }
  if (pose === "salute") { set(L.shr, -1.3, 0, -1.2); set(L.elr, -2.3); }
}
// per-frame: idle sway / run cycle; talk 0..1; camera for eye contact; face = yaw toward look target
export function updateFigure(f, t, dt, talk = 0, camera, lookYaw = 0) {
  const U = f.userData, L = U.L; const ph = t * 7 + U.phase;
  if (U.pose === "run") {
    const s = Math.sin(ph);
    L.hipl.rotation.x = s * 0.75; L.hipr.rotation.x = -s * 0.75; L.knl.rotation.x = Math.max(0, -s) * 1.3 + 0.2; L.knr.rotation.x = Math.max(0, s) * 1.3 + 0.2;
    L.shl.rotation.x = -s * 0.7; L.shr.rotation.x = s * 0.7; L.ell.rotation.x = -1.3; L.elr.rotation.x = -1.3;
    U.body.position.y = 8.6 * FIG_SCALE + Math.abs(Math.cos(ph)) * 0.05; U.body.rotation.x = 0.18;
  } else if (U.pose === "stand" || U.pose === "armsCrossed" || U.pose === "point") {
    U.body.rotation.z = Math.sin(t * 0.6 + U.phase) * 0.012;
  }
  if (U.pose === "point") L.shr.rotation.x = -1.4 + Math.sin(t * 1.3) * 0.08;
  poseBust(U.rig, talk, t + U.phase, camera, lookYaw);
}
// world position of the figure's eyes (for camera framing)
export function headPos(f, out = new V3()) {
  const r = f.userData.rig; if (!r || !r.eyes.length) return f.getWorldPosition(out).add(new V3(0, 1.65, 0));
  const a = new V3(), b = new V3(); r.eyes[0].getWorldPosition(a); r.eyes[1].getWorldPosition(b); return out.copy(a).add(b).multiplyScalar(0.5);
}
export function figureCached(id, opts) { const k = id; let f = cache.get(k); if (!f) { f = makeFigure(id, opts); if (f) cache.set(k, f); } if (f) { if (f.parent) f.parent.remove(f); setPose(f, opts?.pose || "stand"); } return f; }
