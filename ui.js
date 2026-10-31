// HALCYON WING — campaign flow, carrier hub, briefings, cinematics, menus.
import * as THREE from "three";
import { C, init, sfx, voice, pad, ACTIONS, DEFAULT_BINDS, binds, saveBinds, resetBinds, capture, applyQuality, startMission, clearWorld, buildNavEnv, explode, cineStep, fireBolt, abortMission, finishMission, debugNav, spawnGroup, consumeEdges, exitPointer, kill, damage } from "./core.js";
import * as M from "./models.js";
import { drawPortrait, preloadPortraits, castReady } from "./portraits.js";
import { figureCached, updateFigure, headPos, setPose } from "./crew.js";
import * as ROOMS from "./rooms.js";
import { WORLD, CAST, SHIPS, MISSIONS, CUTSCENES, ENDINGS, MEDALS, REACT, LOUNGE_VISITS, RANKS, RANK_SHORT, RANK_ADDR, RANK_PTS, PTS, GUNS, MISSILES } from "./story.js";

const $ = id => document.getElementById(id);
const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const MAIN = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m9b", "m10", "m11", "m12"];
for (const [k, m] of Object.entries(MISSIONS)) m.id = k;
const SAVE_KEY = "halcyonwing.save.v1";

// ======================================================================= STATE / SAVE
let camp = null;
function newCamp(name, callsign, diff) {
  return { name, callsign, diff, rank: 0, kills: 0, sorties: 0, wins: 0, medals: ["calder"].slice(0, 0), current: "m1", flags: {}, morale: {}, wingKills: {}, history: [], seen: {}, resume: null, done: [], aceKills: [], unlocked: ["kestrel"], points: 0, perfect: [], secDone: 0, secTotal: 0, addr: RANK_ADDR[0] };
}
// ships the pilot has been issued so far (the Kestrel from day one, then each new airframe as it is revealed)
const SHIP_ORDER = ["kestrel", "lancer", "longbow", "warden", "wraith"];
function unlockedShips(c) {
  const set = new Set(["kestrel", ...((c && c.unlocked) || [])]);
  if (c) for (const id of c.done || []) if (MISSIONS[id]) set.add(MISSIONS[id].ship);
  return SHIP_ORDER.filter(t => set.has(t));
}
const REVEAL = {
  lancer: [["rabbit", "Here she is. Lancer F-31. Four guns now: mass drivers on the wings that hit half again as hard as those lasers, and image-recognition missiles that lock from any angle."], ["rabbit", "Twice the firepower of a Kestrel and she still turns inside anything the Vharr fly. Bring her back in one piece."]],
  longbow: [["rabbit", "Longbow B-9. She's a pig in a dogfight, so don't try. Lance torpedoes under the belly: nine hundred points of damage each, the only thing we fly that kills a capital ship. Armour like a carrier's hull."], ["rabbit", "You point her at something big, and it stops being big."]],
  warden: [["rabbit", "The Warden. Neutron guns that hit like a freight train, particle cannons with reach, and Swarm Pods: one pull, four seekers. The best shields this fleet owns."], ["rabbit", "Don't make me write him a letter about one."]],
  wraith: [["rabbit", "Nobody outside this deck knows she exists. Wraith XF-90. Three tachyon cannons, the fastest bolts in the fleet, and a cloak built from what Danny brought home."], ["rabbit", "Drop the cloak right on someone's tail and the first two seconds hit twice as hard. Ambush strike, R&D calls it. If you lose her, come back anyway. I mean it."]],
};
function revealCine(t) {
  return [{ scene: "ship_reveal", ship: t, dur: 13, caption: `New spacecraft assigned · ${SHIPS[t].cls}`, lines: REVEAL[t] || [] }];
}
function rankFor(p) { let r = 0; RANK_PTS.forEach((v, i) => { if (p >= v) r = i; }); return r; }
function addr() { return RANK_ADDR[camp ? camp.rank : 0] || "Pilot"; }
function fmtLine(t) { return String(t).replace(/\{callsign\}/g, camp?.callsign || "Rookie").replace(/\{rank\}/g, addr()); }
// older saves: rebuild points from wins, map onto the new ladder
function migrate(c) { if (!c) return c; if (c.points == null) { c.points = (c.wins || 0) * PTS.primary; c.rank = rankFor(c.points); } c.perfect = c.perfect || []; c.secDone = c.secDone || 0; c.secTotal = c.secTotal || 0; c.addr = RANK_ADDR[c.rank]; return c; }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(camp)); } catch (e) { } }
function load() { try { const s = localStorage.getItem(SAVE_KEY); return s ? migrate(JSON.parse(s)) : null; } catch (e) { return null; } }
function loadOpts() { try { const o = JSON.parse(localStorage.getItem("halcyonwing.opts") || "null"); if (o) Object.assign(C.opts, o); } catch (e) { } }
function saveOpts() { try { localStorage.setItem("halcyonwing.opts", JSON.stringify(C.opts)); } catch (e) { } }

// ======================================================================= SCREENS
const screens = ["boot", "title", "newpilot", "hub", "brief", "debrief", "kia", "pause", "options", "controls", "ending"];
let backStack = [];
function show(id, keep) {
  for (const s of screens) $(s).hidden = s !== id && !(keep && keep.includes(s));
  $("credit").hidden = !(id === "title" || id === "boot");
  focusFirst();
}
function focusFirst() { setTimeout(() => { const el = topScreen()?.querySelector(".btn.primary:not([disabled]), .btn:not([disabled])"); if (el && pad.connected) setFocus(el); }, 30); }
function topScreen() { if (!$("cine").hidden) return $("cine"); for (const s of ["controls", "options", "pause", "kia", "debrief", "ending", "newpilot", "brief", "hub", "title", "boot"]) if (!$(s).hidden) return $(s); return null; }
let focusEl = null;
function setFocus(el) { if (focusEl) focusEl.classList.remove("focus"); focusEl = el; if (el) { el.classList.add("focus"); el.focus({ preventScroll: false }); } }
function toast(t, ms = 2400) { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); }
function fullscreen() {
  const d = document;
  if (d.fullscreenElement) { d.exitFullscreen && d.exitFullscreen().catch(() => { }); return; }
  const el = d.documentElement; const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : null;
  if (p && p.catch) p.catch(() => toast("Fullscreen isn't available in this view. Open the page in its own tab."));
  else if (!p) toast("Fullscreen isn't available in this view.");
}

// gamepad menu navigation
let navCd = 0;
function menuPad(dt) {
  if (!pad.connected) return;
  if (capture.fn || performance.now() - capEnd < 300) return;   // a controller button is being bound
  navCd -= dt;
  const scr = topScreen(); if (!scr) return;
  const els = [...scr.querySelectorAll(".btn, .crew button")].filter(e => !e.disabled && e.offsetParent !== null && !e.classList.contains("hidden"));
  if (!els.length) return;
  if (!focusEl || !els.includes(focusEl)) setFocus(els[0]);
  const ax = pad.axes[0], ay = pad.axes[1];
  let dir = null;
  if (pad.pressed.has(12) || (ay < -0.6 && navCd <= 0)) dir = [0, -1];
  if (pad.pressed.has(13) || (ay > 0.6 && navCd <= 0)) dir = [0, 1];
  if (pad.pressed.has(14) || (ax < -0.6 && navCd <= 0)) dir = [-1, 0];
  if (pad.pressed.has(15) || (ax > 0.6 && navCd <= 0)) dir = [1, 0];
  if (dir) {
    navCd = 0.22; const r0 = focusEl.getBoundingClientRect(); const c0 = [r0.x + r0.width / 2, r0.y + r0.height / 2];
    let best = null, bs = 1e9;
    for (const e of els) { if (e === focusEl) continue; const r = e.getBoundingClientRect(); const dx = r.x + r.width / 2 - c0[0], dy = r.y + r.height / 2 - c0[1]; const along = dx * dir[0] + dy * dir[1]; if (along <= 4) continue; const perp = Math.abs(dx * dir[1] - dy * dir[0]); const sc = along + perp * 2.5; if (sc < bs) { bs = sc; best = e; } }
    if (best) { setFocus(best); sfx.cue("u_focus", 0.3, {}, 1400, 0.02, 0.04); }
  }
  if (pad.pressed.has(0) && focusEl) { focusEl.click(); }
  if (pad.pressed.has(1)) { const b = scr.querySelector("[data-back]"); if (b) b.click(); }
}

// ======================================================================= STAGES (in-engine cinematics)
let stage = null;
function put(type, pos, rot = [0, 0, 0], model) {
  const r = M.buildShip(model || type); r.obj.position.set(...pos); r.obj.rotation.set(...rot); C.world.add(r.obj); return r;
}
function glowEngines(r, k = 1) { for (const e of r.eng || []) e.scale.setScalar(e.userData.base * k * (0.9 + Math.random() * 0.2)); }
function fwd(o) { return new V3(0, 0, -1).applyQuaternion(o.quaternion); }
function aim(o, p) { o.lookAt(p); o.rotateY(Math.PI); }
function baseStage(env) {
  C.indoor = false; C.fill.color.set(0x8aa8d8); C.fill.groundColor.set(0x2a2018);
  C.camera.fov = env.fov || 55; C.camera.updateProjectionMatrix(); C.sun.intensity = 3.2; C.fill.intensity = 0.55; C.bloom.strength = 0.85;
  clearWorld(false); C.ents = []; C.mission = null; C.navIdx = 0;
  C.cockpit.visible = false; C.dust.visible = false;
  buildNavEnv(env);
  C.camera.up.set(0, 1, 0);
}
function heroLight(sx, sy, sz) { if (sx !== undefined) C.sun.position.set(sx, sy, sz).normalize(); C.fill.intensity = 0.95; C.fill.color.set(0x9ab0d0); C.fill.groundColor.set(0x34507a); C.bloom.strength = 0.5; }   // the Halcyon is always shown lit and crisp, never murky
function cam(p, l) { C.camera.position.set(...p); C.camera.lookAt(l instanceof V3 ? l : new V3(...l)); }
const cineOwner = { team: "cine", vel: new V3() };
function shoot(r, gun) { const o = r.obj; const f = fwd(o); for (const g of r.guns.slice(0, 2)) { const p = g.clone().applyQuaternion(o.quaternion).add(o.position); fireBolt(cineOwner, p, f, gun); } }
function lounge() {
  baseStage({ planet: (MISSIONS[camp?.current] || MISSIONS.m1).navs[0].env.planet || "calder", hue: 0.6 });
  const m = new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.75, metalness: 0.45, map: M.tex().concord0.map, bumpMap: M.tex().concord0.bump, bumpScale: 1, envMapIntensity: 0.4 });
  const add = (w, h, d, p, mat = m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(...p); C.world.add(b); return b; };
  add(60, 1, 40, [0, -10, -10]); add(60, 1, 40, [0, 12, -10]); add(1, 24, 40, [-24, 1, -10]); add(1, 24, 40, [24, 1, -10]);
  // window wall with frame
  add(60, 6, 1, [0, -7, -28]); add(60, 5, 1, [0, 9.5, -28]); add(8, 24, 1, [-20, 1, -28]); add(8, 24, 1, [20, 1, -28]);
  for (const x of [-8, 0, 8]) add(0.8, 14, 1.2, [x, 1, -28]);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffb460 }); add(46, 0.3, 0.3, [0, 11.4, -27.3], glow); add(46, 0.2, 0.2, [0, -4, -27.3], new THREE.MeshBasicMaterial({ color: 0x5aa0e0 }));
  add(30, 2.4, 5, [6, -6, -16], new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.4, metalness: 0.2 }));
  const L = C.plights[0]; L.l.position.set(4, 8, -12); L.l.color.set(0xffb070); L.l.intensity = 5; L.l.distance = 60; L.life = 999; L.k = 5;
  const far = put("halcyon", [-120, -150, -900], [0.04, 2.0, 0.03]); C.fill.groundColor.set(0x34507a);
  C.planet && C.planet.position.set(-18000, -26000, -70000);
  return { update(t) { cam([Math.sin(t * 0.1) * 1.5 + 4, 2, 6], [0, 1, -28]); far.obj.position.x = -120 + Math.sin(t * 0.02) * 120; glowEngines(far, 0.4); } };
}
function interior(red) {
  baseStage({ hue: red ? 0.0 : 0.6 }); C.indoor = true;
  const R = ROOMS.buildHangar(C.world, !!red);
  return ["lancer", "kestrel", "lancer", "warden"].map((t, i) => { const p = R.pads[i + 1]; return put(t, [p[0], 2.2, p[2]], [0, Math.PI + (p[0] < -1 ? -0.12 : p[0] > 1 ? 0.12 : 0), 0]); });
}
const STAGES = {
  title() {
    // the first look at this universe: the Halcyon close and huge, the camera gliding slowly down her
    // starboard flank below deck level, Calder filling the lower frame, escorts crossing for scale
    baseStage({ nebula: 0, hue: 0.58, fov: 42 }); C.bloom.strength = 0.42; C.fill.intensity = 1.1; C.fill.color.set(0x9ab0d0); C.fill.groundColor.set(0x3e6890);   // earthshine from Calder lights her belly
    C.sun.position.set(-0.35, 0.55, 0.85).normalize();
    const h = put("halcyon", [0, 0, 0], [0.05, -2.3, 0.04]); h.obj.updateMatrixWorld();
    C.sun.position.set(...(window.__titleSun || [-0.75, 0.6, -0.25])).applyQuaternion(h.obj.quaternion).normalize();   // key light from the camera side, raking along her flank
    const pl = M.makePlanet("calder", 7); pl.scale.setScalar(30000); pl.rotation.set(Math.PI / 2 - 0.35, 0.6, 0.2); C.world.add(pl); C.planet = pl;
    // two V-formation flights circle her close in (a tight ellipse in her own frame) so they cross the frame along her flank and over the deck
    const flights = [0, 1, 2].map(f => ({ ph: f * 2.094 + 0.3, ships: [0, 1, 2].map(i => put(i ? "kestrel" : "lancer", [0, 0, 0])), y: [60, 110, 20][f] }));
    // two fighters work the deck in a staggered 150 s cycle: A traps at 19 s, B at 49 s, A launches at 79 s, B at 109 s, then a minute of quiet
    const DY = 40, CYC = 150;
    const deckPath = (px, pz) => [[-16, 70, 230, 1500], [-7, 18, 90, 640], [0, -10, DY + 1, 262], [4, -10, DY, 170], [12, px, DY, pz], [48, px, DY, pz],
      [54, -22, DY, pz - 70], [57, -22, DY, -112], [60, -22, DY, -118], [64, -22, DY + 1, -360], [67, -22, DY + 12, -560], [74, -10, 150, -1150], [82, 60, 320, -1900]];
    const landers = [{ off: 19, path: deckPath(-46, 96) }, { off: 49, path: deckPath(-46, 146) }].map(l => ({ ...l, r: put("lancer", [0, 0, 0]), hd: null }));
    const lpos = (path, tau) => { if (tau <= path[0][0] || tau >= path[path.length - 1][0]) return null;
      let i = 0; while (path[i + 1][0] < tau) i++; const [t0, x0, y0, z0] = path[i], [t1, x1, y1, z1] = path[i + 1];
      let k = (tau - t0) / (t1 - t0); k = i === 0 || i >= 9 ? k : k * k * (3 - 2 * k);   // cruise legs linear, deck legs eased
      return new V3(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, z0 + (z1 - z0) * k); };
    const T0 = window.__titleT0 || 0;
    const L = (x, y, z) => h.obj.localToWorld(new V3(x, y, z));
    const CAMS = window.__titleCams || { c0: [-600, 140, -760], c1: [-560, 118, -650], l0: [30, -40, -40], l1: [50, -36, -10] };   // high off her port bow: full length, deck, island and lettering
    const path = (t) => { const u = 0.5 - 0.5 * Math.cos(t * 0.02);        // slow ping-pong glide, never a hard loop
      const T = window.__titleCam; if (T) return [L(...T.c), L(...T.l)];
      const m = (a, b) => a.map((v, i) => v + (b[i] - v) * u);
      return [L(...m(CAMS.c0, CAMS.c1)), L(...m(CAMS.l0, CAMS.l1))]; };
    const ell = (a, y) => new V3(-400 + Math.cos(a) * 230, y + Math.sin(a * 2) * 18, -400 + Math.sin(a) * 540);   // ship-local loop through the space between the camera and her port bow, so every pass sweeps across the foreground
    return { update(t, dt) {
      t += T0;
      glowEngines(h, 0.55);
      const [cp, lk] = path(t);
      const pull = Math.min(1.5, 1 + 0.42 * Math.max(0, 1.78 / C.camera.aspect - 1)); cp.sub(lk).multiplyScalar(pull).add(lk);
      const fwd = lk.clone().sub(cp).normalize(), right = new V3().crossVectors(fwd, new V3(0, 1, 0)).normalize(), up = new V3().crossVectors(right, fwd);
      pl.position.copy(cp).addScaledVector(fwd, 62000).addScaledVector(up, -30000).addScaledVector(right, -30000);
      for (const fl of flights) { const a = fl.ph + t * 0.11;
        fl.ships.forEach((s, i) => { const off = [[0, 0, 0], [-22, -4, 26], [22, -4, 26]][i];
          const c = ell(a, fl.y), n = ell(a + 0.01, fl.y), dir = n.clone().sub(c).normalize(), side = new V3().crossVectors(dir, new V3(0, 1, 0)).normalize();
          const p = c.clone().addScaledVector(side, off[0]).addScaledVector(dir, -off[2]).add(new V3(0, off[1], 0));
          s.obj.position.copy(L(p.x, p.y, p.z)); aim(s.obj, L(p.x + dir.x * 50, p.y + dir.y * 50, p.z + dir.z * 50)); s.obj.rotateZ(-0.45); glowEngines(s, 1.8); }); }
      for (const l of landers) {
        let tau = ((t - l.off) % CYC + CYC) % CYC; if (tau > CYC - 20) tau -= CYC;
        const p = lpos(l.path, tau); l.r.obj.visible = !!p; if (!p) continue;
        const q = lpos(l.path, tau + 0.25); if (q && q.distanceToSquared(p) > 0.04) l.hd = q.clone().sub(p).normalize();
        if (!l.hd) l.hd = new V3(0, 0, -1);
        l.r.obj.position.copy(L(p.x, p.y, p.z)); aim(l.r.obj, L(p.x + l.hd.x * 50, p.y + l.hd.y * 50, p.z + l.hd.z * 50));
        const onDeck = tau > 0.3 && tau < 63.5, launching = tau > 60 && tau < 70;
        glowEngines(l.r, onDeck && !launching ? (tau > 12 && tau < 48 ? 0.15 : 0.5) : 1.6);
      }
      C.camera.position.copy(cp); C.camera.up.set(0, 1, 0); C.camera.lookAt(lk);
    } };
  },
  space_war() {
    baseStage({ planet: "calder", nebula: 1 });
    const types = [["kestrel", 0], ["lancer", 0], ["lancer", 0], ["dhakar", 1], ["dhakar", 1], ["skrel", 1], ["skrel", 1]];
    const fs = types.map(([t, v], i) => ({ r: put(t, [0, 0, 0]), rad: 120 + i * 25, w: (0.32 + Math.random() * 0.15) * (i % 2 ? 1 : -1), ph: i * 0.9, tilt: rand(-0.5, 0.5), v, cd: rand(0, 1) }));
    return { update(t, dt) {
      for (const f of fs) {
        const a = f.ph + t * f.w, p = new V3(Math.cos(a) * f.rad, Math.sin(a * 1.7) * 40 + Math.sin(f.tilt) * Math.sin(a) * f.rad, Math.sin(a) * f.rad);
        const a2 = a + 0.05 * Math.sign(f.w), p2 = new V3(Math.cos(a2) * f.rad, Math.sin(a2 * 1.7) * 40 + Math.sin(f.tilt) * Math.sin(a2) * f.rad, Math.sin(a2) * f.rad);
        f.r.obj.position.copy(p); aim(f.r.obj, p2); f.r.obj.rotateZ(-0.6 * Math.sign(f.w)); glowEngines(f.r, 1.3);
        f.cd -= dt; if (f.cd <= 0) { f.cd = rand(0.12, 0.5); shoot(f.r, f.v ? "rend" : "laser"); }
      }
      if (Math.random() < dt * 0.5) { const f = pick(fs.filter(x => x.v)); explode(f.r.obj.position.clone(), 10); f.ph += 2; }
      cam([Math.sin(t * 0.12) * 330, 60 + Math.sin(t * 0.2) * 40, Math.cos(t * 0.12) * 330], [0, 0, 0]);
    } };
  },
  pyre_reveal() {
    baseStage({ planet: "corinthBurn", nebula: 1 }); C.planet.position.set(0, -20000, -42000);
    const p = put("pyre", [-1800, -120, -900], [0, -Math.PI / 2, 0]);
    return { update(t, dt) { p.obj.position.x += dt * 110; glowEngines(p); cam([-200 + t * 30, -420, 500], new V3(p.obj.position.x - 200, -60, -900)); } };
  },
  carrier_flyby() {
    baseStage({ planet: "calder", fov: 50 }); heroLight(0.6, 0.6, -0.5); C.planet.position.set(26000, -20000, -60000);
    const h = put("halcyon", [0, 0, 450], [0, 0, 0]); const ks = [];
    return { update(t, dt) { h.obj.position.z = 450 - t * 45; glowEngines(h); if (t > 2 && ks.length < 3 && Math.random() < dt * 2) { const b = h.obj.position.clone().add(new V3(rand(-20, 20), 8, -530)); ks.push(put(pick(["kestrel", "lancer"]), [b.x, b.y, b.z])); } ks.forEach(k => { k.obj.position.z -= dt * 260; glowEngines(k, 1.6); }); cam([165, -40, -430], new V3(h.obj.position.x + 10, 20, h.obj.position.z - 430)); } };
  },
  shuttle_arrival() {
    baseStage({ planet: "calder", fov: 50 }); heroLight(0.6, 0.5, 0.6); C.planet.position.set(-20000, -24000, -50000);
    const h = put("halcyon", [0, 0, 0], [0, Math.PI, 0]); const s = put("shuttle", [260, 70, 1150], [0, Math.PI, 0]);
    const bay = new V3(0, 8, 520);
    return { update(t, dt) { const k = Math.min(1, t / 8), e = k * k * (3 - 2 * k), p = new V3(260, 70, 1150).lerp(bay, e); s.obj.position.copy(p); aim(s.obj, bay); glowEngines(s); glowEngines(h, 0.3); cam([125 - e * 25, 26 - e * 14, 700 - e * 50], new V3(0, 16, 380).lerp(s.obj.position, 0.22)); } };
  },
  landing() {
    baseStage({ planet: (MISSIONS[camp?.current] || MISSIONS.m1).navs[0].env.planet || "calder" });
    heroLight(-0.6, 0.5, 0.6); const h = put("halcyon", [0, 0, 0], [0, Math.PI, 0]); const s = put(camp && MISSIONS[camp.lastMission]?.ship || "lancer", [-60, 60, 1300], [0, Math.PI, 0]);
    const bay = new V3(0, 8, 520);
    return { update(t, dt) { const k = Math.min(1, t / 6), e = k * k * (3 - 2 * k); s.obj.position.copy(new V3(-220, 60, 1150).lerp(bay, e)); aim(s.obj, bay); glowEngines(s); glowEngines(h, 0.3); cam([-120 + e * 25, 22 - e * 12, 690 - e * 50], new V3(0, 16, 380).lerp(s.obj.position, 0.22)); } };
  },
  corinth_burn() {
    baseStage({ planet: "corinthBurn" }); C.planet.scale.setScalar(30000); C.planet.position.set(0, -22000, -46000);
    const p = put("pyre", [-3000, 600, -6000], [0, -Math.PI / 2, 0]);
    return { update(t, dt) { p.obj.position.x += dt * 140; glowEngines(p); if (Math.random() < dt * 3) { const q = new V3(rand(-12000, 12000), rand(-6000, -1000), -30000); explode(q, 900, 0xff6020); } cam([0, 400 - t * 10, 2000 - t * 120], [0, -3000, -20000]); } };
  },
  spark_ram() {
    baseStage({ planet: "tessaly", nebula: 1 });
    const g = put("gharzen", [0, 0, -1600], [0, Math.PI / 2, 0]); const s = put("lancer", [400, 160, 700]);
    let hit = false; const tgt = new V3(0, 30, -1600);
    return { update(t, dt) {
      glowEngines(g);
      if (!hit) { s.obj.position.lerp(tgt, Math.min(1, dt * 0.55)); aim(s.obj, tgt); glowEngines(s, 1.8); if (Math.random() < 0.5) explode(s.obj.position.clone(), 2, 0x606060); if (s.obj.position.distanceTo(tgt) < 120) { hit = true; C.world.remove(s.obj); explode(tgt.clone(), 120, 0xffffff); } cam([s.obj.position.x + 50, s.obj.position.y + 22, s.obj.position.z + 120], tgt); }
      else { if (Math.random() < dt * 10) explode(new V3(rand(-450, 450), rand(-80, 80), -1600 + rand(-80, 80)), rand(30, 90)); if (t > 6.2 && !this.boom) { this.boom = 1; explode(new V3(0, 0, -1600), 600, 0xffffff); C.world.remove(g.obj); } cam([700, 160, 600], new V3(0, 0, -1600)); }
    } };
  },
  funeral() {
    baseStage({ planet: "tessaly", fov: 50 }); heroLight(-0.7, 0.5, -0.5);
    const h = put("halcyon", [0, 0, 0], [0, 0.25, 0]);
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128; const x = cv.getContext("2d"); x.fillStyle = "#1c2c5c"; x.fillRect(0, 0, 256, 128); x.fillStyle = "#e8e8f0"; x.beginPath(); x.arc(128, 64, 34, 0, 7); x.fill(); x.fillStyle = "#1c2c5c"; x.beginPath(); x.arc(128, 64, 26, 0, 7); x.fill(); x.fillStyle = "#e8e8f0"; x.font = "bold 40px sans-serif"; x.textAlign = "center"; x.fillText("★", 128, 78); x.fillStyle = "#b02020"; x.fillRect(0, 0, 256, 10); x.fillRect(0, 118, 256, 10);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const coffin = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 7), [0, 1, 2, 3, 4, 5].map(i => new THREE.MeshStandardMaterial(i === 2 ? { map: tex, roughness: 0.8 } : { color: 0x2a2a30, metalness: 0.7, roughness: 0.4 })));
    const bay = new V3(0, 8, -520).applyQuaternion(h.obj.quaternion); coffin.position.copy(bay); C.world.add(coffin);
    const f = [0, 1, 2, 3].map(i => put("lancer", [(i - 1.5) * 30, 200, 1400]));
    sfx.bell();
    return { update(t, dt) {
      coffin.position.addScaledVector(fwd(h.obj), dt * 6); coffin.rotation.x += dt * 0.05; coffin.rotation.z += dt * 0.03;
      f.forEach((s, i) => { s.obj.position.z -= dt * 260; if (i === 2 && t > 6) { s.obj.position.y += dt * (t - 6) * 90; s.obj.rotation.x = Math.min(1.2, (t - 6) * 0.5); } glowEngines(s); });
      if (t > 6 && !this.b2) { this.b2 = 1; sfx.bell(); }
      { const F = fwd(h.obj), Lf = new V3(F.z, 0, -F.x); cam([bay.x + F.x * 115 + Lf.x * 145, bay.y - 20, bay.z + F.z * 115 + Lf.z * 145 - t * 2], new V3().copy(coffin.position).lerp(h.obj.position, 0.35)); }
    } };
  },
  lodestar_reveal() {
    baseStage({ planet: "varenne" });
    const l = put("lodestar", [0, 0, 400], [0, 0, 0]); const es = [put("lancer", [140, 60, -400]), put("lancer", [-140, 40, -300]), put("warden", [0, 120, -500])];
    return { update(t, dt) { l.obj.position.z -= dt * 30; glowEngines(l); es.forEach(e => { e.obj.position.z -= dt * 32; glowEngines(e); }); cam([180, -60, -700 + t * 20], new V3(0, 0, l.obj.position.z - 200)); } };
  },
  lodestar_dies() {
    baseStage({ planet: "ashkar" });
    const l = put("lodestar", [0, 0, -900], [0, Math.PI / 2, 0]); const p = put("pyre", [-400, 200, -4200], [0, Math.PI / 2 + 0.4, 0]); p.obj.visible = false;
    let beam = null;
    return { update(t, dt) {
      if (t > 1.2 && !p.obj.visible) { p.obj.visible = true; explode(p.obj.position.clone(), 900, 0x80a0ff); }
      if (t > 3 && !beam) { const a = new V3(-400 - 900, 110, -4200 + 380), b = new V3(0, 0, -900); const len = a.distanceTo(b); beam = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, len, 10), new THREE.MeshBasicMaterial({ color: 0xffa040 })); beam.position.copy(a).lerp(b, 0.5); beam.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize()); C.world.add(beam); }
      if (beam) { beam.scale.x = beam.scale.z = 0.8 + Math.random() * 0.5; if (Math.random() < dt * 12) explode(new V3(rand(-500, 500), rand(-40, 40), -900 + rand(-40, 40)), rand(30, 80)); }
      if (t > 7.6 && !this.end) { this.end = 1; explode(new V3(0, 0, -900), 700, 0xffffff); C.world.remove(l.obj); C.world.remove(beam); }
      cam([900, 120, 800], new V3(-200, 0, -1600));
    } };
  },
  alarm() {
    const ships = interior(true); const L = C.plights[0]; L.l.position.set(0, 16, -15); L.l.distance = 120; L.life = 999; L.k = 1;
    C.fill.color.set(0xff3020);
    return { update(t) { L.l.intensity = 40 + Math.sin(t * 8) * 38; L.l.color.set(0xff2010); if (Math.floor(t * 2) % 2 && !this["b" + Math.floor(t * 2)]) { this["b" + Math.floor(t * 2)] = 1; sfx.cue("u_klaxon", 0.5, { rate: 0.92 }, 520, 0.25, 0.08, "sawtooth"); } cam([-12 + t * 2, 5, 22 - t * 3], [6, 3, -30]); }, done() { C.fill.color.set(0x8aa8d8); } };
  },
  ember_wreck() {
    baseStage({ planet: "varenne", nebula: 1 });
    const w = put("vhaal", [0, 0, -120], [0.4, 0.8, 1.2], "embership");
    return { update(t, dt) { w.obj.rotation.x += dt * 0.15; w.obj.rotation.z += dt * 0.1; if (Math.random() < dt * 6) explode(w.obj.position.clone().add(new V3(rand(-6, 6), rand(-3, 3), rand(-6, 6))), 2, 0xff8030); cam([Math.sin(t * 0.15) * 60, 15, -120 + Math.cos(t * 0.15) * 60], w.obj.position); } };
  },
  bell() {
    baseStage({ hue: 0.6 }); C.scene.background = new THREE.Color(0x020203);
    const bmat = new THREE.MeshStandardMaterial({ color: 0xb08040, metalness: 1, roughness: 0.28 });
    const bell = new THREE.Mesh(M.lathe ? M.lathe : new THREE.LatheGeometry([[0, 4], [0.6, 3.9], [0.8, 3.2], [1.0, 1.8], [1.4, 0.4], [1.9, -0.1], [1.9, -0.3], [0, -0.3]].map(([a, b]) => new THREE.Vector2(a, b)), 48), bmat);
    bell.position.set(0, 0, -8); C.world.add(bell);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x6a5a40, metalness: 0.8, roughness: 0.4 })); plate.position.set(0, -2.2, -7); C.world.add(plate);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.9, map: M.tex().concord1.map })); wall.position.set(0, 0, -11); C.world.add(wall);
    const L = C.plights[0]; L.l.position.set(2, 5, -4); L.l.color.set(0xffc080); L.l.intensity = 60; L.l.distance = 40; L.life = 999; L.k = 60;
    sfx.bell();
    return { update(t) { bell.rotation.z = Math.sin(t * 2.2) * 0.12 * Math.exp(-t * 0.3); cam([0, 0.4, 2 - t * 0.25], [0, 0.2, -8]); }, done() { C.scene.background = C.skyTex; } };
  },
  pyre_dies() {
    baseStage({ planet: "kethra", nebula: 1 });
    const p = put("pyre", [0, 0, -3200], [0, Math.PI / 2, 0.05]);
    return { update(t, dt) { p.obj.rotation.z += dt * 0.02; p.obj.position.y -= dt * 8; if (Math.random() < dt * 14) explode(p.obj.position.clone().add(new V3(rand(-900, 900), rand(-100, 120), rand(-100, 100))), rand(40, 140)); if (t > 7.5 && !this.e) { this.e = 1; explode(p.obj.position.clone(), 1600, 0xffffff); C.world.remove(p.obj); } cam([1600, 300, -200], new V3(0, 0, -3200)); } };
  },
  planet_breaks() {
    const moon = !!camp.flags.targetAshkar;
    baseStage({ planet: "kethra" });
    C.planet.scale.setScalar(26000); C.planet.position.set(moon ? 30000 : 0, moon ? -12000 : -8000, moon ? -90000 : -60000);
    let tgt = C.planet;
    if (moon) { tgt = M.makePlanet("ashkar", 9); tgt.scale.setScalar(9000); tgt.position.set(-3000, -1500, -42000); C.world.add(tgt); }
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 512; const x = cv.getContext("2d"); x.strokeStyle = "#ffb050"; x.lineCap = "round";
    for (let i = 0; i < 40; i++) { let px = Math.random() * 1024, py = 100 + Math.random() * 312; x.lineWidth = 1 + Math.random() * 4; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 12; k++) { px += rand(-40, 40); py += rand(-25, 25); x.lineTo(px, py); } x.stroke(); }
    const ct = new THREE.CanvasTexture(cv); ct.colorSpace = THREE.SRGBColorSpace;
    const crack = new THREE.Mesh(new THREE.SphereGeometry(1.005, 64, 48), new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    tgt.add(crack);
    const w = put("wraith", [20, -10, -60], [0, Math.PI, 0]);
    const rocks = []; const rg = M.makeAsteroidGeo(4), rm = M.asteroidMaterial();
    return { update(t, dt) {
      crack.material.opacity = Math.min(1, Math.max(0, (t - 1) / 4)); crack.rotation.y += dt * 0.01;
      w.obj.position.z += dt * 120; w.obj.position.y += dt * 6; glowEngines(w, 2);
      if (t > 5.5 && !this.f) { this.f = 1; for (let i = 0; i < 60; i++) { const r = new THREE.Mesh(rg, rm); const d = new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); r.position.copy(tgt.position).addScaledVector(d, tgt.scale.x * 0.8); r.scale.setScalar(rand(200, 1400) * (moon ? 0.5 : 1)); r.userData.v = d.multiplyScalar(rand(600, 2200)); C.world.add(r); rocks.push(r); } explode(tgt.position.clone().multiplyScalar(0.6), 6000, 0xffd090); }
      for (const r of rocks) { r.position.addScaledVector(r.userData.v, dt); r.rotation.x += dt * 0.3; }
      if (t > 5.5) tgt.scale.multiplyScalar(1 + dt * 0.01);
      if (t > 7 && moon === false) tgt.visible = Math.random() > (t - 7) / 4;
      cam([0, 6, 40], tgt.position.clone().add(new V3(moon ? 2500 : 0, 0, 0)));
    } };
  },
  halcyon_dies() {
    baseStage({ planet: "calder", fov: 50 }); heroLight(0.7, 0.4, 0.5);
    const h = put("halcyon", [0, 0, -1800], [0, Math.PI / 2, 0]);
    return { update(t, dt) { h.obj.rotation.z += dt * 0.03; h.obj.position.y -= dt * 6; if (Math.random() < dt * 10) explode(h.obj.position.clone().add(new V3(rand(-380, 380), rand(-40, 60), rand(-60, 60))), rand(30, 90)); if (t > 8.5 && !this.e) { this.e = 1; explode(h.obj.position.clone(), 700, 0xffffff); C.world.remove(h.obj); } cam([420 + t * 8, 60, -1060 + t * 4], new V3(-60, h.obj.position.y + 20, -1800)); } };
  },
  hub() {
    const ms = MISSIONS[camp?.current] || MISSIONS.m1;
    baseStage({ planet: ms.navs[0].env.planet || "calder", fov: 46 }); heroLight(0.7, 0.5, 0.4);
    const h = put("halcyon", [0, 0, 0], [0, 0.3, 0]); const pat = [put("lancer", [300, 80, -600]), put("kestrel", [340, 90, -560])];
    return { update(t, dt) { glowEngines(h, 0.4); pat.forEach((p, i) => { const a = t * 0.08 + i * 0.12; p.obj.position.set(Math.cos(a) * 900, 120 + i * 20, Math.sin(a) * 900); aim(p.obj, new V3(Math.cos(a + 0.05) * 900, 120 + i * 20, Math.sin(a + 0.05) * 900)); glowEngines(p); }); const a = 1.2 + Math.sin(t * 0.025) * 0.55; cam([Math.sin(a) * 640, 70 + Math.sin(t * 0.04) * 20, Math.cos(a) * 640], new V3(-180, 30, 0)); } };
  },
  showroom(type) {
    baseStage({ hue: SHIPS[type].faction === "vharr" ? 0.03 : 0.58, nebula: 1 });
    const r = put(type, [0, 0, 0], [0, 0.6, 0], type === "bloodcrown" ? "bloodcrown" : undefined);
    const size = r.radius; C.sun.position.set(-1, 0.8, 0.6);
    return { update(t, dt) { r.obj.rotation.y += dt * 0.25; glowEngines(r, 0.8); cam([size * 2.2, size * 0.7, size * 2.2], new V3(-size * 0.55, 0, 0)); } };
  },
};

// ======================================================================= ROOMS (3D ship interiors)
function camRig(p, l) {
  const fl = new THREE.PointLight(0xffe0c8, 2.2, 4, 2); C.world.add(fl);
  return { fl, pos: p.clone(), look: l.clone(), tp: p.clone(), tl: l.clone(), k: 2.5,
    cut(p2, l2) { this.pos.copy(p2); this.look.copy(l2); this.tp.copy(p2); this.tl.copy(l2); },
    go(p2, l2, k = 2.5) { this.tp.copy(p2); this.tl.copy(l2); this.k = k; },
    update(dt) { const a = 1 - Math.exp(-dt * this.k); this.pos.lerp(this.tp, a); this.look.lerp(this.tl, a); C.camera.position.copy(this.pos); C.camera.up.set(0, 1, 0); C.camera.lookAt(this.look); this.fl.position.copy(this.pos).add(new V3(-0.4, 0.35, 0).applyQuaternion(C.camera.quaternion)); } };
}
function yawTo(f, p) { const d = p.clone().sub(f.position); let a = Math.atan2(d.x, d.z) - f.rotation.y; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return Math.max(-0.75, Math.min(0.75, a)); }
function closeUp(f, side = 1, dist = 1.0, towards) {
  f.updateMatrixWorld(true); const h = headPos(f); let fwdv = new V3(Math.sin(f.rotation.y), 0, Math.cos(f.rotation.y));
  if (towards) { const d = towards.clone().sub(h); d.y = 0; d.normalize(); fwdv = d; }
  const dir = fwdv.applyAxisAngle(new V3(0, 1, 0), side * (towards ? 0.22 : 0.42));
  return { pos: h.clone().addScaledVector(dir, dist).add(new V3(0, 0.03, 0)), look: h.clone().add(new V3(0, -0.07, 0)) };
}
function place(id, p, ry, pose) { const f = figureCached(id, { pose }); if (!f) return null; f.position.set(...p); f.rotation.y = ry; C.world.add(f); return f; }
function hubEnv() { const ms = MISSIONS[camp?.current] || MISSIONS.m1; return { planet: ms.navs[0].env.planet || "calder", nebula: 1, fov: 46 }; }
function windowView() { if (C.planet) { C.planet.position.set(-26000, -24000, -78000); C.planet.scale.setScalar(30000); } C.sun.intensity = 0.9; C.fill.intensity = 0.15; C.bloom.strength = 0.55; }
function paintKillboard(cvs) {
  const x = cvs.getContext("2d"), W = cvs.width, H = cvs.height;
  x.fillStyle = "#030a06"; x.fillRect(0, 0, W, H); x.strokeStyle = "#5aff90"; x.lineWidth = 4; x.strokeRect(10, 10, W - 20, H - 20);
  x.fillStyle = "#ffb040"; x.font = "bold 44px 'Chakra Petch', sans-serif"; x.textAlign = "center"; x.fillText("VIGIL SQUADRON · KILLBOARD", W / 2, 68);
  const base = { vesper: 58, deacon: 71, spark: 31, ricochet: 44, frost: 39, ember: 12, halo: 0 };
  const rows = Object.keys(base).map(id => ({ nm: CAST[id].callsign, k: base[id] + ((camp && camp.wingKills[id]) || 0), fate: camp ? crewFate(id) : "" }));
  if (camp) rows.push({ nm: camp.callsign, k: camp.kills, you: 1 });
  rows.sort((a, b) => b.k - a.k);
  x.font = "bold 34px 'Share Tech Mono', monospace";
  rows.forEach((r, i) => { const y = 130 + i * 52; x.fillStyle = r.you ? "#ffffff" : r.fate ? "#ff6050" : "#7dffa8"; x.textAlign = "left"; x.fillText(r.nm.toUpperCase(), 70, y); if (r.fate) { x.font = "24px 'Share Tech Mono', monospace"; x.fillText(r.fate, 420, y); x.font = "bold 34px 'Share Tech Mono', monospace"; } x.textAlign = "right"; x.fillText(String(r.k), W - 70, y); x.fillStyle = "rgba(125,255,168,.15)"; x.fillRect(70, y + 14, W - 140, 2); });
  if (camp) [...new Set(camp.medals)].forEach((m, i) => { const mx = 80 + i * 90, my = H - 90; x.fillStyle = "#1c3c78"; x.fillRect(mx, my, 60, 22); x.fillStyle = MEDALS[m].color; x.fillRect(mx + 22, my, 16, 22); x.beginPath(); x.arc(mx + 30, my + 48, 18, 0, 7); x.fill(); });
}
// hotspot overlay ---------------------------------------------------------
let HS = [];
function setHotspots(list) {
  const box = $("hotspots"); box.innerHTML = ""; HS = [];
  for (const h of list) { const b = document.createElement("button"); b.className = "btn hs" + (h.door ? " door" : ""); b.innerHTML = `${escapeHtml(h.label)}<br><small>${escapeHtml(h.sub || "")}</small>`; b.onclick = () => { sfx.cue("u_click", 0.45, {}, 1100, 0.04, 0.05); h.act(); }; box.appendChild(b); HS.push({ ...h, el: b }); }
}
function updateHotspots(hidden) {
  const W = innerWidth, H = innerHeight;
  for (const h of HS) { const p = (typeof h.pos === "function" ? h.pos() : h.pos).clone().project(C.camera); const vis = !hidden && p.z < 1 && Math.abs(p.x) < 0.97 && Math.abs(p.y) < 0.95; h.el.classList.toggle("hidden", !vis); if (vis) h.el.style.left = ((p.x * 0.5 + 0.5) * W) + "px", h.el.style.top = ((-p.y * 0.5 + 0.5) * H) + "px"; }
}
// in-room conversation -------------------------------------------------------
function roomTalk(st, f, id, text) {
  const sp = CAST[id]; st.talkFig = f; st.talkId = id; st.talkAt = performance.now();   // the press that opened the talk must not also close it
  if (["stand", "armsCrossed", "point"].includes(f.userData.pose)) { const d = st.home.pos.clone().sub(f.position); f.userData.faceTo = Math.atan2(d.x, d.z); }
  const cu = closeUp(f, f.position.x > 0 ? -1 : 1, 0.95, st.home.pos); st.cam.go(cu.pos, cu.look, 3);
  $("tbName").textContent = sp.callsign ? `${sp.callsign} · ${sp.rank} ${sp.name}` : `${sp.rank} ${sp.name}`; $("tbLine").textContent = fmtLine(text); $("talkbar").hidden = false; updateHotspots(true);
  st.talking = id; voice.say(id, text, () => { if (st.talkId === id) st.talking = null; });
}
function endRoomTalk(st) { voice.stop(); st.talking = null; st.talkFig = null; st.talkId = null; $("talkbar").hidden = true; st.cam.go(st.home.pos, st.home.look, 2); }
$("talkbar").addEventListener("click", () => { if (stage && stage.talkFig) endRoomTalk(stage); });

Object.assign(STAGES, {
  loungeRoom() {
    baseStage(hubEnv()); windowView();
    const R = ROOMS.buildLounge(C.world);
    const alive = crewPresent(), visits = (LOUNGE_VISITS[camp.current] || []).filter(([id]) => alive.includes(id) || id === "rabbit");
    const present = castReady() ? visits.map(v => v[0]) : [];
    const talkQ = {}; const lr = camp.lastResult && camp.lastResult.id !== camp.current ? camp.lastResult : null;
    for (const [id, topic] of visits) {
      const q = [];
      const rk = id === "ricochet" && camp.done.includes("m6") ? "ricochet2" : id;
      if (lr && REACT[rk]) { const tier = lr.ok ? (lr.secN && lr.sec === lr.secN ? "perfect" : "ok") : "fail"; const pool = REACT[rk][tier]; let line = pool[(lr.id.length + id.length) % pool.length]; if (lr.promoted) line = `${RANKS[lr.rank]} now, I hear. ` + line; q.push(line); }
      q.push(...topic); talkQ[id] = { q, i: 0 };
    }
    const slot = { ricochet: 0, rabbit: 1, deacon: 2, spark: 3, halo: 4, ember: 5, varga: 6, voss: 4, vesper: 8, frost: 9 };
    const figs = [];
    const used = new Set(), spotFor = id => { const pref = ["ricochet", "rabbit"].includes(id) ? [0, 1, 9] : [9, 8, 4, 1]; const k = pref.find(i => !used.has(i)) ?? slot[id] ?? 8; used.add(k); return k; };
    for (const id of present) { const sp = R.spots[spotFor(id)]; if (sp.pose === "sitTable") R.chairsFor(sp); const f = place(id, [sp.p[0], sp.pose === "sit" ? 0.33 : 0, sp.p[2]], sp.ry, sp.pose); if (f) { if (sp.pose === "stand") { const e = R.establish.pos; f.rotation.y = Math.atan2(e.x - sp.p[0], e.z - sp.p[2]); } figs.push({ id, f }); } }
    paintKillboard(R.killboard.canvas); R.killboard.tex.needsUpdate = true;
    { const x = R.wallScreen.canvas.getContext("2d"); x.fillStyle = "#020610"; x.fillRect(0, 0, 768, 432); x.fillStyle = "#78d0ff"; x.font = "bold 40px 'Chakra Petch', sans-serif"; x.textAlign = "center"; x.fillText("CONCORD NAVY NEWSNET", 384, 180); x.font = "26px 'Share Tech Mono', monospace"; x.fillText((MISSIONS[camp.current]?.system || "").toUpperCase(), 384, 240); R.wallScreen.tex.needsUpdate = true; }
    const home = R.establish; const cam = camRig(home.pos, home.look);
    const st = { cam, home, figs, R, t: 0 };
    const ms = MISSIONS[camp.current];
    const hs = figs.map(({ id, f }) => ({ label: CAST[id].callsign || CAST[id].name.split(" ").pop(), sub: "Talk", pos: () => headPos(f).add(new V3(0, 0.32, 0)), act: () => { const T_ = talkQ[id]; if (T_) { roomTalk(st, f, id, T_.q[Math.min(T_.i, T_.q.length - 1)]); T_.i++; st.hsSub(id, T_.i < T_.q.length ? "Talk" : "Talk again"); return; } const lines = LOUNGE[id] || [[0, "..."]]; const sti = id === "voss" ? (camp.done.includes("m10") ? 1 : 0) : stageIdx(); roomTalk(st, f, id, lines.filter(l => l[0] <= sti).pop()[1]); } }));
    st.hsSub = () => {};
    hs.push({ label: "Killboard", sub: "View", pos: new V3(-6.8, 2.85, -1.2), act: () => { st.cam.go(new V3(-4.6, 1.85, -1.2), new V3(-6.9, 1.85, -1.2), 2.5); st.viewing = true; st.talkAt = performance.now(); $("talkbar").hidden = false; $("tbName").textContent = "Killboard"; $("tbLine").textContent = `${RANKS[camp.rank]} ${camp.callsign}: ${camp.kills} confirmed kills, ${camp.sorties} sorties.`; } });
    hs.push({ label: "Briefing", sub: ms ? ms.title : "", door: 1, pos: new V3(-5.5, 3.25, 4.8), act: () => { endRoomTalk(st); toBriefing(); } });
    hs.push({ label: "Flight Deck", sub: "Hangar", door: 1, pos: new V3(1.8, 3.25, 4.8), act: () => { endRoomTalk(st); setStage("hangarRoom"); $("hubLoc").textContent = "Flight Deck"; } });
    hs.push({ label: "Simulator", sub: `${unlockedShips(camp).length} ship${unlockedShips(camp).length > 1 ? "s" : ""} available`, pos: R.sim.top.clone(), act: () => { endRoomTalk(st); simMenu(true); } });
    setHotspots(hs); $("hubLoc").textContent = "Officers' Lounge"; $("hubWho").textContent = `${RANKS[camp.rank]} ${camp.callsign} · ${deckBlurb()}`;
    const fly = put("kestrel", [4000, -300, -9000], [0, -1.4, 0]);
    Object.assign(st, {
      update(t, dt) {
        const drift = Math.sin(t * 0.08) * 0.35;
        if (!st.talkFig && !st.viewing) st.cam.go(home.pos.clone().add(new V3(drift, 0, 0)), home.look.clone().add(new V3(drift * 0.4, 0, 0)), 1.2);
        st.cam.update(dt);
        for (const { f } of figs) if (f.userData.faceTo !== undefined) { let d = f.userData.faceTo - f.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; f.rotation.y += d * Math.min(1, dt * 3); }
        for (const { id, f } of figs) updateFigure(f, t, dt, st.talking === id ? Math.abs(Math.sin(t * 13)) * (0.6 + 0.4 * Math.sin(t * 3.1)) : 0, C.camera, st.talkFig === f ? yawTo(f, C.camera.position) : 0);
        if (R.sim) paintSimAttract(R.sim.screen, t);
        fly.obj.position.x -= dt * 900; if (fly.obj.position.x < -9000) fly.obj.position.x = 9000; glowEngines(fly, 2);
        updateHotspots(!!st.talkFig || st.viewing || $("hub").hidden);
        if ((st.talkFig || st.viewing) && performance.now() - (st.talkAt || 0) > 400 && (pad.pressed.has(0) || pad.pressed.has(1) || hubKey.adv)) { hubKey.adv = false; st.viewing = false; endRoomTalk(st); }
      }, done() { $("hotspots").innerHTML = ""; HS = []; voice.stop(); },
    });
    return st;
  },
  ship_reveal(shot) {
    // dark hangar; banks of floodlights slam on one by one over the new ship, the camera
    // creeps round from under the nose to a hero three-quarter, engines warm up, the chief talks
    const t0 = shot.ship;
    baseStage({ ...hubEnv(), fov: 38 }); C.sun.intensity = 0; C.fill.intensity = 0.03; C.bloom.strength = 1.1;
    const R = ROOMS.buildHangar(C.world, false); C.indoor = true;
    const hl = []; R.g.traverse(o => { if (o.isLight) { hl.push([o, o.intensity]); o.intensity = 0; } });
    const P = new V3(0, 2.2, -12); const s = put(t0, [P.x, P.y, P.z], [0, Math.PI + 0.55, 0]); const size = Math.max(5, s.radius); console.log('reveal radius', s.radius);
    const banks = [-1, 0, 1].map((i, k) => {
      const L = new THREE.SpotLight(0xfff1d8, 0, 70, 0.42, 0.55, 2); L.position.set(i * size * 0.8, 19, P.z + i * 2.5); L.target.position.set(P.x + i * size * 0.25, P.y, P.z); C.world.add(L, L.target);
      const h = 17, beam = new THREE.Mesh(new THREE.ConeGeometry(size * 0.42, h, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      beam.position.set(L.position.x * 0.8, L.position.y - h / 2 + 0.5, L.position.z); C.world.add(beam);
      const fix = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 0.5, 20), new THREE.MeshBasicMaterial({ color: 0x111111, toneMapped: false })); fix.position.copy(L.position); C.world.add(fix);
      return { L, beam, fix, at: 0.7 + k * 0.85, on: false };
    });
    const chief = place("rabbit", [P.x + 3.5, 0, P.z + size * 1.15], 0.35, "armsCrossed");
    const camR = camRig(new V3(P.x - size * 0.6, 1.0, P.z + size * 1.3), P.clone().add(new V3(0, 1.6, 0))); camR.fl.intensity = 0;
    const st = { cam: camR };
    Object.assign(st, { update(t, dt) {
      for (const b of banks) if (!b.on && t >= b.at) { b.on = true; sfx.cue("u_slam", 0.7, { rate: 0.75 }, 48, 0.4, 0.18, "sawtooth"); C.shake = 0; }
      for (const b of banks) if (b.on) { const k = Math.min(1, (t - b.at) * 6), fl = t - b.at < 0.35 ? (Math.random() < 0.5 ? 0.3 : 1) : 1; b.L.intensity = 1100 * k * fl; b.beam.material.opacity = 0.018 * k * fl; b.fix.material.color.setScalar(0.07 + 0.9 * k * fl); }
      const amb = Math.min(1, Math.max(0, (t - 3.2) / 2.5)); for (const [o, i0] of hl) o.intensity = i0 * 0.55 * amb; C.fill.intensity = 0.03 + 0.25 * amb;
      // slow crane move: low under the nose round to a raised three-quarter
      const u = Math.min(1, t / (shot.dur || 12)), e = u * u * (3 - 2 * u), a = -0.95 + e * 1.35, rad = size * (2.6 - e * 0.5), h = 1.0 + e * size * 0.75;
      st.cam.go(new V3(P.x + Math.sin(a) * rad, h, P.z + Math.cos(a) * rad), P.clone().add(new V3(0, 1.4 - e * 0.6, 0)), 1.8); st.cam.update(dt);
      glowEngines(s, Math.max(0.05, Math.min(1.2, (t - 5) * 0.5)));
      if (t > 3.0 && !st.named) { st.named = true; $("cCapTop").textContent = SHIPS[t0].name.toUpperCase(); }
      if (chief) updateFigure(chief, t, dt, st.talking === "rabbit" ? Math.abs(Math.sin(t * 13)) * (0.6 + 0.4 * Math.sin(t * 3.1)) : 0, C.camera, 0);
    } });
    return st;
  },
  hangarRoom() {
    baseStage({ ...hubEnv(), fov: 50 }); C.sun.intensity = 0.4; C.fill.intensity = 0.2;
    const R = ROOMS.buildHangar(C.world, false); C.indoor = true;
    const types = ["kestrel", "lancer", "warden", "wraith", "longbow"]; const ships = [];
    types.forEach((t, i) => { const p = R.pads[i]; const s = put(t, [p[0], 2.2, p[2]], [0, Math.PI + (p[0] < -1 ? -0.12 : p[0] > 1 ? 0.12 : 0), 0]); ships.push({ t, s }); });   // nose to the camera, a slight splay
    // a prototype the player isn't cleared for stays under R&D's tarp
    const secret = new Set(["wraith"].filter(t => !unlockedShips(camp).includes(t)));
    for (const sh of ships) if (secret.has(sh.t)) { sh.s.obj.updateMatrixWorld(true); const tp = ROOMS.makeTarp(sh.s.obj); C.world.add(tp); sh.s.obj.visible = false; sh.secret = true; sh.s.eng = []; }
    const deck = place("rabbit", [4.5, 0, -6], -0.6, "armsCrossed");
    const home = { pos: new V3(0, 17, 31), look: new V3(0, 0, -12) }; C.camera.fov = 58; C.camera.updateProjectionMatrix(); const cam = camRig(home.pos, home.look);
    const st = { cam, home };
    setHotspots([...ships.map(({ t, s, secret }) => secret ? { label: "R&D", sub: "Restricted", pos: () => s.obj.position.clone().add(new V3(0, 4.5, 0)), act: () => toast("RESTRICTED — R&D PROTOTYPE. Not cleared for this pilot.", 2600) } : ({ label: SHIPS[t].name, sub: SHIPS[t].cls, pos: () => s.obj.position.clone().add(new V3(0, 4.5, 0)), act: () => { const p = s.obj.position; st.cam.go(p.clone().add(new V3(9, 4, 11)), p.clone().add(new V3(-2, 0.5, 0)), 2); st.focus = true; hubPanel("ship", t); } })),
      { label: "Lounge", sub: "Back", door: 1, pos: new V3(-6, 3, 20), act: () => { $("hubPanel").hidden = true; toHub(); } }]);
    st.panelClosed = () => { st.focus = false; st.cam.go(home.pos, home.look, 2); };
    Object.assign(st, { update(t, dt) { if (!st.focus) st.cam.go(home.pos.clone().add(new V3(Math.sin(t * 0.07) * 4, 0, 0)), home.look, 1); st.cam.update(dt); if (deck) updateFigure(deck, t, dt, 0, C.camera, 0); for (const { s } of ships) glowEngines(s, 0.25); updateHotspots(!$("hubPanel").hidden); }, done() { $("hotspots").innerHTML = ""; HS = []; } });
    return st;
  },
  talkRoom(shot) {
    baseStage(hubEnv()); windowView();
    const R = ROOMS.buildLounge(C.world);
    const lines = shot.lines || []; const who = [...new Set(lines.map(l => l[0]).concat(shot.who || []))].filter(w => w !== "player" && !(shot.scene === "broadcast" && w === "kaerr"));
    const marks = [{ p: [0.9, 0, -1.2], ry: -0.4 }, { p: [-0.7, 0, -1.6], ry: 0.5 }, { p: [2.2, 0, -2.4], ry: -0.7 }];
    const figs = {}; who.forEach((id, i) => { const f = place(id, marks[i % 3].p, marks[i % 3].ry, id === "varga" && shot.medal ? "stand" : "stand"); if (f) figs[id] = f; });
    const bg = castReady() && camp ? crewPresent().filter(id => !figs[id]).slice(0, 3) : [];
    const spots = [R.spots[2], R.spots[0], R.spots[4]]; bg.forEach((id, i) => { const sp = spots[i]; if (sp.pose === "sitTable") R.chairsFor(sp); const f = place(id, sp.p, sp.ry, sp.pose); if (f) figs["bg_" + id] = f; });
    const cam = camRig(new V3(0.2, 1.6, 2.2), new V3(0.2, 1.4, -1.4)); const st = { cam, figs, R };
    let side = 1, lastF = null;
    const broadcast = shot.scene === "broadcast";
    st.setSpeaker = (id) => {
      const f = figs[id];
      if (broadcast && id === "kaerr") { st.cam.cut(new V3(-2.2, 1.85, 2.6), new V3(-2.2, 1.9, 4.9)); st.cam.go(new V3(-2.2, 1.88, 3.3), new V3(-2.2, 1.9, 4.9), 0.25); return; }
      if (f) { side = -side; const cu = closeUp(f, side, 1.05); st.cam.cut(cu.pos.clone().addScaledVector(cu.pos.clone().sub(cu.look).normalize(), 0.25), cu.look); st.cam.go(cu.pos, cu.look, 0.35); lastF = f; return; }
      const tf = lastF || Object.values(figs)[0]; if (tf) { const h = headPos(tf); st.cam.cut(new V3(h.x - 1.4, 1.62, h.z + 2.2), h.clone().add(new V3(0, -0.15, 0))); }
    };
    if (who[0] && figs[who[0]]) st.setSpeaker(who[0]); else if (broadcast) st.setSpeaker("kaerr");
    Object.assign(st, { update(t, dt) {
      st.cam.update(dt);
      for (const [k, f] of Object.entries(figs)) { const id = k.replace("bg_", ""); updateFigure(f, t, dt, st.talking === id ? Math.abs(Math.sin(t * 13)) * (0.6 + 0.4 * Math.sin(t * 3.1)) : 0, C.camera, k.startsWith("bg_") ? 0 : yawTo(f, C.camera.position)); }
      if (broadcast) { const cv = R.wallScreen.canvas, x = cv.getContext("2d"); drawPortrait(x, CAST.kaerr, 0, 0, cv.width, cv.height, st.talking === "kaerr" ? Math.abs(Math.sin(t * 12)) : 0, t, { bg0: "#3a0a06", bg1: "#100302" }); x.globalAlpha = 0.1; for (let i = 0; i < 12; i++) { x.fillStyle = Math.random() < 0.5 ? "#fff" : "#f60"; x.fillRect(0, Math.random() * cv.height, cv.width, 2); } x.globalAlpha = 1; R.wallScreen.tex.needsUpdate = true; }
    } });
    return st;
  },
  briefingRoom(shot) {
    const ms = shot.ms; baseStage({ hue: 0.02, fov: 44 }); C.sun.intensity = 0; C.fill.intensity = 0.1; C.bloom.strength = 0.6;
    const R = ROOMS.buildBriefing(C.world); C.indoor = true;
    const speakers = [...new Set(ms.brief.map(l => l[0]))];
    const figs = {};
    speakers.forEach((id, i) => { const m = i === 0 ? R.podium : R.front[(i - 1) % 2]; const f = place(id, m.p, m.ry, i === 0 ? "stand" : "armsCrossed"); if (f) figs[id] = f; });
    const seated = [...new Set([...(ms.wing || []), ...(castReady() ? crewPresent() : [])])].filter(id => !figs[id]).slice(0, 7);
    const seatOrder = [1, 2, 4, 6, 5, 9, 10, 8, 3];
    seated.forEach((id, i) => { const s = R.seats[seatOrder[i]]; const f = place(id, s.p, Math.PI, "sitBack"); if (f) figs["seat_" + id] = f; });
    const cam = camRig(R.wide.pos, R.wide.look); const st = { cam, figs, R }; let hl = 0, lastSp = null, n = 0;
    st.setSpeaker = (id, line) => {
      if (line >= 0) hl = line % ms.navs.length;
      const f = figs[id]; n++;
      if (id === "player" || !f) { st.cam.cut(R.wide.pos, R.wide.look); st.cam.go(R.wide.pos.clone().add(new V3(0, -0.1, -1.2)), R.wide.look, 0.2); return; }
      const mode = n === 1 ? "wide" : id !== lastSp ? "close" : (n % 3 === 0 ? "wide" : n % 3 === 1 ? "over" : "close"); lastSp = id;
      if (mode === "close") { const cu = closeUp(f, n % 2 ? 1 : -1, 1.15); st.cam.cut(cu.pos.clone().add(new V3(0, 0, 0.2)), cu.look); st.cam.go(cu.pos, cu.look, 0.35); }
      else if (mode === "over") { const h = headPos(f); st.cam.cut(new V3(-1.2, 1.35, 1.6), h.clone().add(new V3(-0.6, -0.3, 0))); st.cam.go(new V3(-1.0, 1.35, 1.2), h.clone().add(new V3(-0.6, -0.3, 0)), 0.3); }
      else { st.cam.cut(R.wide.pos, R.wide.look); st.cam.go(R.wide.pos.clone().add(new V3(0, 0, -1)), R.wide.look, 0.25); }
    };
    let pt = 0;
    Object.assign(st, { update(t, dt) {
      st.cam.update(dt);
      for (const [k, f] of Object.entries(figs)) updateFigure(f, t, dt, st.talking === k ? Math.abs(Math.sin(t * 13)) * (0.6 + 0.4 * Math.sin(t * 3.1)) : 0, C.camera, k.startsWith("seat_") ? 0 : yawTo(f, C.camera.position) * 0.7);
      pt += dt; if (pt > 1 / 20) { pt = 0; paintTactical(R.screen.canvas, ms, hl, t); R.screen.tex.needsUpdate = true; }
    } });
    return st;
  },
  scramble(shot) {
    const ms = shot.ms; baseStage({ ...hubEnv(), fov: 52 }); C.sun.intensity = 0.3; C.fill.intensity = 0.15;
    const R = ROOMS.buildHangar(C.world, true); C.indoor = true;
    const myType = ms.ship, wingType = ms.ship === "wraith" ? "warden" : ms.ship;
    const mine = put(myType, [0, 2.2, -12], [0, 0, 0]);
    mine.obj.traverse(o => { if (o.isMesh && o.material && o.material.map === M.tex().glass) o.visible = false; });
    const can = ROOMS.makeCanopy(myType); mine.obj.add(can); can.rotation.x = 1.15;   // hinged at the rear: open = front lifted up
    const wsz = new THREE.Box3().setFromObject(M.buildShip(wingType).obj).getSize(new V3());   // measure, then park with clearance
    const others = (ms.wing || []).map((w, i) => ({ w, s: put(wingType, [(i % 2 ? 1 : -1) * (wsz.x + 4) * (1 + Math.floor(i / 2) * 0.5), 2.2, -6 - Math.floor(i / 2) * (wsz.z + 6)], [0, i % 2 ? -0.12 : 0.12, 0]) }));
    const runners = [];
    // the player is already strapped in, canopy up; the wingmen sprint to their fighters across the deck
    const me = place("player", [0, 0, 0], Math.PI, "sitBack");
    others.forEach(({ w, s }, i) => { const f = place(w, [i % 2 ? 9 : -6, 0, 20], Math.PI, "run"); if (f) runners.push({ f, from: f.position.clone(), to: s.obj.position.clone().setY(0).add(new V3(i % 2 ? -3 : 3, 0, 3)) }); });
    const crew = place("rabbit", [-4, 0, -4], 0.6, "point");
    const seat = can.userData.seat; let seated = true; if (me) { mine.obj.add(me); me.position.copy(seat); me.rotation.set(0, Math.PI, 0); }
    const cam = camRig(new V3(-16, 12, 26), new V3(0, 2, -6)); const st = { cam };
    const glowL = new THREE.PointLight(0x7dffa8, 0, 4, 2); mine.obj.add(glowL); glowL.position.set(seat.x, seat.y + 1.2, seat.z - 0.6);
    Object.assign(st, { update(t, dt) {
      for (const b of R.beacons) { const k = (Math.sin(t * 7 + b.l.position.x) * 0.5 + 0.5); b.l.intensity = k * 140; b.b.material.color.setRGB(0.4 + k * 0.6, 0.05, 0.02); }
      if (Math.floor(t * 1.25) !== st.kl) { st.kl = Math.floor(t * 1.25); sfx.cue("u_klaxon", 0.4, {}, 520, 0.35, 0.05, "sawtooth"); }
      for (const r of runners) {
        if (r.done) { updateFigure(r.f, t, dt, 0, C.camera, 0); continue; }
        const k = Math.min(1, t / 3.6); r.f.position.lerpVectors(r.from, r.to, k); r.f.rotation.y = Math.atan2(r.to.x - r.from.x, r.to.z - r.from.z);
        updateFigure(r.f, t, dt, 0, C.camera, 0);
        if (k >= 1) { r.done = true; if (r.me) { setPose(r.f, "sitBack"); mine.obj.add(r.f); r.f.position.copy(seat); r.f.rotation.set(0, Math.PI, 0); seated = true; } else r.f.visible = false; }
      }
      if (crew) updateFigure(crew, t, dt, 0, C.camera, 0);
      if (t > 4.4) can.rotation.x = Math.max(0, 1.15 - (t - 4.4) * 0.7);   // swings down onto the cockpit
      glowL.intensity = t > 5.8 ? Math.min(6, (t - 5.8) * 4) : 0;
      const eng = t > 6.5 ? Math.min(1.4, (t - 6.5) * 0.9) : 0.05; glowEngines(mine, eng); others.forEach(o => glowEngines(o.s, eng));
      // camera choreography
      const P = mine.obj.position;
      // wide crane across the deck: klaxons, the deck chief waving, wingmen sprinting to their fighters in the distance
      if (t < 4.2) cam.go(new V3(-16 + t * 2.2, 11 - t * 0.9, 24 - t * 1.6), new V3(t * 0.4, 2.2, -8), 1.2);
      else if (t < 6.8) { if (!st.c3) { st.c3 = 1; cam.cut(P.clone().add(new V3(6.5, seat.y + 5.0, seat.z + 4.5)), P.clone().add(new V3(seat.x, seat.y + 1.0, seat.z))); } cam.go(P.clone().add(new V3(5.2, seat.y + 4.2, seat.z + 3.2)), P.clone().add(new V3(0, seat.y + 1.0, seat.z)), 0.4); }
      else { if (!st.c4) { st.c4 = 1; cam.cut(P.clone().add(new V3(0.6, seat.y + 2.0, seat.z - 4.5)), P.clone().add(new V3(0, seat.y + 1.1, seat.z))); } cam.go(P.clone().add(new V3(0.15, seat.y + 1.55, seat.z - 2.3)), P.clone().add(new V3(0, seat.y + 1.1, seat.z)), 0.6); }
      cam.update(dt);
      if (t > 8.7) { const fl = $("cTitle"); }
    } });
    return st;
  },
});
function setStage(name, arg) { if (name === "_keep" && stage) return; if (stage && stage.done) stage.done(); stage = STAGES[name](arg); stage.t = 0; stage.name = name;
  const hd = $("hDeck"); if (hd) hd.textContent = name === "hangarRoom" ? "Back to Lounge" : "Flight Deck";
  try { C.renderer.compile(C.scene, C.camera); } catch (e) { }   // compile every shader now, so figures never pop in half-built on their first frame
}

// idle / cine render hooks
C.hooks.idle = dt => { if (!booted && pad.pressed.size) boot(); menuPad(dt); if (stage) { stage.t += dt; stage.update.call(stage, stage.t, dt); } cineStep(dt); };
C.hooks.cine = dt => { cineTick(dt); if (stage) { stage.t += dt; stage.update.call(stage, stage.t, dt); } cineStep(dt); };
C.hooks.pause = () => pauseGame();
C.hooks.fullscreen = () => fullscreen();
C.hooks.padConnected = id => toast("Controller connected: " + id.split("(")[0].trim());
C.hooks.frame = dt => { if (C.paused) menuPad(dt); if (C.mission && C.mission.id === "sim" && C.state === "flight") simTick(dt); if (C.mission && C.mission.id === "simx" && C.state === "flight") simScenTick(dt); };

// ======================================================================= CINEMATICS
let cine = null;
function playCine(id, done, onlyChoices = false) {
  const shots = (typeof id === "string" ? CUTSCENES[id] : id) || [];
  if (!shots.length) { done && done(); return; }
  cine = { shots, i: -1, done, onlyChoices };
  C.state = "cine"; exitPointer();
  for (const s of screens) $(s).hidden = true; $("credit").hidden = true;
  $("cine").hidden = false;
  nextShot();
}
const ROOMSHOTS = ["talk", "medal", "broadcast", "briefing", "scramble"];
function nextShot() {
  voice.stop();
  const c = cine; if (!c) return;
  c.i++;
  if (c.onlyChoices) while (c.i < c.shots.length && !c.shots[c.i].choice && !c.shots[c.i].scene.startsWith("ending") && c.shots[c.i].scene !== "scramble") c.i++;
  if (c.i >= c.shots.length) { endCine(); return; }
  const s = c.shot = c.shots[c.i]; c.t = 0; c.line = -1; c.lineT = 0; c.waitInput = false; c.choosing = false;
  $("cTitle").classList.remove("show"); $("cTitle").textContent = s.title || ""; $("cCap").textContent = s.caption || ""; $("cCapTop").textContent = "";
  $("cSub").innerHTML = ""; $("cTalk").hidden = true; $("cStatic").hidden = true; $("cChoiceBox").hidden = true; $("cMedal").hidden = true;
  if (s.title) setTimeout(() => $("cTitle").classList.add("show"), 400);
  if (s.scene.startsWith("ending")) { endCine(true); showEnding(s.scene); return; }
  if (s.scene === "talk" || s.scene === "medal" || s.scene === "broadcast") {
    setStage("talkRoom", s);
    if (s.medal) { giveMedal(s.medal); const mc = $("cMedal"); const x = mc.getContext("2d"); x.clearRect(0, 0, 240, 320); drawMedal(x, MEDALS[s.medal], 20, 10, 200); mc.hidden = false; }
    sfx.play(s.scene === "broadcast" ? "tense" : s.medal ? "triumph" : sfx.mood === "combat" || sfx.mood === "cruise" || !sfx.mood ? "hub" : sfx.mood);
  } else if (s.scene === "briefing") { setStage("briefingRoom", s); sfx.play("brief"); }
  else if (s.scene === "scramble") { setStage("scramble", s); sfx.play("tense"); }
  else { setStage(s.scene, s); sfx.play({ ship_reveal: "triumph", funeral: "sad", bell: "sad", space_war: "combat", spark_ram: "tense", lodestar_dies: "tense", alarm: "tense", pyre_reveal: "tense", corinth_burn: "sad", planet_breaks: "sad", halcyon_dies: "sad", pyre_dies: "triumph", ember_wreck: "sad", title: "title" }[s.scene] || "brief"); }
  advanceLine();
}
STAGES._keep = () => stage; STAGES.lounge = lounge;
function advanceLine() {
  const c = cine, s = c.shot; c.line++; c.lineT = 0; c.waitInput = false;
  const lines = s.lines || [];
  if (c.onlyChoices && c.line < lines.length && s.choice) c.line = lines.length - 1;
  if (c.line >= lines.length) {
    if (s.choice && !c.choosing) { showChoice(s.choice); return; }
    if (["talk", "medal", "broadcast", "briefing"].includes(s.scene) || (s.dur || 0) <= c.t) { nextShot(); return; }
    c.waitScene = true; return;
  }
  const [who, text] = lines[c.line]; const sp = CAST[who] || CAST.comms;
  const txt = fmtLine(text);
  if (stage && stage.setSpeaker) stage.setSpeaker(who, c.line);
  $("cSub").innerHTML = `<b>${escapeHtml((sp.callsign || sp.name).toUpperCase())}</b>: ${escapeHtml(txt)}`;
  c.speaker = who; c.speaking = true; if (stage) stage.talking = who;
  voice.say(who, txt, () => { if (cine === c && c.line >= 0) { c.speaking = false; if (stage) stage.talking = null; c.autoT = 1.0; } });
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]); }
let twTimer = null;
function typewrite(el, text) { clearInterval(twTimer); let i = 0; el.textContent = ""; twTimer = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) clearInterval(twTimer); }, 16); el.dataset.full = text; }
function showChoice(ch) {
  const c = cine; c.choosing = true; voice.stop(); if (stage) stage.talking = null;
  $("cSub").innerHTML = ""; $("cQ").textContent = ch.q; $("cChoiceBox").hidden = false;
  if (stage && stage.setSpeaker) stage.setSpeaker("player", -1);
  const box = $("cChoices2"); box.innerHTML = "";
  ch.options.forEach((o, i) => { const b = document.createElement("button"); b.className = "btn"; b.textContent = o.text; b.onclick = () => { applyChoice(o); box.innerHTML = ""; $("cChoiceBox").hidden = true; c.choosing = false; if (o.act) { const a = o.act; if (cine) cine.done = null; endCine(); a(); return; } nextShot(); }; box.appendChild(b); if (i === 0) setTimeout(() => setFocus(b), 50); });
}
function applyChoice(o) { if (o.flag) camp.flags[o.flag] = true; for (const [k, v] of Object.entries(o.morale || {})) camp.morale[k] = (camp.morale[k] || 0) + v; save(); }
function giveMedal(id) { camp.medals.push(id); save(); }
function endCine(keepState) {
  voice.stop(); $("cine").hidden = true; const d = cine && cine.done; cine = null;
  if (!keepState) C.state = "menu";
  d && d();
}
function cineTick(dt) {
  const c = cine; if (!c) return; c.t += dt; c.lineT += dt;
  const s = c.shot;
  // draw speaker
  if (!$("cStatic").hidden) { const cv = $("cStatic"); if (cv.width !== 320) { cv.width = 320; cv.height = 180; } const x = cv.getContext("2d"); const id = x.createImageData(320, 180); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = v; id.data[i + 1] = v * 0.6; id.data[i + 2] = v * 0.5; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); }
  // auto-advance
  if (c.autoT !== undefined && !c.choosing) { c.autoT -= dt; if (c.autoT <= 0) { c.autoT = undefined; advanceLine(); } }
  if (c.waitScene && c.t >= (s.dur || 0)) { c.waitScene = false; nextShot(); }
  // inputs
  if (pad.connected) menuPad(dt);
  if (!c.choosing && (pad.pressed.has(0) || cineKey.adv)) { cineKey.adv = false; skipLine(); }
  if (pad.pressed.has(1) || pad.pressed.has(9) || cineKey.skip) { cineKey.skip = false; skipAll(); }
}
const cineKey = { adv: false, skip: false };
const hubKey = { adv: false };
function skipLine() { const c = cine; if (!c || c.choosing) return; voice.stop(); if (stage) stage.talking = null; c.autoT = undefined; c.speaking = false; if (c.waitScene) { c.waitScene = false; nextShot(); } else advanceLine(); }
function skipAll() { const c = cine; if (!c || c.choosing) return; voice.stop(); c.onlyChoices = true; c.autoT = undefined; const s = c.shot; if (s.choice && !c.choosing) { showChoice(s.choice); return; } nextShot(); }
$("cine").addEventListener("click", e => { if (e.target.closest(".btn")) return; skipLine(); });
function drawMedal(x, m, px, py, w) {
  x.save(); x.translate(px, py);
  x.fillStyle = "#1c3c78"; x.fillRect(w * 0.3, 0, w * 0.4, w * 0.5); x.fillStyle = "#c02020"; x.fillRect(w * 0.45, 0, w * 0.1, w * 0.5);
  const g = x.createRadialGradient(w / 2, w * 0.95, 4, w / 2, w * 0.95, w * 0.42); g.addColorStop(0, "#fff"); g.addColorStop(0.3, m.color); g.addColorStop(1, "#3a3020");
  x.fillStyle = g; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? w * 0.18 : w * 0.42; x.lineTo(w / 2 + Math.cos(a) * r, w * 0.95 + Math.sin(a) * r); } x.fill();
  x.restore();
}

// ======================================================================= ENDING
function showEnding(kind) {
  const key = kind === "ending_text" ? (camp.flags.targetAshkar ? "targetAshkar" : "targetKethra") : kind === "ending_text_lost" ? "lost" : "fail";
  const E = ENDINGS[key];
  if (key === "targetAshkar" || key === "targetKethra") { if (!camp.medals.includes("pegasus")) camp.medals.push("pegasus"); }
  camp.finished = key; save();
  show("ending"); C.state = "menu"; setStage("title");
  $("endTitle").textContent = E.title; const roll = $("endRoll"); roll.innerHTML = "";
  sfx.play(key === "targetAshkar" ? "triumph" : "sad");
  const lines = [...E.text, `— ${RANKS[camp.rank]} ${camp.name} “${camp.callsign}”: ${camp.kills} confirmed kills, ${camp.sorties} sorties.`];
  lines.forEach((t, i) => { const p = document.createElement("p"); p.textContent = t; roll.appendChild(p); setTimeout(() => p.classList.add("in"), 800 + i * 3400); });
  $("endGo").hidden = true; setTimeout(() => { $("endGo").hidden = false; focusFirst(); }, 800 + lines.length * 3400);
}
$("endGo").onclick = () => toTitle();

// ======================================================================= TITLE / NEW PILOT
function toTitle() { C.state = "menu"; setStage("title"); show("title"); sfx.play("title"); refreshTitle(); }
function refreshTitle() { const s = load(); $("bCont").disabled = !s; $("contInfo").textContent = s ? `${RANKS[s.rank]} ${s.callsign} · next: ${s.finished ? "campaign complete" : (MISSIONS[s.current]?.title || "")}` : "No saved campaign"; }
$("boot").addEventListener("click", boot);
let booted = false;
function boot() { if (booted) return; booted = true; sfx.init(); sfx.setVol(); playCine("cs_intro", () => toTitle()); }
$("bNew").onclick = () => { show("newpilot"); setTimeout(() => $("inCall").select(), 50); };
$("bCont").onclick = () => { camp = load(); if (!camp) return; Object.assign(C.opts, { difficulty: camp.diff || 1 }); if (camp.finished) { toast("Campaign complete. Start a new one to fly it again."); return; } toHub(); };
$("bSim").onclick = () => simMenu();
$("bCtl").onclick = () => openSub("controls", "title");
$("bOpt").onclick = () => openSub("options", "title");
$("bFull").onclick = () => fullscreen();
document.querySelectorAll("#diffSeg .btn").forEach(b => b.onclick = () => { document.querySelectorAll("#diffSeg .btn").forEach(x => x.classList.remove("on")); b.classList.add("on"); });
$("npBack").dataset.back = 1; $("npBack").onclick = () => toTitle();
$("npGo").onclick = () => {
  const name = $("inName").value.trim() || "Alex Mercer", cs = ($("inCall").value.trim() || "Maverick");
  const diff = +document.querySelector("#diffSeg .btn.on").dataset.d;
  camp = newCamp(name, cs, diff); C.opts.difficulty = diff; save();
  CAST.player.name = name; CAST.player.callsign = cs;
  playCine("cs_arrival", () => { camp.seen.m1 = true; save(); toHub(); });
};

// ======================================================================= OPTIONS / CONTROLS / PAUSE
let subReturn = null;
function openSub(id, ret) { subReturn = ret; show(id, ret === "pause" ? [] : []); if (id === "options") { syncOpts(); setOptTab(optTab); } if (id === "controls") buildHandbook(); }
function closeSub() { if (subReturn === "pause") { show("pause"); } else if (subReturn === "hub") show("hub"); else toTitle(); }
$("cBack").dataset.back = 1; $("cBack").onclick = closeSub; $("oBack").dataset.back = 1; $("oBack").onclick = () => { cancelCapture(); saveOpts(); saveBinds(); closeSub(); };
// ---- Controls handbook, generated from the live bindings so it never goes stale
function buildHandbook() {
  const box = document.querySelector("#controls .keys"); if (!box) return;
  const kb = id => (binds.kb[id] || []).filter(Boolean).map(keyName), pd = id => (binds.pad[id] || []).filter(Boolean).map(padName);
  const both = (...ids) => { const k = ids.flatMap(kb), p = ids.flatMap(pd); return [k.join(" / "), p.join(" / ")].filter(Boolean).join(" · ") || "Unbound"; };
  const A = binds.axes, an = a => A[a] && A[a].axis >= 0 ? axisName(A[a].axis) : null;
  const rows = [["FLIGHT", [["Pitch / yaw", ["Mouse", kb("pitchDown")[0] && "Arrows", an("pitch"), an("yaw")].filter(Boolean).join(" · ")], ["Roll", both("rollLeft", "rollRight") + (an("roll") ? " · " + an("roll") : "")],
      ["Throttle up / down", both("thrUp", "thrDn") + (an("throttle") ? " · " + an("throttle") : "")], ["Afterburner", both("ab")], ["Afterburner slide (drift)", both("slide")], ["Full stop", both("stop")], ["Match target speed", both("match")], ["Cloak (Wraith only)", both("cloak")]]],
    ["COMBAT", [["Fire guns", both("fire")], ["Fire missile / torpedo", both("missile")], ["Cycle missiles", both("cycMis")], ["Guns full / sequence", both("cycGun")], ["Drop decoy", both("decoy")], ["Nearest enemy", both("tgtNear")], ["Next / previous target", both("tgtNext", "tgtPrev")]]],
    ["COMMAND", [["Wingman comms", both("comms") + ", then 1–6"], ["Autopilot", both("auto")], ["Request landing", both("land")], ["Eject", both("eject")], ["Chase / cockpit view", both("view")], ["Look behind (hold)", both("look")], ["Pause", "Esc · " + both("pause")], ["Fullscreen", both("fullscreen")]]]];
  box.innerHTML = rows.map(([h, rs]) => `<h3>${h}</h3>` + rs.map(([l, v]) => `<div>${escapeHtml(l)}<b>${escapeHtml(v)}</b></div>`).join("")).join("") + `<p class="ohint" style="grid-column:1/-1;margin-top:10px">Rebind any of these under Options → Keyboard or Controller.</p>`;
}
// ---- Options: tabs, settings, rebinding
const OPT_DEFAULTS = JSON.parse(JSON.stringify(C.opts));
let optTab = "video";
function setOptTab(t) { optTab = t; document.querySelectorAll("#oTabs .btn").forEach(b => b.classList.toggle("on", b.dataset.t === t)); document.querySelectorAll("#options .opane").forEach(p => p.classList.toggle("on", p.dataset.p === t)); cancelCapture(); if (t === "keys") buildKeyList(); if (t === "pad") buildPadList(); }
document.querySelectorAll("#oTabs .btn").forEach(b => b.onclick = () => setOptTab(b.dataset.t));
function syncOpts() {
  const set = (id, v) => document.querySelectorAll(`#${id} .btn`).forEach(b => b.classList.toggle("on", String(b.dataset.v) === String(v)));
  const o = C.opts;
  set("oVoice", o.voice ? 1 : 0); set("oInv", o.invert ? 1 : 0); set("oMInv", o.mouseInvert ? 1 : 0); set("oMus", o.music); set("oSfx", o.sfx); set("oSens", o.sens);
  set("oQual", o.quality || "high"); set("oFov", o.fov || 72); set("oBright", o.bright ?? 1); set("oBloom", o.bloom ?? 1); set("oShake", o.shake ?? 1); set("oFps", o.fps ? 1 : 0);
  set("oMaster", o.master ?? 1); set("oVVol", o.voiceVol ?? 1); set("oDead", o.deadzone ?? 0.14); set("oVib", o.vibration === false ? 0 : 1);
  set("oDiff", camp ? (camp.diff || 1) : (o.difficulty || 1)); set("oAutoP", o.autoPause === false ? 0 : 1);
  // snap legacy values (older saves) onto the nearest button so a segment is always lit
  for (const id of ["oMus", "oSfx", "oSens", "oMaster"]) { const bs = [...document.querySelectorAll(`#${id} .btn`)]; if (!bs.some(b => b.classList.contains("on"))) { const v = { oMus: o.music, oSfx: o.sfx, oSens: o.sens, oMaster: o.master ?? 1 }[id]; bs.reduce((p, c) => Math.abs(+c.dataset.v - v) < Math.abs(+p.dataset.v - v) ? c : p).classList.add("on"); } }
}
const bindSeg = (id, fn) => document.querySelectorAll(`#${id} .btn`).forEach(b => b.onclick = () => { fn(b.dataset.v); syncOpts(); sfx.setVol(); saveOpts(); });
bindSeg("oVoice", v => { C.opts.voice = v === "1"; if (!C.opts.voice) voice.stop(); });
bindSeg("oInv", v => C.opts.invert = v === "1"); bindSeg("oMInv", v => C.opts.mouseInvert = v === "1");
bindSeg("oMus", v => C.opts.music = +v); bindSeg("oSfx", v => { C.opts.sfx = +v; sfx.cue("u_confirm", 0.5, {}, 900, 0.04, 0.08); }); bindSeg("oSens", v => C.opts.sens = +v);
bindSeg("oQual", v => { C.opts.quality = v; applyQuality(); toast(`Graphics: ${v[0].toUpperCase() + v.slice(1)}. Planets and sky refresh on the next scene.`, 2600); });
bindSeg("oFov", v => { C.opts.fov = +v; if (C.state === "flight" || C.state === "auto") { C.camera.fov = +v; C.camera.updateProjectionMatrix(); } });
bindSeg("oBright", v => { C.opts.bright = +v; C.renderer.toneMappingExposure = 1.05 * C.opts.bright; });
bindSeg("oBloom", v => C.opts.bloom = +v); bindSeg("oShake", v => C.opts.shake = +v); bindSeg("oFps", v => C.opts.fps = v === "1");
bindSeg("oMaster", v => C.opts.master = +v); bindSeg("oVVol", v => { C.opts.voiceVol = +v; if (C.opts.voice) voice.say("player", "Volume check."); });
bindSeg("oDead", v => C.opts.deadzone = +v); bindSeg("oVib", v => { C.opts.vibration = v === "1"; if (C.opts.vibration) rumbleTest(); });
bindSeg("oDiff", v => { C.opts.difficulty = +v; if (camp) { camp.diff = +v; save(); } });
bindSeg("oAutoP", v => C.opts.autoPause = v === "1");
function rumbleTest() { try { const g = pad.raw; g && g.vibrationActuator && g.vibrationActuator.playEffect("dual-rumble", { duration: 180, strongMagnitude: 0.6, weakMagnitude: 0.4 }); } catch (e) { } }
$("oFull").onclick = () => fullscreen();
$("oAllReset").onclick = () => { Object.assign(C.opts, JSON.parse(JSON.stringify(OPT_DEFAULTS))); if (camp) C.opts.difficulty = camp.diff || 1; resetBinds(); applyQuality(); C.renderer.toneMappingExposure = 1.05; saveOpts(); sfx.setVol(); syncOpts(); toast("All options and controls restored to defaults.", 2200); };

// key / button names
const KEYN = { Space: "Space", Backspace: "Backspace", Tab: "Tab", Enter: "Enter", Escape: "Esc", ShiftLeft: "L Shift", ShiftRight: "R Shift", ControlLeft: "L Ctrl", ControlRight: "R Ctrl", AltLeft: "L Alt", AltRight: "R Alt",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Equal: "=", Minus: "−", BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\", Backquote: "`",
  MouseL: "Left click", MouseR: "Right click", CapsLock: "Caps Lock", Delete: "Delete", Insert: "Insert", Home: "Home", End: "End", PageUp: "Page Up", PageDown: "Page Down" };
function keyName(c) { if (!c) return "—"; if (c.startsWith("Ctrl+")) return "Ctrl + " + keyName(c.slice(5)); if (KEYN[c]) return KEYN[c]; if (c.startsWith("Key")) return c.slice(3); if (c.startsWith("Digit")) return c.slice(5); if (c.startsWith("Numpad")) return "Num " + c.slice(6); return c; }
const PADN = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "L3", "R3", "D-pad ↑", "D-pad ↓", "D-pad ←", "D-pad →", "Guide"];
function padName(s) { if (s == null || s === "") return "—"; return String(s).split("+").map(n => PADN[+n] || "Btn " + n).join(" + "); }
const AXN = ["Left stick ↔", "Left stick ↕", "Right stick ↔", "Right stick ↕"];
function axisName(a) { return a == null || a < 0 ? "—" : (AXN[a] || "Axis " + a); }
window.__keyName = keyName; window.__padName = padName;

// capture flow
let capBtn = null, capEnd = 0, capTimer = 0;
function cancelCapture() { if (capBtn) capBtn.classList.remove("wait"); capBtn = null; if (capture.fn) capEnd = performance.now(); capture.fn = null; capture.mouse = capture.pad = capture.axis = false; clearTimeout(capTimer); }
function startCapture(btn, opts, done) {
  if (performance.now() - capEnd < 250) return;   // the click that finished the last capture
  cancelCapture(); capBtn = btn; btn.classList.add("wait"); const prev = btn.textContent; btn.textContent = opts.prompt;
  Object.assign(capture, { mouse: !!opts.mouse, pad: !!opts.pad, axis: !!opts.axis });
  const finish = () => { cancelCapture(); };
  capTimer = setTimeout(() => { btn.textContent = prev; finish(); }, opts.pad ? 6000 : 10000);
  capture.fn = ev => {
    if (ev.kind === "key" && ev.code === "Escape") { btn.textContent = prev; finish(); return; }
    if (done(ev) === false) return;   // not a usable input for this slot, keep listening
    finish(); saveBinds(); sfx.cue("u_confirm", 0.45, {}, 900, 0.04, 0.08);
    if (optTab === "keys") buildKeyList(); else buildPadList();
  };
}
function actLabel(id) { return (ACTIONS.find(a => a[0] === id) || [id, id])[1]; }
function buildKeyList() {
  const box = $("oKeys"); box.innerHTML = ""; let grp = "";
  for (const [id, label, g] of ACTIONS) {
    if (g !== grp) { grp = g; const h = document.createElement("h3"); h.textContent = g.toUpperCase(); box.appendChild(h); }
    const row = document.createElement("div"); row.className = "brow"; const sp = document.createElement("span"); sp.textContent = label; row.appendChild(sp);
    const list = binds.kb[id] || (binds.kb[id] = ["", ""]);
    for (let slot = 0; slot < 2; slot++) {
      const b = document.createElement("button"); b.className = "btn" + (list[slot] ? "" : " empty"); b.textContent = keyName(list[slot]);
      b.onclick = () => startCapture(b, { prompt: "Press a key…", mouse: true }, ev => {
        if (ev.kind !== "key") return false;
        if (ev.code === "Delete") { list[slot] = ""; return; }
        if (ev.code === "Escape") return false;
        for (const [oid, l] of Object.entries(binds.kb)) l.forEach((c, i) => { if (c === ev.code && !(oid === id && i === slot)) { l[i] = ""; toast(`${keyName(ev.code)} moved from “${actLabel(oid)}”.`, 2000); } });
        list[slot] = ev.code;
      });
      row.appendChild(b);
    }
    box.appendChild(row);
  }
}
function buildPadList() {
  const box = $("oPad"); box.innerHTML = ""; $("oPadName").textContent = pad.connected ? `Connected: ${pad.name.replace(/\(.*?\)/g, "").trim().slice(0, 48)}.` : "No controller detected. Press any button on it to wake it.";
  const h0 = document.createElement("h3"); h0.textContent = "STICKS"; box.appendChild(h0);
  for (const [id, label] of [["pitch", "Pitch (nose up / down)"], ["yaw", "Yaw (turn)"], ["roll", "Roll"], ["throttle", "Throttle"]]) {
    const ax = binds.axes[id] || (binds.axes[id] = { axis: -1, inv: false });
    const row = document.createElement("div"); row.className = "brow"; const sp = document.createElement("span"); sp.textContent = label; row.appendChild(sp);
    const b = document.createElement("button"); b.className = "btn" + (ax.axis >= 0 ? "" : " empty"); b.textContent = axisName(ax.axis);
    b.onclick = () => startCapture(b, { prompt: "Move a stick…", pad: true, axis: true }, ev => {
      if (ev.kind === "key" && ev.code === "Delete") { ax.axis = -1; return; }
      if (ev.kind !== "axis") return false;
      for (const [oid, o] of Object.entries(binds.axes)) if (oid !== id && o.axis === ev.axis) { o.axis = -1; toast(`${axisName(ev.axis)} moved from ${oid}.`, 2000); }
      ax.axis = ev.axis;
    });
    const iv = document.createElement("button"); iv.className = "btn" + (ax.inv ? " on" : ""); iv.textContent = ax.inv ? "Inverted" : "Normal";
    iv.onclick = () => { ax.inv = !ax.inv; saveBinds(); buildPadList(); };
    row.append(b, iv); box.appendChild(row);
  }
  let grp = "";
  for (const [id, label, g] of ACTIONS) {
    if (g !== grp) { grp = g; const h = document.createElement("h3"); h.textContent = g.toUpperCase(); box.appendChild(h); }
    const list = binds.pad[id] || (binds.pad[id] = []);
    const row = document.createElement("div"); row.className = "brow"; const sp = document.createElement("span"); sp.textContent = label; row.appendChild(sp);
    for (let slot = 0; slot < 2; slot++) {
      const b = document.createElement("button"); b.className = "btn" + (list[slot] ? "" : " empty"); b.textContent = padName(list[slot]);
      b.onclick = () => startCapture(b, { prompt: "Press a button…", pad: true }, ev => {
        if (ev.kind === "key" && ev.code === "Delete") { list[slot] = ""; tidy(list); return; }
        if (ev.kind !== "pad") return false;
        const held = (ev.held || []).map((v, i) => v && i !== ev.button ? i : -1).filter(i => i >= 0).slice(0, 1);   // a button already held makes a combo
        const code = held.length ? `${held[0]}+${ev.button}` : String(ev.button);
        for (const [oid, l] of Object.entries(binds.pad)) l.forEach((c, i) => { if (c === code && !(oid === id && i === slot)) { l[i] = ""; tidy(l); toast(`${padName(code)} moved from “${actLabel(oid)}”.`, 2000); } });
        list[slot] = code; tidy(list);
      });
      row.appendChild(b);
    }
    box.appendChild(row);
  }
}
function tidy(l) { for (let i = l.length - 1; i >= 0; i--) if (l[i] === "" && i === l.length - 1) l.pop(); }
$("oKeysReset").onclick = () => { resetBinds(["kb"]); buildKeyList(); toast("Keyboard and mouse restored to defaults.", 1800); };
$("oPadReset").onclick = () => { resetBinds(["pad", "axes"]); buildPadList(); toast("Controller restored to defaults.", 1800); };
function pauseGame() {
  if (C.state !== "flight" && C.state !== "auto") return;
  if (!$("pause").hidden) { resume(); return; }
  C.paused = true; exitPointer(); voice.stop(); sfx.engine(0, false);
  $("pauseTitle").textContent = C.mission.title; $("pauseObj").innerHTML = (C.mission.objectives || []).map(o => `<div><span class="m">·</span>${escapeHtml(o)}</div>`).join("") + ((C.mission.secondary || []).length ? `<div class="eyebrow" style="margin-top:10px;color:var(--blue)">Secondary</div>` + C.mission.secondary.map(o => `<div><span class="m" style="color:var(--blue)">◇</span>${escapeHtml(o.text)}</div>`).join("") : "");
  show("pause"); $("pResume").dataset.back = 1;
}
function resume() { for (const s of ["pause", "options", "controls"]) $(s).hidden = true; C.paused = false; consumeEdges(); }
$("pResume").onclick = resume; $("pCtl").onclick = () => openSub("controls", "pause"); $("pOpt").onclick = () => openSub("options", "pause"); $("pFull").onclick = () => fullscreen();
$("pAbort").onclick = () => { $("pause").hidden = true; C.paused = false; abortMission(); };
document.addEventListener("visibilitychange", () => { if (document.hidden && C.opts.autoPause !== false) pauseGame(); });
window.addEventListener("blur", () => { if (C.opts.autoPause !== false && !C.paused) pauseGame(); });
window.addEventListener("keydown", e => {
  if (capture.fn) return;   // the rebinding UI owns this key
  if (C.state === "cine") { if (e.code === "Escape") cineKey.skip = true; else if (["Enter", "Space", "NumpadEnter"].includes(e.code) && !(document.activeElement && document.activeElement.classList.contains("btn"))) { e.preventDefault(); cineKey.adv = true; } }
  if (e.code === "F8") { e.preventDefault(); if (C.state !== "flight") fullscreen(); }
  if (C.state === "menu" && stage && (stage.talkFig || stage.viewing) && ["Escape", "Enter", "Space"].includes(e.code)) { e.preventDefault(); hubKey.adv = true; return; }
  if (!["flight", "auto", "landing", "launch", "cine"].includes(C.state) && e.code === "Escape") { const b = topScreen()?.querySelector("[data-back]"); if (b) b.click(); }
  if (!booted && $("boot") && !$("boot").hidden) boot();
});

// ======================================================================= HUB
function stageIdx() { return camp.done.filter(id => MAIN.includes(id)).length; }
function crewPresent() {
  const d = new Set(camp.done);
  const list = ["varga", "vesper", "deacon", "spark", "ricochet", "frost", "ember", "halo", "rabbit"];
  return list.filter(id => {
    if (id === "spark" && d.has("m6")) return false;
    if (id === "ricochet" && d.has("m9b")) return false;
    if ((id === "halo" || id === "ember" || id === "vesper") && d.has("m7")) return false;
    return true;
  }).concat(d.has("m9") ? ["voss"] : []);
}
function crewFate(id) {
  const d = new Set(camp.done);
  if (id === "spark" && d.has("m6")) return "KIA";
  if (id === "ricochet" && d.has("m9b")) return "KIA";
  if (id === "halo" && d.has("m7")) return "KIA";
  if (id === "vesper" && d.has("m7")) return d.has("m8") ? "KIA" : "MIA";
  if (id === "ember" && d.has("m7")) return d.has("m8") ? (camp.flags.emberKilled ? "TRAITOR · KIA" : "TRAITOR · AT LARGE") : "TRAITOR";
  return "";
}
const LOUNGE = {
  varga: [[0, "Thirty-one years in this Navy and I still can't sleep the night before a strike. If anyone tells you they can, they're lying or they're dangerous."], [3, "Corinth. I've read the casualty count four times. The number doesn't change. You fight for the next Corinth, {rank}. That's all any of us can do."], [6, "I rang that bell for Tanaka. My hand shook. Thirty-one years and my hand still shakes."], [9, "Whatever happens at Kethra, you'll carry it for the rest of your life. Make sure it's something you can carry."]],
  vesper: [[0, "Fly your mission, come back, write your report. In that order. The heroics are for the people who don't come back."], [2, "You flew well against the Graven's people. Don't let it go to your head. Ricochet's head is already full."], [4, "Admiral Thorne wants me on an intelligence run. If I don't come back, don't you dare let them put my name on a ship."]],
  deacon: [[0, "Everyone gets one free mistake out there. Most people use it on their first sortie. Try to save yours."], [2, "Ember? He prays, you know. To something older than the Hegemon. I've heard him in the chapel. Same words I'd use, more or less."], [5, "The trick to grief is you don't get over it. You get used to carrying it. Spark would've told you that with a paper crane in her hand."], [8, "Voss and I talk at night. She asks me if there's forgiveness for what she's built. I tell her I'll let her know when I find out about mine."]],
  spark: [[0, "Kenji went missing over Tessaly. Two years. Everyone says he's dead. I say: show me the wreck."], [2, "Nine hundred and ninety cranes. Nine to go. Don't laugh! Okay, you can laugh a little."], [4, "If anything ever happens to me, look after Danny. He acts tough. He's not."]],
  ricochet: [[0, "Second highest killboard on the ship, rookie. Second only to the Colonel, and she's been flying since before I was born."], [3, "The Vharr burned my rig in the Calder belt when I was fourteen. Every Dhakar I kill, I see that rig."], [6, "Don't talk to me about Spark. Not yet. Just... fly with me tomorrow, alright?"], [9, "When this is over I'm going to open a bar. A real one, with real beer. You're invited. You're paying."]],
  frost: [[0, "...Welcome aboard."], [3, "Hale's Drift. I was the only one of my squadron who came back. You learn not to make friends. Then you make them anyway."], [6, "I'm glad you're still flying. I don't say that often."], [9, "After the war I'd like to see snow again. Real snow. Not ice on a hull."]],
  ember: [[0, "You may sit. I do not bite. That is a Vharr joke. Halo taught me that humans need jokes."], [2, "My children are with my sister's clan, if they still live. My daughter would be nine now. She wanted to be a poet."], [4, "Sometimes I wake and do not remember where I am. I hear a voice saying a phrase I do not know. It frightens me more than battle."]],
  halo: [[0, "I got a letter from home! My little brother says he's going to be a pilot like me. I should tell him to be a dentist."], [2, "I sat with Ember again. He told me about Vharr poetry. They have a word for the feeling of watching a star die. Isn't that beautiful?"], [4, "You think we'll win? I mean really. I think we will. I have to think we will."]],
  rabbit: [[0, "Bring my ships back in one piece and we'll get along fine. Bring 'em back in two pieces and you'll learn some new words."], [3, "Pulled a Rend Cannon slug the size of my fist out of your Lancer's armor. Kept it. It's on my shelf now. You're welcome."], [7, "The Wraiths came aboard in sealed crates. I'm not allowed to look inside. So I looked inside. God help us all."]],
  voss: [[0, "They gave me a cabin with a window. I keep the shutter closed. I don't want to look at stars right now."], [1, "I used to love geology. Now every planet I look at, I see the fault lines."]],
};
function toHub() {
  C.state = "menu"; CAST.player.name = camp.name; CAST.player.callsign = camp.callsign; CAST.player.rank = RANKS[camp.rank]; camp.addr = RANK_ADDR[camp.rank];
  show("hub"); $("hubPanel").hidden = true; $("talkbar").hidden = true;
  setStage("loungeRoom"); sfx.play("hub");
  $("hubWho").textContent = `${RANKS[camp.rank]} ${camp.callsign} · ${camp.kills} kills`;
}
function deckBlurb() {
  const st = stageIdx(); const ms = MISSIONS[camp.current];
  if (ms.losing) return "The squadron is stretched thin and the Halcyon is limping. The next sortie is a fight for survival. Win it and the carrier can take the war back to the Vharr.";
  return ["The Halcyon holds station over Calder. Deck crews are fueling the Kestrels. Your first patrol is waiting in the briefing room.", "Two sorties in. People are starting to learn your call sign.", "The Ashen Talons are hunting in Hale's Drift. Word is Sh'kara the Graven has seen your ship.", "The fires on New Corinth are visible from three systems away.", "The Ka'ven covered the Pyre-Mother's escape. The fleet wants it dead.", "A Hunt-Mother is twelve minutes out. Every pilot aboard is on alert.", "Admiral Thorne's flagship has docked. Nobody will say why.", "The Lodestar is gone. Somebody on this ship is a traitor.", "The Halcyon is quiet. Colonel Okonkwo's office door is closed and nobody opens it.", "Dr. Voss is aboard. So are three sealed crates from Fleet R&D.", "The fleet is massing for Kethra.", "One run. One device. One choice."][Math.min(st, 11)];
}
$("hOpt").onclick = () => openSub("options", "hub");
$("hQuit").onclick = () => { save(); toast("Campaign saved."); toTitle(); };
$("hLog").onclick = () => hubPanel("log");
// always-visible ways out of the lounge (the door hotspots sit behind the lounge camera)
$("hBrief").onclick = () => { if (!camp) return; if (stage && stage.talkFig) endRoomTalk(stage); $("hubPanel").hidden = true; toBriefing(); };
$("hDeck").onclick = () => { if (!camp) return; if (stage && stage.talkFig) endRoomTalk(stage); $("hubPanel").hidden = true;
  if (stage && stage.name === "hangarRoom") toHub(); else { setStage("hangarRoom"); $("hubLoc").textContent = "Flight Deck"; } };
$("hpClose").dataset.back = 1; $("hpClose").onclick = () => { $("hubPanel").hidden = true; if (stage && stage.panelClosed) stage.panelClosed(); };
function hubPanel(v, arg) {
  const el = $("hubContent"); $("hubPanel").hidden = false;
  if (v === "log") el.innerHTML = `<div class="eyebrow">Personal flight log · ${escapeHtml(camp.callsign)}</div><h2>${RANKS[camp.rank]} ${escapeHtml(camp.name)}</h2>`
    + `<div class="stat"><div>Merit points<b>${camp.points || 0}</b></div><div>Next rank<b>${RANK_PTS[camp.rank + 1] ? RANKS[camp.rank + 1] + " · " + RANK_PTS[camp.rank + 1] : "—"}</b></div><div>Secondaries<b>${camp.secDone || 0} / ${camp.secTotal || 0}</b></div><div>Flawless sorties<b>${(camp.perfect || []).length}</b></div></div>`
    + `${[...new Set(camp.medals)].length ? `<h3 style="font-size:15px;letter-spacing:.1em;color:var(--amber);margin-top:14px">Commendations</h3>` + [...new Set(camp.medals)].map(m => `<p style="margin:4px 0"><b style="color:${MEDALS[m].color}">■</b> ${MEDALS[m].name} <span style="color:var(--steel)">— ${MEDALS[m].why}</span></p>`).join("") : ""}`
    + `<h2 style="margin-top:18px">The war so far</h2>${WORLD.lore.map(([h, t]) => `<h3 style="font-size:15px;letter-spacing:.1em;color:var(--amber);margin-top:14px">${h}</h3><p>${t}</p>`).join("")}<h3 style="font-size:15px;letter-spacing:.1em;color:var(--amber);margin-top:14px">SORTIES</h3><div class="log">${camp.history.length ? camp.history.map(h => `<div><b>${h.title}</b> · ${h.system}<br><span class="${h.ok ? "ok" : "no"}">${h.ok ? "Success" : "Failure"}</span> · ${h.kills} kills</div>`).join("") : "<p>No sorties flown yet.</p>"}</div>`;
  if (v === "ship") { const d = SHIPS[arg]; el.innerHTML = `<div class="eyebrow" style="color:var(--blue)">Concord Navy · ${d.cls}</div><h2>${d.name}</h2><p>${d.desc}</p><div class="stat"><div>Max speed<b>${d.speed} kps</b></div><div>Afterburner<b>${d.ab} kps</b></div><div>Turn<b>${d.yaw}°/s</b></div><div>Shields<b>${d.shield.join("/")}</b></div><div>Armor<b>${d.armor.join("/")}</b></div><div>Guns<b>${d.guns.length}× ${GUNS[d.guns[0]].name}</b></div><div>Missiles<b>${Object.entries(d.missiles).map(([k, n]) => n + " " + MISSILES[k].short).join(", ")}</b></div><div>Decoys<b>${d.decoys}</b></div></div>`; }
  focusFirst();
}

// ======================================================================= BRIEFING
function toBriefing() {
  const ms = MISSIONS[camp.current];
  const go = () => playCine([{ scene: "briefing", ms, lines: ms.brief, choice: { q: `${ms.title} — ${ms.system}`, options: [
    { text: "Scramble", act: () => launch(ms) }, { text: "Back to the lounge", act: () => toHub() }] } }], () => toHub());
  const fresh = !unlockedShips(camp).includes(ms.ship);
  const reveal = () => { if (!fresh) return go(); camp.unlocked = [...new Set([...(camp.unlocked || ["kestrel"]), ms.ship])]; save(); playCine(revealCine(ms.ship), go); };
  if (ms.pre && !camp.seen[ms.id]) { camp.seen[ms.id] = true; save(); playCine(ms.pre, reveal); } else reveal();
}
function launch(ms) {
  voice.stop();
  const fly = () => { for (const s of screens) $(s).hidden = true; $("credit").hidden = true; camp.lastMission = ms.id; C.opts.difficulty = camp.diff || 1; startMission(ms, camp, onMissionEnd); toast("Click the screen to fly with the mouse. Esc pauses.", 3500); };
  const scramble = () => playCine([{ scene: "scramble", ms, dur: 9.2, lines: [["comms", ms.scramble ? "Scramble! Scramble! All pilots to your fighters!" : `Vigil Squadron, launch stations. ${camp.callsign}, you're in tube two.`]] }], fly);
  if (ms.choice && !camp.seen["choice_" + ms.id]) { camp.seen["choice_" + ms.id] = true; playCine([{ scene: "talk", who: ["ember"], lines: [], choice: ms.choice }], scramble); }
  else scramble();
}
// tactical display on the briefing room screen
function paintTactical(cv, ms, hl, t) {
  const x = cv.getContext("2d"), W = cv.width, H = cv.height;
  x.fillStyle = "#021008"; x.fillRect(0, 0, W, H);
  x.strokeStyle = "rgba(90,255,140,.08)"; x.lineWidth = 1; for (let i = 0; i < W; i += W / 20) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let j = 0; j < H; j += H / 11) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
  const mapW = W * 0.68; const n = ms.navs.length;
  const pts = ms.navs.map((nv, i) => [mapW * (0.1 + 0.8 * (n === 1 ? 0.5 : i / (n - 1))), H * (0.55 + (i % 2 ? -0.2 : 0.14) * (i === 0 || i === n - 1 ? 0 : 1))]);
  x.setLineDash([16, 10]); x.lineDashOffset = -t * 40; x.strokeStyle = "#7dffa8"; x.lineWidth = 4; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.stroke(); x.setLineDash([]);
  ms.navs.forEach((nv, i) => {
    const [px, py] = pts[i]; const car = nv.start || nv.home; const on = i === hl;
    x.strokeStyle = car ? "#78d0ff" : "#ffb040"; x.fillStyle = x.strokeStyle; x.lineWidth = 4;
    x.beginPath(); if (car) x.rect(px - 18, py - 18, 36, 36); else { x.moveTo(px, py - 22); x.lineTo(px + 22, py); x.lineTo(px, py + 22); x.lineTo(px - 22, py); x.closePath(); } x.globalAlpha = 0.25; x.fill(); x.globalAlpha = 1; x.stroke();
    if (on) { x.beginPath(); x.arc(px, py, 38 + Math.sin(t * 5) * 6, 0, 7); x.stroke(); }
    x.fillStyle = "#d8ffe0"; x.font = "bold 26px 'Share Tech Mono', monospace"; x.textAlign = "center"; x.fillText(nv.name.split("—")[0].trim().toUpperCase(), px, py + 58);
    let k = 0; for (const g of nv.groups || []) { const d = SHIPS[g.type]; for (let j = 0; j < (g.n || 1); j++) { const tx = px - 50 + (k % 6) * 20, ty = py - 52 - Math.floor(k / 6) * 20; x.fillStyle = d.faction === "vharr" ? "#ff5040" : "#78d0ff"; if (d.capital) x.fillRect(tx - 4, ty - 8, 34, 12); else { x.beginPath(); x.moveTo(tx, ty - 8); x.lineTo(tx + 8, ty + 6); x.lineTo(tx - 8, ty + 6); x.fill(); } k += d.capital ? 2 : 1; } }
  });
  x.fillStyle = "rgba(0,30,12,.75)"; x.fillRect(mapW, 0, W - mapW, H); x.strokeStyle = "#7dffa8"; x.lineWidth = 2; x.beginPath(); x.moveTo(mapW, 0); x.lineTo(mapW, H); x.stroke();
  x.textAlign = "left"; x.fillStyle = "#ffb040"; x.font = "bold 30px 'Chakra Petch', sans-serif"; x.fillText(ms.title.toUpperCase(), mapW + 24, 54);
  x.fillStyle = "#7dffa8"; x.font = "20px 'Share Tech Mono', monospace"; x.fillText(ms.system.toUpperCase(), mapW + 24, 86);
  x.font = "bold 22px 'Share Tech Mono', monospace"; x.fillStyle = "#ffb040"; x.fillText("PRIMARY", mapW + 24, 136);
  x.fillStyle = "#d8ffe0"; x.font = "19px 'Share Tech Mono', monospace";
  const wrap = (o, y, mark) => { const words = o.split(" "); let line = mark; for (const w of words) { if (x.measureText(line + w).width > W - mapW - 50) { x.fillText(line, mapW + 24, y); y += 24; line = "  "; } line += w + " "; } x.fillText(line, mapW + 24, y); return y + 32; };
  let y = 168; for (const o of ms.objectives) y = wrap(o, y, "› ");
  if (ms.secondary && ms.secondary.length) { y += 6; x.font = "bold 22px 'Share Tech Mono', monospace"; x.fillStyle = "#78d0ff"; x.fillText("SECONDARY  +75 EA", mapW + 24, y); y += 32; x.font = "19px 'Share Tech Mono', monospace"; x.fillStyle = "#bfe8ff"; for (const o of ms.secondary) y = wrap(o.text, y, "◇ "); }
  x.fillStyle = "#ffb040"; x.fillText("CRAFT: " + SHIPS[ms.ship].name.toUpperCase(), mapW + 24, H - 70);
  x.fillStyle = "#7dffa8"; x.fillText("WING: " + (ms.wing || []).map(w => CAST[w].callsign.toUpperCase()).join(", "), mapW + 24, H - 38);
  if (Math.random() < 0.3) { x.fillStyle = "rgba(125,255,168,.05)"; x.fillRect(0, Math.random() * H, W, 3); }
}

// ======================================================================= MISSION END / DEBRIEF
let lastResult = null;
function onMissionEnd(res) {
  lastResult = res; const ms = C.mission;
  C.state = "menu"; sfx.engine(0, false);
  if (ms.id === "sim" || ms.id === "simx") { simResults(res); return; }
  if (false) { show("debrief"); $("dbSys").textContent = "Flight Simulator"; $("dbRes").textContent = `Wave ${sim.wave}`; $("dbRes").className = "res ok"; $("dbObj").innerHTML = ""; $("dbStat").innerHTML = `<div>Kills<b>${res.stats.kills}</b></div><div>Accuracy<b>${res.stats.shots ? Math.round(100 * res.stats.hits / res.stats.shots) : 0}%</b></div>`; $("dbNote").textContent = ""; $("dbGo").onclick = () => { if (sim.keep) camp = sim.keep; if (sim.fromHub) { show(null); toHub(); } else toTitle(); }; setStage("hub"); return; }
  if (res.how === "abort") { toast("Mission aborted."); toHub(); return; }
  if (res.how === "kia") { show("kia"); setStage("hub"); sfx.play("sad"); $("kiaTxt").textContent = `${RANKS[camp.rank]} ${camp.name}, call sign ${camp.callsign}, was killed in action during operation “${ms.title}”. Their name was added to the Halcyon's bell.`; return; }
  const ok = res.success && res.how !== "carrierLost";
  camp.sorties++; if (ok) camp.wins++;
  camp.kills += res.stats.kills; camp.aceKills.push(...res.stats.aceKills);
  for (const [k, v] of Object.entries(res.stats.wingKills)) camp.wingKills[k] = (camp.wingKills[k] || 0) + v;
  if (ms.id === "m8" && res.stats.deadIds.has("ember")) camp.flags.emberKilled = true;
  camp.history.push({ id: ms.id, title: ms.title, system: ms.system, ok, kills: res.stats.kills });
  if (!camp.done.includes(ms.id)) camp.done.push(ms.id);
  const notes = [], award = (id, txt) => { if (!camp.medals.includes(id)) { camp.medals.push(id); notes.push(txt); return true; } return false; };
  // ---- objectives -> points
  const sec = judgeSecondary(ms, res, ok), secOk = sec.filter(s => s[1]).length;
  const branch = !!ms.losing, pPrim = ok ? (branch ? PTS.branchPrimary : PTS.primary) : 0, pSec = secOk * (branch ? PTS.branchSecondary : PTS.secondary);
  const oldRank = camp.rank; camp.points = (camp.points || 0) + pPrim + pSec; camp.secDone = (camp.secDone || 0) + secOk; camp.secTotal = (camp.secTotal || 0) + sec.length;
  const perfect = ok && sec.length && secOk === sec.length; if (perfect && !camp.perfect.includes(ms.id)) camp.perfect.push(ms.id);
  camp.history[camp.history.length - 1].sec = secOk; camp.history[camp.history.length - 1].secN = sec.length; camp.history[camp.history.length - 1].pts = pPrim + pSec;
  // ---- commendations
  const acc = res.stats.shots ? res.stats.hits / res.stats.shots : 0;
  if (res.stats.wounded) award("wound", "Awarded the Purple Comet for wounds received in action.");
  if (perfect) award("airmedal", "Every objective met. You are awarded the Air Medal.");
  if (camp.perfect.length >= 5) award("dfc", "Five flawless sorties. You are awarded the Distinguished Flying Cross.");
  if (acc >= 0.5 && res.stats.hits >= 20) award("marksman", "Half your rounds found their mark. You earn the Marksman's Badge.");
  if (res.stats.kills >= 5 && res.stats.hullEnd >= 0.99 && !res.stats.wounded) award("ironhull", "Five kills without a scratch. Iron Hull Citation.");
  if (camp.kills >= 25) award("ace", "Twenty-five confirmed kills. You are awarded the Ace of Aces Ribbon.");
  if (camp.kills >= 50) award("doubleace", "Fifty confirmed kills. Double Ace Ribbon.");
  if (ms.id === "m6" && !camp.medals.includes("calder")) camp.medals.push("calder");
  if (ms.final && ok && MAIN.every(id => camp.perfect.includes(id))) award("goldwings", "Every objective of the Calder campaign, primary and secondary. Golden Wings.");
  // ---- promotion
  camp.rank = Math.max(camp.rank, rankFor(camp.points)); camp.addr = RANK_ADDR[camp.rank];
  const promoted = camp.rank > oldRank;
  if (promoted) notes.unshift(`Promoted to ${RANKS[camp.rank]}.`);
  if (res.stats.ejected.length) notes.push(`Search and rescue recovered ${res.stats.ejected.map(p => CAST[p].callsign).join(", ")}.`);
  if (res.how === "eject") notes.push("You ejected. SAR picked you up, but the mission was a failure.");
  camp.lastResult = { id: ms.id, ok, sec: secOk, secN: sec.length, promoted, rank: camp.rank };
  // debrief screen
  show("debrief"); setStage("hub"); sfx.play(ok ? "triumph" : "sad");
  $("dbSys").textContent = `${ms.system} · ${ms.title}`; $("dbRes").textContent = ok ? (perfect ? "Mission successful · all objectives" : "Mission successful") : "Mission failed"; $("dbRes").className = "res " + (ok ? "ok" : "no");
  const row = ([t, v], pts) => `<div><span class="m" style="color:${v ? "var(--green)" : "var(--red)"}">${v ? "✓" : "✗"}</span>${escapeHtml(t)}${pts ? `<span style="float:right;color:${v ? "var(--amber)" : "var(--steel)"}">${v ? "+" + pts : "—"}</span>` : ""}</div>`;
  const nxt = RANK_PTS[camp.rank + 1], prev = RANK_PTS[camp.rank], frac = nxt ? (camp.points - prev) / (nxt - prev) : 1;
  $("dbObj").innerHTML = `<div class="eyebrow" style="margin:0 0 4px">Primary</div>${res.list.map(r => row(r)).join("")}<div style="margin-top:4px">${row(["Primary objectives complete", ok], branch ? PTS.branchPrimary : PTS.primary)}</div>`
    + (sec.length ? `<div class="eyebrow" style="margin:12px 0 4px">Secondary</div>${sec.map(r => row(r, branch ? PTS.branchSecondary : PTS.secondary)).join("")}` : "")
    + `<div style="margin-top:14px;display:flex;justify-content:space-between;font-family:'Share Tech Mono',monospace;color:var(--amber)"><span>${RANKS[camp.rank]}${promoted ? " ▲" : ""}</span><span>+${pPrim + pSec} · ${camp.points} pts</span></div>`
    + `<div style="height:6px;background:rgba(255,255,255,.08);margin-top:6px"><div style="height:6px;width:${Math.round(frac * 100)}%;background:var(--amber)"></div></div>`
    + `<div style="font-size:12px;color:var(--steel);margin-top:4px">${nxt ? `Next: ${RANKS[camp.rank + 1]} at ${nxt} pts` : "Highest rank attained."}</div>`;
  $("dbStat").innerHTML = `<div>Kills<b>${res.stats.kills}</b></div><div>Accuracy<b>${Math.round(acc * 100)}%</b></div><div>Total kills<b>${camp.kills}</b></div>`;
  $("dbNote").textContent = notes.join(" ");
  // next
  let next = ok ? ms.win : ms.lose;
  if (!ok && ms.lose && MISSIONS[ms.lose] && MISSIONS[ms.lose].losing && !ms.losing) camp.resume = ms.win;
  if (ms.id === "l1" && !ok) camp.resume = camp.resume || "m4";
  if (next === "RESUME") next = camp.resume || "m6";
  save();
  $("dbGo").onclick = () => {
    const post = ms.post ? (ok ? ms.post.win : ms.post.lose) : null;
    const after = () => {
      if (next === "END") return; // ending cutscene handled the screen
      if (next === "LOST") return;
      camp.current = next; save(); toHub();
    };
    if (next === "LOST") { camp.current = null; playCine(ms.post.lose, () => { }); return; }
    if (next === "END" && !ok && ms.final) { playCine("cs_ending_fail", () => { }); return; }
    const promo = promoted && next !== "END" && next !== "LOST" ? () => playCine(promotionCine(camp.rank), after) : after;
    if (post) playCine(post, promo); else promo();
  };
}
function judgeSecondary(ms, res, ok) {
  const st = res.stats, flown = res.how !== "kia" && res.how !== "eject";
  return (ms.secondary || []).map(o => {
    let v = false;
    if (o.k === "kills") v = st.kills >= o.n;
    else if (o.k === "killType") v = (st.killsBy[o.type] || 0) >= o.n;
    else if (o.k === "wingAlive") v = flown && (ms.wing || []).every(id => !st.deadIds.has(id));
    else if (o.k === "protectAll") v = (ms.protect || []).every(id => !st.deadIds.has(id)) && ok;
    else if (o.k === "hull") v = flown && st.hullEnd >= o.min;
    else if (o.k === "accuracy") v = st.shots >= 20 && st.hits / st.shots >= o.pct / 100;
    else if (o.k === "time") v = ok && st.time <= o.sec;
    else if (o.k === "noMissiles") v = ok && !st.missiles;
    else if (o.k === "stat") v = !!st[o.key];
    return [o.text, v];
  });
}
function promotionCine(r) {
  const who = camp.done.includes("m7") ? "deacon" : "vesper";
  const lines = r >= 10 ? [["varga", `${camp.name}. Admiral Thorne's orders came through this morning. Effective immediately, you hold the rank of ${RANKS[r]}.`], ["varga", "There are pilots on this ship with twice your hours who will never wear that. Don't make them wrong about you."]]
    : r >= 7 ? [["varga", `Officer's commission came through for you, ${camp.callsign}. ${RANKS[r]}. Congratulations.`], ["varga", "You'll find the Navy expects more of an officer, and forgives less. Welcome to the wardroom."]]
    : [[who, `${camp.callsign}. Paperwork's come through. You're a ${RANKS[r]} now. Sew it on before Rabbit sees you without it.`]];
  return [{ scene: "medal", who: ["varga", who].filter((v, i, a) => a.indexOf(v) === i), dur: 0, caption: `Promoted to ${RANKS[r]}`, lines }];
}
$("kiaRetry").onclick = () => { const ms = C.mission; show(null); for (const s of screens) $(s).hidden = true; startMission(ms, camp, onMissionEnd); };
$("kiaQuit").onclick = () => toTitle();

// ======================================================================= SIMULATOR
let attractAcc = 0;
function paintSimAttract(S, t) {
  attractAcc++; if (attractAcc % 3) return;
  const x = S.canvas.getContext("2d"), W = S.canvas.width, H = S.canvas.height;
  x.fillStyle = "#020a06"; x.fillRect(0, 0, W, H);
  x.strokeStyle = "rgba(125,255,168,.25)"; x.lineWidth = 2; for (let i = 0; i < 9; i++) { const z = ((i / 9 + t * 0.15) % 1); const y = H * 0.55 + z * z * H * 0.45; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  for (let i = -6; i <= 6; i++) { x.beginPath(); x.moveTo(W / 2 + i * 20, H * 0.55); x.lineTo(W / 2 + i * 140, H); x.stroke(); }
  x.fillStyle = "#7dffa8"; x.font = "bold 46px 'Chakra Petch', sans-serif"; x.textAlign = "center"; x.fillText("TRAINSIM", W / 2, 70);
  x.font = "20px 'Share Tech Mono', monospace"; x.fillText(Math.floor(t * 1.5) % 2 ? "PRESS TO FLY" : "", W / 2, 110);
  const ex = W / 2 + Math.sin(t * 0.9) * 150, ey = H * 0.42 + Math.cos(t * 1.3) * 30; x.strokeStyle = "#ff5040"; x.lineWidth = 3; x.beginPath(); x.moveTo(ex - 18, ey); x.lineTo(ex, ey - 10); x.lineTo(ex + 18, ey); x.lineTo(ex, ey + 6); x.closePath(); x.stroke();
  x.strokeStyle = "#7dffa8"; x.beginPath(); x.arc(W / 2, H * 0.45, 24, 0, 7); x.moveTo(W / 2 - 40, H * 0.45); x.lineTo(W / 2 - 28, H * 0.45); x.moveTo(W / 2 + 28, H * 0.45); x.lineTo(W / 2 + 40, H * 0.45); x.stroke();
  x.textAlign = "left"; x.font = "16px 'Share Tech Mono', monospace"; x.fillText(`HI WAVE  ${String(sim.best || 0).padStart(2, "0")}`, 16, H - 14);
  S.tex.needsUpdate = true;
}
const sim = { wave: 0, fromHub: false, ship: null, scen: null, endT: 0 };
const SIM_ENV = { planet: "hyperion", nebula: 1, asteroids: 1 };
// preset practice sorties: same rules as a campaign mission, no story consequences
const SIM_SCEN = [
  { id: "drill", name: "Scramble Drill", diff: "Easy", desc: "Four Skrel light fighters. Learn to lead your shots.", groups: [{ type: "skrel", n: 4 }], obj: "clear" },
  { id: "wolves", name: "Wolf Pack", diff: "Easy", desc: "Three Dhakar medium fighters hunting as a pack.", groups: [{ type: "dhakar", n: 3 }], obj: "clear" },
  { id: "screen", name: "Interceptor Screen", diff: "Medium", desc: "Five Vhaal interceptors. Fast, fragile, relentless.", groups: [{ type: "vhaal", n: 5 }], obj: "clear" },
  { id: "heavy", name: "Heavy Metal", diff: "Medium", desc: "Three Krosk heavy fighters with a Dhakar wing. Bring missiles.", groups: [{ type: "krosk", n: 3 }, { type: "dhakar", n: 1 }], obj: "clear" },
  { id: "convoy", name: "Convoy Defense", diff: "Medium", desc: "Two haulers under bomber attack. At least one must survive.", groups: [{ type: "gorrak", n: 3, target: "escort" }, { type: "skrel", n: 3 }], obj: "protect", escort: true },
  { id: "corvette", name: "Corvette Strike", diff: "Hard", desc: "Kill a Ral'thak-class corvette through its fighter cover.", groups: [{ type: "ralthak", n: 1, id: "simcap", pos: [0, 0, -2600] }, { type: "dhakar", n: 2 }, { type: "skrel", n: 2 }], obj: "destroy", target: "simcap" },
  { id: "graven", name: "The Graven's Ghost", diff: "Hard", desc: "A recorded duel against Sh'kara the Graven and two wingmates.", groups: [{ type: "vhaal", n: 1, ace: "shkara", id: "simace", target: "player", pos: [0, 0, -2200] }, { type: "vhaal", n: 2 }], obj: "duel", target: "simace" },
  { id: "destroyer", name: "Destroyer Assault", diff: "Very hard", desc: "A Ka'ven destroyer with heavy cover. Torpedoes advised.", groups: [{ type: "kaven", n: 1, id: "simcap", pos: [0, 0, -3200] }, { type: "krosk", n: 2 }, { type: "vhaal", n: 2 }], obj: "destroy", target: "simcap" },
];
const CUSTOM_TYPES = [["skrel", 8], ["dhakar", 8], ["vhaal", 8], ["krosk", 6], ["gorrak", 6], ["ralthak", 1], ["kaven", 1]];
const custom = { skrel: 2, dhakar: 2, vhaal: 0, krosk: 0, gorrak: 0, ralthak: 0, kaven: 0, wing: true };
function simPanel(title, sub, html) {
  show("debrief"); $("dbSys").textContent = "TRAINSIM 3 · Vigil Squadron"; $("dbRes").textContent = title; $("dbRes").className = "res ok";
  $("dbObj").innerHTML = html; $("dbStat").innerHTML = ""; $("dbNote").textContent = sub || "";
}
function simBack(fn) { $("dbGo").textContent = "Back"; $("dbGo").dataset.back = 1; $("dbGo").onclick = () => { $("dbGo").textContent = "Continue"; delete $("dbGo").dataset.back; fn(); }; }
function simExit() { if (sim.keep) { camp = sim.keep; sim.keep = null; } if (sim.fromHub) { show(null); toHub(); } else toTitle(); }
function simMenu(fromHub = false) {
  if (fromHub !== null) sim.fromHub = fromHub;
  if (!sim.fromHub && !camp) { const s_ = load(); if (s_) camp = s_; }
  const avail = unlockedShips(camp);
  setStage("showroom", sim.ship && avail.includes(sim.ship) ? sim.ship : avail[avail.length - 1]);
  simPanel("Choose your spacecraft", "Practice only. Nothing flown in the simulator counts toward the campaign.", `<p style="margin:0;color:var(--steel)">Every airframe the Navy has issued you is loaded into the simulator. New ships appear here as you earn them.</p>`);
  const row = document.createElement("div"); row.className = "ships";
  SHIP_ORDER.forEach(t => { const ok = avail.includes(t), b = document.createElement("button"); b.className = "btn"; b.disabled = !ok; if (!ok) b.style.opacity = 0.35;
    b.innerHTML = ok ? `${SHIPS[t].name}<small>${SHIPS[t].cls}</small>` : `Classified<small>Not yet issued</small>`; if (ok) { b.onclick = () => { sim.ship = t; simModes(); }; b.onmouseenter = b.onfocus = () => setStage("showroom", t); } row.appendChild(b); });
  $("dbObj").appendChild(row);
  simBack(simExit); focusFirst();
}
function simModes() {
  const rec = (sim.keep || camp)?.simRecords || {};
  simPanel("Choose a sortie", `Flying the ${SHIPS[sim.ship].name}. Practice only: nothing here counts toward the campaign.`, "");
  const grid = document.createElement("div"); grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin-top:6px;max-height:52vh;overflow-y:auto";
  for (const sc of SIM_SCEN) { const r = rec[sc.id], b = document.createElement("button"); b.className = "btn";
    b.style.cssText = "text-align:left;min-height:96px"; b.innerHTML = `${sc.name}<small>${sc.diff}${r && r.won ? ` · ✓ best ${fmtTime(r.time)}` : ""}</small><small style="opacity:.7;text-transform:none;letter-spacing:0;line-height:1.35;margin-top:4px">${sc.desc}</small>`; b.onclick = () => startSim({ ...sc }); grid.appendChild(b); }
  const cb = document.createElement("button"); cb.className = "btn"; cb.style.cssText = "text-align:left;min-height:96px"; cb.innerHTML = `Custom battle<small>Pick the opposition</small>`; cb.onclick = () => simCustom(); grid.appendChild(cb);
  const eb = document.createElement("button"); eb.className = "btn"; eb.style.cssText = "text-align:left;min-height:96px"; eb.innerHTML = `Endless waves<small>Best: wave ${rec.waves || sim.best || 0}</small>`; eb.onclick = () => startSim({ id: "waves", name: "Endless Waves" }); grid.appendChild(eb);
  $("dbObj").appendChild(grid); simBack(() => simMenu(null)); focusFirst();
}
function simCustom() {
  simPanel("Custom battle", "Build the opposition, then launch.", "");
  const box = document.createElement("div"); box.style.display = "grid"; box.style.gap = "6px";
  const render = () => { box.innerHTML = "";
    for (const [t, max] of CUSTOM_TYPES) { const r = document.createElement("div"); r.style.cssText = "display:flex;align-items:center;gap:10px";
      const minus = document.createElement("button"), plus = document.createElement("button"); minus.className = plus.className = "btn"; minus.textContent = "–"; plus.textContent = "+"; minus.style.cssText = plus.style.cssText = "width:44px;padding:6px 0";
      minus.onclick = () => { custom[t] = Math.max(0, custom[t] - 1); render(); minus.focus(); }; plus.onclick = () => { custom[t] = Math.min(max, custom[t] + 1); render(); }; 
      const lab = document.createElement("div"); lab.style.cssText = "flex:1"; lab.innerHTML = `<b>${SHIPS[t].name}</b> <span style="color:var(--steel);font-size:12px">${SHIPS[t].cls}</span>`;
      const n = document.createElement("div"); n.style.cssText = "width:28px;text-align:center;font-family:'Share Tech Mono',monospace;color:var(--amber)"; n.textContent = custom[t];
      r.append(lab, minus, n, plus); box.appendChild(r); }
    const w = document.createElement("button"); w.className = "btn"; w.textContent = custom.wing ? "Wingman: Frost" : "Wingman: none"; w.onclick = () => { custom.wing = !custom.wing; render(); }; box.appendChild(w);
    const total = CUSTOM_TYPES.reduce((s, [t]) => s + custom[t], 0);
    const go = document.createElement("button"); go.className = "btn primary"; go.disabled = !total; go.textContent = total ? `Launch · ${total} hostile${total > 1 ? "s" : ""}` : "Add at least one hostile";
    go.onclick = () => { const groups = CUSTOM_TYPES.filter(([t]) => custom[t]).map(([t]) => ({ type: t, n: custom[t], ...(t === "ralthak" || t === "kaven" ? { pos: [Math.random() * 1600 - 800, 0, -3000] } : {}) })); startSim({ id: "custom", name: "Custom Battle", groups, obj: "clear", wing: custom.wing }); };
    box.appendChild(go); };
  render(); $("dbObj").appendChild(box); simBack(simModes); focusFirst();
}
function fmtTime(s) { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function startSim(sc) {
  $("dbGo").textContent = "Continue"; delete $("dbGo").dataset.back;
  if (!camp) camp = newCamp("Trainee", "Trainee", 1);
  sim.scen = sc; sim.endT = 0; sim.wave = 1;
  const wing = sc.wing === false ? [] : ["frost"];
  const nav = { name: sc.name, env: SIM_ENV, obj: sc.obj === "destroy" || sc.obj === "duel" ? sc.obj : "clear", target: sc.target, groups: sc.groups || [{ type: "skrel", n: 2 }, { type: "dhakar", n: 1 }],
    events: [{ at: "arrive", say: [[wing[0] || "comms", sc.id === "waves" ? "Simulator online. Wave one inbound." : `Simulation running. ${sc.name}. Weapons free.`]] }] };
  const ms = { id: sc.id === "waves" ? "sim" : "simx", simScen: sc, title: `Sim · ${sc.name}`, system: "TRAINSIM 3", ship: sim.ship || "kestrel", wing, objectives: [sc.desc || "Survive the waves. Pause and abort to finish."], defend: true, navs: [nav] };
  if (sc.escort) { ms.escort = [{ type: "transport", id: "simh1", name: "Hauler One" }, { type: "transport", id: "simh2", name: "Hauler Two" }]; ms.protect = ["simh1", "simh2"]; ms.protectMin = 1; }
  for (const s of screens) $(s).hidden = true;
  if (!sim.keep) sim.keep = camp; camp = { ...sim.keep };
  C.opts.difficulty = { Easy: 0.6, Medium: 1, Hard: 1.4 }[sc.diff] ?? (camp.diff || 1);   // the scenario's label sets how good the enemy pilots are
  startMission(ms, camp, onMissionEnd);
}
// scenario sorties end themselves once the objective is decided
function simScenTick(dt) {
  const ms = C.mission, sc = ms.simScen; if (C.navT < 4) return;
  const hostiles = C.ents.some(e => e.alive && e.team === "vharr" && !e.comp);
  const tgtDead = sc.target ? C.stats.deadIds.has(sc.target) : !hostiles;
  const escortsLost = ms.protect && ms.protect.every(id => C.stats.deadIds.has(id));
  if ((tgtDead && (sc.obj !== "protect" || !hostiles)) || escortsLost) { if (!sim.endT) C.msgs.push({ t: 3, text: escortsLost ? "SIMULATION FAILED" : "SIMULATION COMPLETE" }); sim.endT += dt; if (sim.endT > 2.5) { if (C.stats.navs[0]) C.stats.navs[0].cleared = !escortsLost; finishMission(escortsLost ? "abort" : "final"); } }
}
function simResults(res) {
  const sc = sim.scen || { id: "waves", name: "Endless Waves" }, real = sim.keep || camp;
  real.simRecords = real.simRecords || {};
  const won = sc.id === "waves" ? true : res.how === "final";
  const acc = res.stats.shots ? Math.round(100 * res.stats.hits / res.stats.shots) : 0;
  let rec = "";
  if (sc.id === "waves") { sim.best = Math.max(sim.best || 0, sim.wave); if (sim.wave > (real.simRecords.waves || 0)) { real.simRecords.waves = sim.wave; rec = "New best wave!"; } }
  else if (won && sc.id !== "custom") { const r = real.simRecords[sc.id]; if (!r || !r.won || res.stats.time < r.time) { real.simRecords[sc.id] = { won: true, time: res.stats.time, kills: res.stats.kills }; rec = "New best time!"; } }
  if (sim.keep) { camp = sim.keep; sim.keep = null; } save();
  simPanel(sc.id === "waves" ? `Reached wave ${sim.wave}` : won ? "Simulation complete" : "Simulation failed", rec, "");
  $("dbStat").innerHTML = `<div>Kills<b>${res.stats.kills}</b></div><div>Accuracy<b>${acc}%</b></div><div>Time<b>${fmtTime(res.stats.time)}</b></div>`;
  const row = document.createElement("div"); row.className = "ships";
  const again = document.createElement("button"); again.className = "btn"; again.innerHTML = "Fly again<small>Same sortie</small>"; again.onclick = () => startSim(sc);
  const other = document.createElement("button"); other.className = "btn"; other.innerHTML = "Another sortie<small>Back to the list</small>"; other.onclick = () => simModes();
  row.append(again, other); $("dbObj").appendChild(row);
  $("dbGo").textContent = "Leave the simulator"; $("dbGo").onclick = () => { $("dbGo").textContent = "Continue"; simExit(); };
  setStage("showroom", sim.ship || "kestrel"); focusFirst();
}
function simTick() {
  if (C.navT < 4) return;
  const any = C.ents.some(e => e.alive && e.team === "vharr" && !e.comp);
  if (!any) {
    sim.wave++; C.msgs.push({ t: 3, text: `WAVE ${sim.wave}` });
    const pool = ["skrel", "dhakar", "krosk", "vhaal", "gorrak"];
    const n = Math.min(7, 1 + Math.floor(sim.wave * 0.8));
    for (let i = 0; i < n; i++) spawnGroup({ type: pool[Math.min(pool.length - 1, Math.floor(Math.random() * (1 + sim.wave / 2)))], n: 1 });
    if (sim.wave % 4 === 0) spawnGroup({ type: "vhaal", n: 1, ace: "shkara", target: "player" });
    if (sim.wave % 5 === 0) spawnGroup({ type: "ralthak", n: 1, pos: [800, 0, -3000] });
    // reload
    const p = C.player; p.sh = [...p.shMax]; for (const k of Object.keys(SHIPS[p.type].missiles)) p.mis[k] = Math.max(p.mis[k] || 0, Math.ceil(SHIPS[p.type].missiles[k] / 2)); p.decoys = Math.max(p.decoys, 4);
  }
}

// ======================================================================= BOOT
loadOpts();
preloadPortraits();
init($("stage"));
setStage("title");
C.state = "menu";
$("foot").textContent = "";
window.__HW = { debugNav, revealCine, unlockedShips, simMenu, simModes, simCustom, startSim, SIM_SCEN, C, kill, damage, MISSIONS, get stage() { return stage; }, startMission, playCine, setStage, get camp() { return camp; }, set camp(v) { camp = v; }, onMissionEnd, toHub, toBriefing, launch };
