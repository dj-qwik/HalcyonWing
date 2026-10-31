// HALCYON WING — full crew figures for rooms and cutscenes: a live bust (face, hair, jaw,
// blinking, eye contact) on a posable flight-suit body. Built in MakeHuman units (~10 cm),
// scaled to metres. Root sits at floor level; +Z is the direction the figure faces.
import * as THREE from "three";
import { makeBust, poseBust, SUIT, fabricTex } from "./portraits.js";

const V3 = THREE.Vector3;
export const FIG_SCALE = 0.104;
const cache = new Map();

function limb(len, r0, r1, mat) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry((r0 + r1) / 2, len, 6, 14), mat); m.position.y = -len / 2; m.scale.set(r0 / ((r0 + r1) / 2), 1, r0 / ((r0 + r1) / 2) * 0.92); g.add(m);
  return g;
}
export function makeFigure(id, opts = {}) {
  const rig = makeBust(id); if (!rig) return null;
  rig.group.position.y = 0;
  // trim the portrait bust down to head, neck and collar so the body takes over below
  rig.group.traverse(o => {
    if (!o.isMesh || !o.geometry.index || o.geometry.attributes.position.count < 500) return;
    const p = o.geometry.attributes.position, idx = o.geometry.index.array, keep = [];
    const ok = i => p.getY(i) > 5.32 && Math.abs(p.getX(i)) < 1.75;
    for (let i = 0; i < idx.length; i += 3) if (ok(idx[i]) && ok(idx[i + 1]) && ok(idx[i + 2])) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    o.geometry.setIndex(keep);
  });
  const vh = DATA_VHARR.has(id);
  const suitCol = opts.suit || SUIT[id] || "#3a4a5a";
  const suit = new THREE.MeshStandardMaterial({ map: fabricTex(suitCol, vh), roughness: 0.85, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.65, metalness: 0.2 });
  const glove = new THREE.MeshStandardMaterial({ color: vh ? 0x2a1810 : 0x241c16, roughness: 0.7 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.9, roughness: 0.3 });
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body); body.scale.setScalar(FIG_SCALE * (vh ? 1.08 : 1));
  body.add(rig.group);
  // torso
  const prof = [[0, 5.6], [0.9, 5.62], [1.5, 5.45], [1.95, 4.8], [1.95, 4.0], [1.78, 3.0], [1.55, 1.9], [1.62, 0.8], [1.6, 0.05], [0, 0.0]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), suit); torso.scale.set(1, 1, 0.62); torso.position.z = 0.25; body.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(1.66, 1.66, 0.45, 32), dark); belt.scale.set(1, 1, 0.64); belt.position.set(0, 0.85, 0.25); body.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.12), metal); buckle.position.set(0, 0.85, 1.32); body.add(buckle);
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.2, 0.06), metal); zip.position.set(0, 3.0, 1.38); zip.rotation.x = -0.06; body.add(zip);
  for (const s of [-1, 1]) { const pk = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.15), suit); pk.position.set(s * 0.95, 3.75, 1.3); pk.rotation.y = s * 0.25; body.add(pk); }
  // limbs
  const L = {};
  for (const s of [-1, 1]) {
    const k = s < 0 ? "r" : "l";
    const sh = new THREE.Group(); sh.position.set(s * 1.9, 4.8, 0.25); body.add(sh);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 12), suit); cap.scale.set(1, 0.85, 1); sh.add(cap);
    const ua = limb(2.8, 0.55, 0.48, suit); sh.add(ua);
    const el = new THREE.Group(); el.position.y = -2.85; ua.add(el);
    const fa = limb(2.5, 0.46, 0.38, suit); el.add(fa);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.35, 14), dark); cuff.position.y = -2.4; fa.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), glove); hand.scale.set(0.8, 1.25, 0.6); hand.position.y = -2.95; fa.add(hand);
    L["sh" + k] = sh; L["el" + k] = el;
    const hip = new THREE.Group(); hip.position.set(s * 0.82, 0.1, 0.25); body.add(hip);
    const th = limb(3.9, 0.78, 0.6, suit); hip.add(th);
    const kn = new THREE.Group(); kn.position.y = -3.95; th.add(kn);
    const kp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), dark); kp.scale.set(1, 0.9, 0.6); kp.position.set(0, 0.1, 0.45); kn.add(kp);
    const sn = limb(3.6, 0.58, 0.48, suit); kn.add(sn);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 1.9), dark); boot.position.set(0, -3.9, 0.45); sn.add(boot);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 2.0), new THREE.MeshStandardMaterial({ color: 0x0a0a0a })); sole.position.set(0, -4.45, 0.48); sn.add(sole);
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
  set(L.shl, 0.05, 0, 0.16); set(L.shr, 0.05, 0, -0.16); set(L.ell, -0.25); set(L.elr, -0.25);
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
  if (pose === "armsCrossed") { set(L.shl, -0.45, 0, -0.32); set(L.shr, -0.5, 0, 0.32); set(L.ell, -1.75, 0.0, -0.9); set(L.elr, -1.75, 0.0, 0.9); }
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
