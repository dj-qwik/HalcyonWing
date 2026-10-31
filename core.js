// HALCYON WING — flight engine: rendering, ships, weapons, AI, missions, cockpit HUD, input, audio.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SHIPS, GUNS, MISSILES, CAST } from "./story.js";
import * as M from "./models.js";
import { drawPortrait } from "./portraits.js";
import * as CK from "./cockpits.js";

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const K = 0.5;               // world units per second per KPS
const DEG = Math.PI / 180;
const tv = () => new V3();
const _a = new V3(), _b = new V3(), _c = new V3(), _q = new Q();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

export const C = {
  state: "menu", t: 0, paused: false, opts: { invert: false, mouseInvert: false, voice: true, music: 0.5, sfx: 0.8, difficulty: 1, sens: 1,
    quality: "high", fov: 72, bright: 1, bloom: 1, shake: 1, fps: false, master: 1, voiceVol: 1, deadzone: 0.14, vibration: true, hud: 1 },
  ents: [], bolts: [], missiles: [], decoys: [], parts: [], comms: [], msgs: [],
  player: null, target: null, mission: null, navIdx: 0, navT: 0,
  hooks: {},
};

// ======================================================================= RENDERER
export function init(container) {
  const r = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
  // if the GPU driver drops the 3D context, say so, step quality down and restart, instead of leaving a dead white canvas
  r.domElement.addEventListener("webglcontextlost", e => { e.preventDefault(); onGpuLost(); }, false);
  r.domElement.addEventListener("webglcontextrestored", () => location.reload(), false);
  // first run on an integrated or mobile GPU: start at Medium so it isn't overcommitted
  try { const saved = JSON.parse(localStorage.getItem("halcyonwing.opts") || "{}"); const gl = r.getContext(), d = gl.getExtension("WEBGL_debug_renderer_info"); C.gpuName = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "";
    if (!saved.quality && /Intel|UHD|Iris|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d+ Graphics|Mali|Adreno|PowerVR|SwiftShader/i.test(C.gpuName)) C.opts.quality = "medium"; } catch (e) { }
  r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  r.setSize(window.innerWidth, window.innerHeight);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(r.domElement);
  C.renderer = r;
  M.initTextures(r);
  C.scene = new THREE.Scene();
  C.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 300000);
  C.camera.layers.enable(1);
  C.scene.add(C.camera);
  C.vduCam = new THREE.PerspectiveCamera(30, 1.4, 0.5, 300000);
  // post chain renders into a multisampled target so every edge stays clean (MSAA set by the quality preset)
  C.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
  C.composer.addPass(new RenderPass(C.scene, C.camera));
  C.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.85, 0.45, 0.9);
  C.composer.addPass(C.bloom);
  C.composer.addPass(new OutputPass());
  // lights (fixed count, never changes → no shader recompiles)
  C.sun = new THREE.DirectionalLight(0xfff2e0, 3.2); C.sun.position.set(-1, 0.6, 0.4); C.scene.add(C.sun);
  C.fill = new THREE.HemisphereLight(0x8aa8d8, 0x2a2018, 0.95); C.scene.add(C.fill);
  C.plights = []; for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa040, 0, 400, 2); C.scene.add(l); C.plights.push({ l, life: 0 }); }
  // cockpit
  C.vduRT = new THREE.WebGLRenderTarget(512, 368); C.cockpits = {}; setCockpit("kestrel");
  // world root (cleared between navs)
  C.world = new THREE.Group(); C.scene.add(C.world);
  // live sky layers that follow the camera: pin-sharp stars, and the sun with corona and lens flare
  M.setSun(C.sun); C.stars = M.makeStarfield(5); C.scene.add(C.stars); C.sunFx = M.makeSun(); C.scene.add(C.sunFx);
  // particles
  initParticles(); initBolts(); initDust();
  applyQuality(true);
  // HUD canvas
  C.hud = document.createElement("canvas"); C.hud.id = "hud"; container.appendChild(C.hud);
  C.hx = C.hud.getContext("2d");
  window.addEventListener("resize", resize); resize();
  initInput(r.domElement);
  setEnv({ hue: 0.6 });
  r.setAnimationLoop(loop);
}
// ======================================================================= QUALITY
export const QUALITY = {
  low: { label: "Low", pr: 0.75, msaa: 0, bake: 1024, sky: 2048, stars: 0.6 },
  medium: { label: "Medium", pr: 1, msaa: 2, bake: 2048, sky: 2048, stars: 1 },
  high: { label: "High", pr: 1.5, msaa: 4, bake: 2048, sky: 4096, stars: 1 },
  ultra: { label: "Ultra", pr: 2, msaa: 8, bake: 4096, sky: 4096, stars: 1 },
};
function onGpuLost() {
  if (C.gpuLost) return; C.gpuLost = true;
  const order = ["ultra", "high", "medium", "low"], i = order.indexOf(C.opts.quality || "high");
  if (i >= 0 && i < order.length - 1) C.opts.quality = order[i + 1];
  let n = 1; try { const k = "halcyonwing.gpuresets", now = Date.now(); const h = JSON.parse(sessionStorage.getItem(k) || "[]").filter(t => now - t < 120000); h.push(now); sessionStorage.setItem(k, JSON.stringify(h)); n = h.length; } catch (e) { }
  try { const o = JSON.parse(localStorage.getItem("halcyonwing.opts") || "{}"); o.quality = C.opts.quality; localStorage.setItem("halcyonwing.opts", JSON.stringify(o)); } catch (e) { }
  const auto = n <= 2;   // don't loop: after two resets in two minutes, wait for the player
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#06080b;color:#ece4d2;font:16px/1.5 'Barlow Semi Condensed',sans-serif;text-align:center;padding:24px";
  el.innerHTML = `<div style="font:700 22px 'Chakra Petch',sans-serif;letter-spacing:.14em;color:#ffb440">GRAPHICS RESET</div>
    <div style="max-width:48ch;opacity:.85">Your graphics driver stopped the game's 3D view, usually because the GPU ran short of memory. Graphics quality is now <b>${QUALITY[C.opts.quality].label}</b>. ${auto ? "Restarting…" : "You can lower it further under Options → Video."} Your campaign is saved at each mission.</div>
    <button style="font:600 15px 'Chakra Petch',sans-serif;letter-spacing:.1em;padding:10px 22px;background:#ffb440;color:#120c04;border:0;cursor:pointer">RESTART NOW</button>`;
  el.querySelector("button").onclick = () => location.reload(); document.body.appendChild(el);
  if (auto) setTimeout(() => location.reload(), 2500);
}
export function applyQuality(first) {
  const q = QUALITY[C.opts.quality] || QUALITY.high, r = C.renderer; if (!r) return;
  const dpr = window.devicePixelRatio || 1;
  r.setPixelRatio(q.pr < 1 ? Math.min(dpr, 1) * q.pr : Math.min(dpr, q.pr));
  const maxS = r.capabilities.maxSamples || 4, n = Math.min(q.msaa, maxS);
  for (const rt of [C.composer.renderTarget1, C.composer.renderTarget2]) if (rt.samples !== n) { rt.samples = n; rt.dispose(); }
  r.toneMappingExposure = 1.05 * (C.opts.bright || 1);
  M.setBakeSize(q.bake); C.skyRes = q.sky;
  if (!first) { resize(); if (C.skyCache) { for (const [k, v] of [...C.skyCache]) if (v.bg !== C.scene.background) { v.env.dispose(); v.rt.dispose(); C.skyCache.delete(k); } } }
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  C.renderer.setSize(w, h); C.composer.setSize(w, h); C.camera.aspect = w / h; C.camera.updateProjectionMatrix();
  const dpr = Math.min(window.devicePixelRatio, 2); C.hud.width = w * dpr; C.hud.height = h * dpr; C.hud.style.width = w + "px"; C.hud.style.height = h + "px"; C.hx.setTransform(dpr, 0, 0, dpr, 0, 0);
  C.W = w; C.H = h; computeScreens();
}
function computeScreens() { return;
  const hw = Math.tan(C.camera.fov * DEG / 2) * 1.2 * C.camera.aspect;
  const scr = C.cockpit.userData.screens; const sx = Math.max(0.55, Math.min(0.98, hw - 0.36)); scr[0].position.x = -sx; scr[1].position.x = sx;
  C.cockpit.updateMatrixWorld(true);
  const proj = (v) => { const p = v.clone().applyMatrix4(C.camera.projectionMatrix); return { x: (p.x * 0.5 + 0.5) * C.W, y: (-p.y * 0.5 + 0.5) * C.H }; };
  C.screens = C.cockpit.userData.screens.map((m, i) => {
    if (i < 2) {
      const pts = [[-0.31, -0.21], [0.31, -0.21], [-0.31, 0.21], [0.31, 0.21]].map(([x, y]) => proj(new V3(x, y, 0).applyMatrix4(m.matrix)));
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    const c = proj(m.position.clone()), e = proj(m.position.clone().add(new V3(0.2, 0, 0)));
    return { x: c.x, y: c.y, r: Math.abs(e.x - c.x) };
  });
}

// ======================================================================= ENVIRONMENT
const HUES = { calder: 0.58, thessaly: 0.08, hale: 0.75, corinthBurn: 0.03, tessaly: 0.55, varenne: 0.04, ashkar: 0.1, deadmoon: 0.66, hyperion: 0.45, kethra: 0.02, kethraClose: 0.02 };
export function setEnv(env) {
  const hue = env.hue ?? HUES[env.planet] ?? 0.6;
  const seed = env.seed || (hue * 97 | 0) + 1, neb = env.nebula ? 1 : 0;
  const key = `${hue}|${neb}|${seed}`;
  C.skyCache = C.skyCache || new Map();
  let sk = C.skyCache.get(key);
  if (!sk) {
    // bake the procedural sky once into a single seamless equirectangular texture; frames then only sample it
    const W = C.skyRes || 4096, r = C.renderer;
    const rt = new THREE.WebGLRenderTarget(W, W / 2, { type: THREE.UnsignedByteType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping });
    const mat = M.makeSky({ hue, nebula: env.nebula, seed, warm: env.warm || 0, bake: true });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), bs = new THREE.Scene(); bs.add(q);
    const pTM = r.toneMapping, pRT = r.getRenderTarget(); r.toneMapping = THREE.NoToneMapping; r.setRenderTarget(rt); r.render(bs, new THREE.Camera()); r.setRenderTarget(pRT); r.toneMapping = pTM;
    mat.dispose(); q.geometry.dispose();
    rt.texture.mapping = THREE.EquirectangularReflectionMapping; rt.texture.colorSpace = THREE.LinearSRGBColorSpace; rt.texture.wrapS = THREE.RepeatWrapping;
    // image-based light: the sky plus a soft key patch overhead
    const s = new THREE.Scene(); const sph = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), new THREE.MeshBasicMaterial({ map: rt.texture, side: THREE.BackSide })); s.add(sph);
    const lite = new THREE.Mesh(new THREE.SphereGeometry(40, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide })); lite.scale.set(1, 0.2, 1); lite.position.y = 300; s.add(lite);
    const pm = new THREE.PMREMGenerator(r);
    const envT = pm.fromScene(s, 0.04).texture; pm.dispose(); sph.geometry.dispose(); sph.material.dispose(); lite.geometry.dispose();
    sk = { bg: rt.texture, env: envT, rt };
    if (C.skyCache.size > 3) { const [k0, v0] = C.skyCache.entries().next().value; if (v0.bg !== C.scene.background) { v0.env.dispose(); v0.rt.dispose(); C.skyCache.delete(k0); } }
    C.skyCache.set(key, sk);
  }
  C.scene.background = sk.bg; C.skyTex = sk.bg;
  C.scene.environment = sk.env; C.envTex = sk.env;
  C.sun.color.setHSL((hue + 0.5) % 1, 0.25, 0.75);
}

export function buildNavEnv(env) {
  const R = M.rng((C.navIdx + 3) * 77 + (C.mission ? C.mission.id.length : 0));
  setEnv(env);
  if (env.planet) {
    const p = M.makePlanet(env.planet, 7);
    const close = env.planet === "kethraClose";
    const rad = close ? 52000 : 26000; p.scale.setScalar(rad);
    const dir = new V3(env.pdir?.[0] ?? (R() - 0.5) * 1.4, env.pdir?.[1] ?? -0.55 - R() * 0.3, env.pdir?.[2] ?? -1).normalize();
    p.position.copy(dir.multiplyScalar(close ? 70000 : 82000));
    p.rotation.set(R() * 3, R() * 3, 0.3);
    C.world.add(p); C.planet = p;
    C.sun.position.copy(p.position).normalize().multiplyScalar(-1).add(new V3(0.6, 0.9, 0)).normalize();
  } else C.planet = null;
  C.rocks = [];
  if (env.asteroids) {
    const mat = M.asteroidMaterial(); const geos = [0, 1, 2].map(i => M.makeAsteroidGeo(i * 31 + 5));
    for (let k = 0; k < 3; k++) {
      const n = 60, im = new THREE.InstancedMesh(geos[k], mat, n); const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const s = Math.pow(R(), 3) * 140 + 6; const p = new V3((R() - 0.5) * 9000, (R() - 0.5) * 3000, (R() - 0.5) * 9000 - 1500);
        if (p.length() < 300) p.setLength(400);
        m4.compose(p, new Q().setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6)), new V3(s, s * (0.7 + R() * 0.5), s));
        im.setMatrixAt(i, m4); C.rocks.push({ p, r: s * 0.85 });
      }
      C.world.add(im);
    }
  }
  if (env.debris) {
    const g = new THREE.BoxGeometry(1, 1, 1); const mat = new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.8, metalness: 0.6, map: M.tex().concord1.map });
    const n = 160, im = new THREE.InstancedMesh(g, mat, n); const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const p = new V3((R() - 0.5) * 5000, (R() - 0.5) * 2000, (R() - 0.5) * 5000 - 1000); m4.compose(p, new Q().setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6)), new V3(2 + R() * 30, 1 + R() * 6, 2 + R() * 40)); im.setMatrixAt(i, m4); }
    C.world.add(im);
  }
  if (env.jump) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(260, 6, 8, 64), new THREE.MeshBasicMaterial({ color: 0x80d0ff }));
    ring.position.set(0, 0, -2600); C.world.add(ring);
    const sw = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.tex().glow, color: 0x4080ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    sw.scale.setScalar(700); sw.position.copy(ring.position); C.world.add(sw); C.jumpRing = ring;
  } else C.jumpRing = null;
}

// ======================================================================= PARTICLES / BOLTS / DUST
function initParticles() {
  C.pool = [];
  for (let i = 0; i < 900; i++) {
    const m = new THREE.SpriteMaterial({ map: M.tex().puff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const s = new THREE.Sprite(m); s.visible = false; C.scene.add(s); C.pool.push({ s, life: 0, max: 1, v: new V3(), s0: 1, s1: 2, c0: new THREE.Color(), c1: new THREE.Color(), a: 1 });
  }
  C.pi = 0;
}
function spawnPart(pos, vel, life, s0, s1, c0, c1, a = 1, glow = false) {
  const p = C.pool[C.pi = (C.pi + 1) % C.pool.length];
  p.s.visible = true; p.s.position.copy(pos); p.v.copy(vel); p.life = p.max = life; p.s0 = s0; p.s1 = s1; p.c0.set(c0); p.c1.set(c1); p.a = a;
  p.s.material.map = glow ? M.tex().glow : M.tex().puff; p.s.material.blending = THREE.AdditiveBlending; p.s.material.rotation = Math.random() * 6;
  return p;
}
export function updParticles(dt) {
  for (const p of C.pool) {
    if (p.life <= 0) continue;
    p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
    const k = 1 - p.life / p.max; p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 0.6);
    p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * k); p.s.material.color.copy(p.c0).lerp(p.c1, k); p.s.material.opacity = p.a * (1 - k * k);
  }
  for (const L of C.plights) if (L.life > 0) { L.life -= dt; L.l.intensity = Math.max(0, L.life) * L.k; }
}
export function explode(pos, size = 10, color = 0xffa040, vel) {
  const v0 = vel || tv();
  spawnPart(pos, v0, 0.25, size * 2, size * 7, 0xffffff, color, 1, true);
  const n = Math.min(26, 8 + size);
  for (let i = 0; i < n; i++) {
    const d = new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.2, 1) * size * 3.5);
    spawnPart(_a.copy(pos).addScaledVector(d, 0.2), d.add(v0), rand(0.6, 1.4), size * 0.6, size * rand(1.5, 3), 0xffd080, 0x401008, 0.9);
  }
  for (let i = 0; i < 10; i++) { const d = new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(size * rand(8, 16)); spawnPart(pos, d.add(v0), rand(0.4, 0.9), size * 0.2, size * 0.05, 0xfff0c0, 0xff6010, 1, true); }
  const L = C.plights.reduce((a, b) => (a.life < b.life ? a : b)); L.l.position.copy(pos); L.l.color.set(color); L.k = Math.min(60, size * 5); L.life = 0.6; L.l.distance = size * 60;
  sfx.boom(size, pos);
}
function initBolts() {
  C.boltGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 6); C.boltGeo.rotateX(Math.PI / 2);
  C.boltPool = [];
  for (let i = 0; i < 500; i++) { const m = new THREE.Mesh(C.boltGeo, new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; m.layers.set(0); C.scene.add(m); C.boltPool.push({ m, life: 0, pos: m.position, vel: new V3() }); }
  C.bi = 0;
}
export function fireBolt(owner, origin, dir, gun, inherit) {
  const b = C.boltPool[C.bi = (C.bi + 1) % C.boltPool.length];
  const g = GUNS[gun];
  b.life = g.range / (g.speed * K); b.owner = owner; b.team = owner.team; b.dmg = g.dmg; b.gun = g;
  b.vel.copy(dir).multiplyScalar(g.speed * K); if (inherit) b.vel.add(inherit);
  b.pos.copy(origin); b.m.visible = true; b.m.material.color.setHex(g.color).multiplyScalar(2.2);
  const len = 6 * g.size + 4; b.m.scale.set(g.size * 1.6, g.size * 1.6, len);
  b.m.quaternion.setFromUnitVectors(new V3(0, 0, 1), dir);
  return b;
}
function initDust() {
  const n = 700, pos = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) pos[i] = rand(-300, 300);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  C.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9ab0c8, size: 0.6, transparent: true, opacity: 0.55, depthWrite: false }));
  C.dust.frustumCulled = false; C.dust.visible = false; C.scene.add(C.dust);
}
function updDust() {
  if (!C.dust.visible) return;
  const p = C.dust.geometry.attributes.position, cp = C.camera.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (x - cp.x > 300) x -= 600; else if (x - cp.x < -300) x += 600;
    if (y - cp.y > 300) y -= 600; else if (y - cp.y < -300) y += 600;
    if (z - cp.z > 300) z -= 600; else if (z - cp.z < -300) z += 600;
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true;
}

// ======================================================================= AUDIO
export const sfx = (() => {
  let ctx, master, music, fxBus, engine, engGain, engFilt, noiseBuf;
  const init = () => {
    if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = C.opts.master ?? 1; master.connect(ctx.destination);
    fxBus = ctx.createGain(); fxBus.gain.value = C.opts.sfx; fxBus.connect(master);
    music = ctx.createGain(); music.gain.value = C.opts.music * 0.9; music.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    engine = ctx.createOscillator(); engine.type = "sawtooth"; engine.frequency.value = 50;
    engFilt = ctx.createBiquadFilter(); engFilt.type = "lowpass"; engFilt.frequency.value = 300;
    engGain = ctx.createGain(); engGain.gain.value = 0; engine.connect(engFilt); engFilt.connect(engGain); engGain.connect(fxBus); engine.start();
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 400; nf.Q.value = 0.6; n.connect(nf); nf.connect(engGain); n.start();
    loadSamples();
  };
  // ---------- recorded samples (assets/sfx, credits in assets/sfx/CREDITS.txt); synth above is the fallback
  const SNAMES = ["g_laser_a", "g_laser_b", "g_laser_c", "g_blaster", "g_mass_a", "g_mass_b", "g_neutron_a", "g_neutron_b", "g_particle", "g_tachyon", "g_scourge", "g_flak", "g_turbo", "g_plasma",
    "x_small_a", "x_small_b", "x_small_c", "x_sub", "x_sub_big", "x_big", "x_far", "x_punch", "h_shield_0", "h_shield_1", "h_shield_2", "h_hull_0", "h_hull_1", "h_hull_2",
    "m_launch", "m_torp", "f_flyby_0", "f_flyby_1", "f_flyby_2", "f_flyby_3", "w_autopilot", "w_launch", "w_cloak", "w_decloak", "l_eng_low", "l_eng_mid", "l_ab", "l_cockpit",
    "u_lock", "u_seek", "u_nolock", "u_unavail", "u_warn", "u_comms", "u_gunmode", "u_missel", "u_target", "u_open", "u_close", "u_decoy", "u_powerup", "u_focus", "u_click", "u_klaxon", "u_slam", "u_bell"];
  const BUF = {}; let beds = null, live = 0;
  const loadSamples = () => {
    for (const n of SNAMES) fetch(`assets/sfx/${n}.${n.startsWith("l_") ? "wav" : "mp3"}`).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(a => ctx.decodeAudioData(a)).then(b => { BUF[n] = b; if (n.startsWith("l_")) startBeds(); }).catch(() => {});
  };
  const startBeds = () => {
    if (beds || !["l_eng_low", "l_eng_mid", "l_ab", "l_cockpit"].every(k => BUF[k])) return;
    beds = {};
    for (const k of ["l_eng_low", "l_eng_mid", "l_ab", "l_cockpit"]) { const src = ctx.createBufferSource(); src.buffer = BUF[k]; src.loop = true; const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(fxBus); src.start(ctx.currentTime + Math.random() * 0.1); beds[k] = { src, g }; }
    engGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  };
  // where a world position sits for the listener: loudness, stereo pan, and air-less "muffle" for distant sources
  const _lp = new THREE.Vector3();
  const spatial = (pos, range = 2600) => {
    if (!pos || !C.camera) return { v: 1, pan: 0, lp: 20000 };
    const d = pos.distanceTo(C.camera.position); _lp.copy(pos).applyMatrix4(C.camera.matrixWorldInverse);
    return { v: clamp(1 - d / range, 0, 1) ** 1.4, pan: clamp(_lp.x / Math.max(80, _lp.length()), -1, 1) * 0.85, lp: 900 + 19000 * clamp(1 - d / (range * 0.8), 0, 1) ** 2.2 };
  };
  const ps = (name, v, o = {}) => {
    const b = BUF[name]; if (!b || v < 0.004) return null;
    if (live > 40 && !o.force) return null;
    const t = ctx.currentTime + (o.delay || 0), src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() - 0.5) * (o.jit ?? 0.08));
    let node = src; if (o.lp && o.lp < 18000) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; node.connect(f); node = f; }
    const g = ctx.createGain(); g.gain.value = v; node.connect(g); let out = g;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; }
    out.connect(fxBus); live++; src.onended = () => live--; src.start(t); return src;
  };
  const any = l => l[(Math.random() * l.length) | 0];
  const MUSIC = { title: ["m_title_clouds"], hub: ["m_hub_stillness", "m_hub_soliloquy"], brief: ["m_brief_colony", "m_brief_liftoff", "m_brief_war"],
    combat: ["m_combat_battle", "m_combat_asteroids", "m_combat_pursuit", "m_combat_themea", "m_combat_tropic"], tense: ["m_tense_emergency", "m_tense_descent"],
    sad: ["m_sad_lament", "m_sad_leap", "m_sad_brother"], triumph: ["m_win_precipice", "m_win_cantstop"], cruise: ["m_hub_stillness", "m_brief_liftoff", "m_brief_colony"] };
  const GUN_S = { laser: [["g_laser_a", "g_laser_b", "g_laser_c"], 0.42], mass: [["g_mass_a", "g_mass_b"], 0.4], neutron: [["g_neutron_a", "g_neutron_b"], 0.42], particle: [["g_particle"], 0.4], tachyon: [["g_tachyon"], 0.32],
    rend: [["g_blaster"], 0.4], scourge: [["g_scourge"], 0.42], flak: [["g_flak"], 0.45], capLaser: [["g_turbo"], 0.75], capPlasma: [["g_plasma"], 0.8] };
  let boomBudget = 0, boomT = 0;
  const env = (node, g0, t0, dur) => { const g = ctx.createGain(); g.gain.setValueAtTime(g0, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); node.connect(g); g.connect(fxBus); return g; };
  const vol = pos => { if (!pos || !C.camera) return 1; const d = pos.distanceTo(C.camera.position); return clamp(1 - d / 2500, 0, 1) ** 1.5; };
  const api = {
    init, get ctx() { return ctx; }, get loaded() { return Object.keys(BUF).length; }, get live() { return live; }, get beds() { return !!beds; },
    setVol() { if (!ctx) return; master.gain.value = C.opts.master ?? 1; fxBus.gain.value = C.opts.sfx; music.gain.value = C.opts.music * (api._musOK ? 0.9 : 0.5); },
    gun(gun, pos) {
      if (!ctx) return;
      const gs = GUN_S[gun];
      if (gs && BUF[gs[0][0]]) { const cap = gun === "capLaser" || gun === "capPlasma", sp = spatial(pos, cap ? 4200 : 2400); if (pos && live > 28) return; ps(any(gs[0]), gs[1] * sp.v * (pos ? 0.75 : 1), { pan: sp.pan, lp: sp.lp, jit: 0.1 }); return; } const v = vol(pos) * 0.16; if (v < 0.01) return; const t = ctx.currentTime; const o = ctx.createOscillator();
      const g = GUNS[gun]; o.type = gun === "laser" || gun === "rend" ? "square" : "sawtooth";
      const f0 = { laser: 1400, mass: 900, neutron: 500, particle: 1100, tachyon: 1800, rend: 700, scourge: 380, flak: 200, capLaser: 300, capPlasma: 220 }[gun] || 900;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.25, t + 0.12); env(o, v, t, 0.14); o.start(t); o.stop(t + 0.15);
    },
    boom(size, pos) {
      if (!ctx) return;
      if (BUF.x_small_a) {
        const now = ctx.currentTime; if (now - boomT > 0.25) { boomT = now; boomBudget = 0; } if (++boomBudget > 6) return;
        const big = size >= 60, sp = spatial(pos, big ? 9000 : 3200), v = sp.v, o = { pan: sp.pan, lp: sp.lp };
        if (size < 5) { ps("x_punch", 0.22 * v, { ...o, rate: 1.3, force: false }); return; }
        if (!big) { const k = clamp(size / 30, 0.45, 1.1); ps(any(["x_small_a", "x_small_b", "x_small_c"]), 0.7 * k * v, { ...o, rate: 1.15 - k * 0.25 }); ps("x_sub", 0.55 * k * v, { ...o, lp: Math.min(o.lp, 900) }); return; }
        const near = v > 0.35;
        ps("x_big", 0.95 * v, { ...o, rate: size > 500 ? 0.75 : 0.9, force: true }); ps("x_sub_big", 0.9 * Math.max(v, 0.15), { pan: o.pan, rate: 0.9, force: true });
        if (near) ps("x_small_b", 0.6 * v, { ...o, rate: 0.6 }); else ps("x_far", 0.8 * Math.max(v, 0.25), { pan: o.pan, force: true, rate: size > 500 ? 0.8 : 1 });
        for (let i = 0; i < Math.min(5, size / 120); i++) ps(any(["x_small_a", "x_small_c"]), 0.35 * v, { ...o, delay: 0.3 + i * (0.25 + Math.random() * 0.35), rate: 0.7 + Math.random() * 0.3 });
        return;
      } const v = clamp(vol(pos) * (0.3 + size / 40), 0, 1); if (v < 0.01) return; const t = ctx.currentTime;
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(1600, t); f.frequency.exponentialRampToValueAtTime(80, t + 0.6 + size / 40);
      n.connect(f); env(f, v, t, 0.7 + size / 30); n.start(t); n.stop(t + 2);
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5); env(o, v * 0.7, t, 0.6); o.start(t); o.stop(t + 0.7);
    },
    missile(kind, pos) { if (!ctx) return; if (BUF.m_launch) { const sp = spatial(pos, 2200); ps(kind === "torp" ? "m_torp" : "m_launch", (kind === "torp" ? 0.75 : 0.6) * (pos ? 0.6 : 1) * sp.v, { jit: 0.06, pan: sp.pan, lp: sp.lp }); return; } if (pos) return; const t = ctx.currentTime; const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.5); n.connect(f); env(f, 0.4, t, 0.8); n.start(t); n.stop(t + 1); },
    beep(f = 880, d = 0.08, v = 0.12, type = "square") { if (!ctx) return; const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; env(o, v, t, d); o.start(t); o.stop(t + d + 0.02); },
    // low body-blow under every impact: a pitched-down sine thump plus a burst of low-passed noise
    thud(v = 1) { if (!ctx) return; const t = ctx.currentTime; v = Math.min(1.2, v);
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(74, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.3);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.85 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); o.connect(g); g.connect(fxBus); o.start(t); o.stop(t + 0.5);
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 240; const ng = ctx.createGain(); ng.gain.setValueAtTime(0.5 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); n.connect(f); f.connect(ng); ng.connect(fxBus); n.start(t); n.stop(t + 0.25); },
    hit(shield) { if (!ctx) return; if (BUF.h_shield_0) { if (shield) ps(any(["h_shield_0", "h_shield_1", "h_shield_2"]), 0.5, { rate: 1.2 }); else { ps(any(["h_hull_0", "h_hull_1", "h_hull_2"]), 0.75); ps("x_punch", 0.45, { rate: 0.9 }); } return; } const t = ctx.currentTime; const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = shield ? "highpass" : "lowpass"; f.frequency.value = shield ? 2000 : 500; n.connect(f); env(f, 0.35, t, 0.25); n.start(t); n.stop(t + 0.3); },
    engine(speedFrac, ab) { if (!ctx) return; const t = ctx.currentTime;
      if (beds) { const on = C.state === "flight" || C.state === "auto" || C.state === "launch" ? 1 : 0, s = clamp(speedFrac, 0, 1.4);
        beds.l_eng_low.g.gain.setTargetAtTime(on * (0.16 + s * 0.12), t, 0.25); beds.l_eng_low.src.playbackRate.setTargetAtTime(0.85 + s * 0.25, t, 0.3);
        beds.l_eng_mid.g.gain.setTargetAtTime(on * (0.02 + s * 0.09 + (ab ? 0.05 : 0)), t, 0.25); beds.l_eng_mid.src.playbackRate.setTargetAtTime(0.75 + s * 0.45 + (ab ? 0.2 : 0), t, 0.3);
        beds.l_ab.g.gain.setTargetAtTime(on * (ab ? 0.32 : 0), t, ab ? 0.12 : 0.35); beds.l_ab.src.playbackRate.setTargetAtTime(ab ? 1.05 : 0.9, t, 0.3);
        beds.l_cockpit.g.gain.setTargetAtTime(on * 0.12, t, 0.5); return; } engine.frequency.setTargetAtTime(38 + speedFrac * 50 + (ab ? 30 : 0), t, 0.2); engFilt.frequency.setTargetAtTime(200 + speedFrac * 500 + (ab ? 900 : 0), t, 0.2); engGain.gain.setTargetAtTime(C.state === "flight" ? 0.05 + speedFrac * 0.05 + (ab ? 0.06 : 0) : 0, t, 0.3); },
    whoosh(d = 2, on) { if (!ctx) return; if (BUF.w_autopilot) { if (d < 1.2) ps(on === false ? "w_decloak" : "w_cloak", 0.55, { jit: 0.03 }); else ps(d >= 3 ? "w_autopilot" : "w_launch", 0.6, { jit: 0.02 }); return; } const t = ctx.currentTime; const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(3000, t + d * 0.7); f.frequency.exponentialRampToValueAtTime(300, t + d); n.connect(f); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d); f.connect(g); g.connect(fxBus); n.start(t); n.stop(t + d); },
    // cockpit / interface cue: recorded sample if loaded, else the old synth tone
    cue(name, v = 0.5, o = {}, ...fb) { if (!ctx) return; if (BUF[name]) { const sp = o.pos ? spatial(o.pos, o.range || 2600) : null; ps(name, v * (sp ? sp.v : 1), { jit: 0.02, ...o, pan: sp ? sp.pan : 0, force: true }); } else if (fb.length) api.beep(...fb); },
    flyby(pos) { if (!ctx || !BUF.f_flyby_0) return; const sp = spatial(pos, 400); ps(any(["f_flyby_0", "f_flyby_1", "f_flyby_2", "f_flyby_3"]), 0.6 * Math.max(sp.v, 0.3), { pan: sp.pan, jit: 0.12 }); },
    bell() { if (!ctx) return; if (BUF.u_bell) { ps("u_bell", 0.85, { jit: 0, force: true }); return; } const t = ctx.currentTime; for (const [f, v] of [[220, 0.35], [440, 0.2], [553, 0.12], [880, 0.08], [1187, 0.05]]) { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 6); o.connect(g); g.connect(fxBus); o.start(t); o.stop(t + 6); } },
    // ---------- generative score
    mood: null, _timer: null, _step: 0,
    // ---------- recorded orchestral score: a playlist per mood, crossfaded; the generative score below is the fallback
    _track: null, _musOK: true, _rot: {},
    play(mood, pref) {
      if (!ctx) return;
      if (!api._musOK) return api.synth(mood);
      if (pref ? (api._track && api._track.name === pref) : api.mood === mood) return;
      api.mood = mood; clearInterval(api._timer); api._fadeOut();
      if (!mood || !MUSIC[mood]) return;
      api._start(mood, pref || api._pick(mood));
    },
    _pick(mood) { const l = MUSIC[mood]; const r = api._rot[mood] ?? ((Math.random() * l.length) | 0); api._rot[mood] = (r + 1) % l.length; return l[r % l.length]; },
    _fadeOut(t = 1.8) { const tr = api._track; if (!tr) return; api._track = null; tr.dead = true; const now = ctx.currentTime; tr.g.gain.cancelScheduledValues(now); tr.g.gain.setValueAtTime(tr.g.gain.value, now); tr.g.gain.linearRampToValueAtTime(0, now + t); setTimeout(() => { tr.el.pause(); tr.el.src = ""; tr.src.disconnect(); }, t * 1000 + 100); },
    _start(mood, name) {
      const el = new Audio(`assets/music/${name}.mp3`); el.preload = "auto";
      const src = ctx.createMediaElementSource(el), g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(music);
      const tr = { el, src, g, name, mood }; api._track = tr;
      el.onerror = () => { if (tr.dead) return; api._musOK = false; music.gain.value = C.opts.music * 0.5; api.mood = null; api.synth(mood); };
      el.onended = () => { if (!tr.dead && api._track === tr) { tr.dead = true; api._track = null; api._start(mood, api._pick(mood)); } };
      el.play().then(() => { const now = ctx.currentTime; g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 2.2); }).catch(() => { if (!tr.dead) setTimeout(() => !tr.dead && el.play().then(() => g.gain.linearRampToValueAtTime(1, ctx.currentTime + 2)).catch(() => {}), 1500); });
    },
    synth(mood) {
      if (!ctx || api.mood === mood && api._timer) return; api.mood = mood; api._step = 0;
      clearInterval(api._timer); if (!mood) return;
      const bpm = { combat: 132, brief: 70, sad: 56, triumph: 92, title: 64, hub: 76, tense: 100 }[mood] || 80;
      const stepDur = 60 / bpm / 2; let next = ctx.currentTime + 0.05;
      const minor = [0, 2, 3, 5, 7, 8, 10], major = [0, 2, 4, 5, 7, 9, 11];
      const prog = { combat: [0, 5, 3, 4], brief: [0, 5, 2, 4], sad: [0, 5, 3, 6], triumph: [0, 3, 4, 0], title: [0, 5, 3, 4], hub: [0, 3, 5, 4], tense: [0, 1, 0, 6] }[mood];
      const scale = mood === "triumph" ? major : minor; const root = mood === "triumph" ? 48 : 45;
      const note = (deg, oct = 0) => { const s = scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7); return 440 * Math.pow(2, (root + s + oct * 12 - 69) / 12); };
      const voice = (f, t, d, type, v, fq = 1200) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = fq; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.08, d * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl); fl.connect(g); g.connect(music); o.start(t); o.stop(t + d + 0.05); };
      const drum = (t, kind) => { const n = ctx.createBufferSource(); n.buffer = noiseBuf; const f = ctx.createBiquadFilter(); const g = ctx.createGain(); if (kind === "k") { const o = ctx.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); const og = ctx.createGain(); og.gain.setValueAtTime(0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(og); og.connect(music); o.start(t); o.stop(t + 0.25); return; } f.type = kind === "s" ? "bandpass" : "highpass"; f.frequency.value = kind === "s" ? 1800 : 7000; g.gain.setValueAtTime(kind === "s" ? 0.35 : 0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === "s" ? 0.18 : 0.04)); n.connect(f); f.connect(g); g.connect(music); n.start(t); n.stop(t + 0.2); };
      const tick = () => {
        while (next < ctx.currentTime + 0.3) {
          const s = api._step++, bar = Math.floor(s / 16) % 4, deg = prog[bar], beat = s % 16;
          if (beat === 0) { for (const k of [0, 2, 4]) voice(note(deg + k), next, stepDur * 16, mood === "combat" ? "sawtooth" : "triangle", mood === "combat" ? 0.05 : 0.07, mood === "combat" ? 900 : 700); voice(note(deg, -2), next, stepDur * 16, "sine", 0.12, 400); }
          if (mood === "combat" || mood === "tense") {
            if (beat % 2 === 0) voice(note(deg, -1) * (beat % 4 === 2 ? 2 : 1), next, stepDur * 1.6, "sawtooth", 0.07, 500);
            if (beat % 8 === 0) drum(next, "k"); if (beat % 8 === 4) drum(next, "s"); if (mood === "combat") drum(next, "h");
            if (mood === "combat" && beat % 4 === 0 && Math.random() < 0.6) voice(note(deg + pick([4, 7, 9, 11]), 1), next, stepDur * 3, "square", 0.025, 2000);
          } else if (mood === "triumph") {
            if (beat % 4 === 0) voice(note(deg + [0, 2, 4, 7][beat / 4], 1), next, stepDur * 4, "sawtooth", 0.05, 1800);
            if (beat % 8 === 0) drum(next, "k");
          } else {
            if (beat % 4 === 0 && Math.random() < 0.7) voice(note(deg + pick([0, 2, 4, 6, 7]), 1), next, stepDur * 6, "sine", 0.06, 2000);
          }
          next += stepDur;
        }
      };
      api._timer = setInterval(tick, 100); tick();
    },
  };
  return api;
})();

// ======================================================================= SPEECH
export const voice = {
  q: [], speaking: false,
  say(who, text, onend) {
    const synth = window.speechSynthesis;
    if (!C.opts.voice || !synth) { onend && setTimeout(onend, 300 + text.length * 55); return; }
    const u = new SpeechSynthesisUtterance(text.replace(/\.\.\./g, ", ").replace(/—/g, ", "));
    const v = (CAST[who] || {}).voice || { pitch: 1, rate: 1 };
    u.pitch = clamp(v.pitch, 0.1, 2); u.rate = clamp(v.rate * 1.02, 0.5, 1.6); u.volume = 0.9 * (C.opts.voiceVol ?? 1) * (C.opts.master ?? 1);
    const voices = synth.getVoices().filter(x => /^en/i.test(x.lang));
    if (voices.length) { const idx = Math.abs([...who].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % voices.length; u.voice = voices[idx]; }
    let done = false; const fin = () => { if (done) return; done = true; voice.speaking = false; onend && onend(); };
    u.onend = fin; u.onerror = fin; voice.speaking = true;
    synth.speak(u);
    setTimeout(fin, 1500 + text.length * 90);
  },
  stop() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { } voice.speaking = false; },
};

// ======================================================================= INPUT
const keys = new Set(), edges = new Set();
const mouse = { x: 0, y: 0, l: false, r: false, locked: false };
let padPrev = [];
export const pad = { connected: false, buttons: [], axes: [0, 0, 0, 0], pressed: new Set(), name: "" };
function initInput(el) {
  window.addEventListener("keydown", e => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (capture.fn) { e.preventDefault(); e.stopPropagation(); const code = (e.ctrlKey && !e.code.startsWith("Control") ? "Ctrl+" : "") + e.code; if (!e.code.startsWith("Control")) capture.fn({ kind: "key", code }); return; }
    if (!keys.has(e.code)) edges.add(e.code); keys.add(e.code);
    if (C.state === "flight" && ["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "F8"].includes(e.code)) e.preventDefault();
    C.hooks.key && C.hooks.key(e);
  });
  window.addEventListener("keyup", e => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("mousedown", e => { if (capture.fn && capture.mouse && (e.button === 0 || e.button === 2)) { e.preventDefault(); capture.fn({ kind: "key", code: e.button === 0 ? "MouseL" : "MouseR" }); } }, true);
  el.addEventListener("mousedown", e => { if (C.state === "flight" && e.button === 0) edges.add("MouseL"); if (C.state === "flight") { if (!mouse.locked && !mouse.fallback) { try { const p = el.requestPointerLock(); if (p && p.catch) p.catch(() => { mouse.fallback = true; }); setTimeout(() => { if (!mouse.locked) mouse.fallback = true; }, 600); } catch (er) { mouse.fallback = true; } } if (e.button === 0) mouse.l = true; if (e.button === 2) { mouse.r = true; edges.add("MouseR"); } } });
  window.addEventListener("mouseup", e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
  el.addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("pointerlockchange", () => { mouse.locked = document.pointerLockElement === el; if (!mouse.locked) { mouse.x = mouse.y = 0; } });
  window.addEventListener("mousemove", e => { if (mouse.fallback && !mouse.locked && C.state === "flight") { mouse.x = clamp((e.clientX / C.W) * 2 - 1, -1, 1); mouse.y = clamp((e.clientY / C.H) * 2 - 1, -1, 1); mouse.active = true; } if (mouse.locked) { mouse.x = clamp(mouse.x + e.movementX * 0.0022 * C.opts.sens, -1, 1); mouse.y = clamp(mouse.y + e.movementY * 0.0022 * C.opts.sens, -1, 1); } });
  window.addEventListener("gamepadconnected", e => { pad.connected = true; pad.name = e.gamepad.id; C.hooks.padConnected && C.hooks.padConnected(e.gamepad.id); });
}
export function pollPad() {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  let g = null; for (const x of gps) if (x && x.connected) { g = x; break; }
  pad.pressed.clear();
  if (!g) { pad.connected = false; return pad; }
  pad.connected = true; pad.name = g.id;
  const b = g.buttons.map(x => x.pressed || x.value > 0.4);
  b.forEach((v, i) => { if (v && !padPrev[i]) pad.pressed.add(i); });
  padPrev = b; pad.buttons = b; pad.raw = g;
  const D = C.opts.deadzone ?? 0.14, dz = v => Math.abs(v) < D ? 0 : (v - Math.sign(v) * D) / (1 - D);
  pad.axes = g.axes.map(v => dz(v || 0)); while (pad.axes.length < 4) pad.axes.push(0);
  if (capture.fn && capture.pad) { const i = [...pad.pressed][0]; if (i != null) capture.fn({ kind: "pad", button: i, held: b }); else { const a = g.axes.findIndex(v => Math.abs(v) > 0.7); if (a >= 0 && capture.axis) capture.fn({ kind: "axis", axis: a, value: g.axes[a] }); } }
  pad.lt = g.buttons[6] ? g.buttons[6].value : 0; pad.rt = g.buttons[7] ? g.buttons[7].value : 0;
  return pad;
}
export function rumble(s = 0.4, d = 120) { if (C.opts.vibration === false) return; try { const g = pad.raw; g && g.vibrationActuator && g.vibrationActuator.playEffect("dual-rumble", { duration: d, strongMagnitude: s, weakMagnitude: s * 0.6 }); } catch (e) { } }
export function exitPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
// ---------- bindings: every action is remappable (keyboard/mouse codes, pad buttons or "a+b" combos, pad axes)
export const ACTIONS = [
  ["pitchDown", "Nose down", "Flight", 1], ["pitchUp", "Nose up", "Flight", 1], ["yawLeft", "Yaw left", "Flight", 1], ["yawRight", "Yaw right", "Flight", 1],
  ["rollLeft", "Roll left", "Flight", 1], ["rollRight", "Roll right", "Flight", 1], ["thrUp", "Throttle up", "Flight", 1], ["thrDn", "Throttle down", "Flight", 1],
  ["ab", "Afterburner", "Flight", 1], ["slide", "Slide (drift)", "Flight", 1], ["match", "Match target speed", "Flight"], ["stop", "Full stop", "Flight"],
  ["fire", "Fire guns", "Weapons", 1], ["missile", "Launch missile", "Weapons"], ["cycGun", "Gun mode", "Weapons"], ["cycMis", "Cycle missiles", "Weapons"], ["decoy", "Drop decoy", "Weapons"],
  ["tgtNext", "Next target", "Targeting"], ["tgtPrev", "Previous target", "Targeting"], ["tgtNear", "Nearest enemy", "Targeting"],
  ["comms", "Comms menu", "Ship"], ["auto", "Autopilot", "Ship"], ["land", "Request landing", "Ship"], ["cloak", "Cloak", "Ship"], ["eject", "Eject", "Ship"],
  ["view", "Cockpit / chase view", "Camera"], ["look", "Look behind", "Camera", 1], ["pause", "Pause", "System"], ["fullscreen", "Fullscreen", "System"],
];
export const DEFAULT_BINDS = {
  kb: { pitchDown: ["ArrowUp", "Numpad8"], pitchUp: ["ArrowDown", "Numpad2"], yawLeft: ["ArrowLeft", "Numpad4"], yawRight: ["ArrowRight", "Numpad6"], rollLeft: ["KeyA", "KeyQ"], rollRight: ["KeyD", "KeyE"],
    thrUp: ["KeyW", "Equal"], thrDn: ["KeyS", "Minus"], ab: ["Tab", ""], slide: ["ShiftLeft", "ShiftRight"], match: ["KeyB", ""], stop: ["Backspace", ""],
    fire: ["Space", "MouseL"], missile: ["KeyF", "MouseR"], cycGun: ["KeyG", ""], cycMis: ["KeyM", ""], decoy: ["KeyX", ""],
    tgtNext: ["KeyT", ""], tgtPrev: ["KeyY", ""], tgtNear: ["KeyR", ""], comms: ["KeyC", ""], auto: ["KeyN", ""], land: ["KeyL", ""], cloak: ["KeyK", ""], eject: ["Ctrl+KeyE", ""],
    view: ["KeyV", ""], look: ["KeyZ", ""], pause: ["KeyP", ""], fullscreen: ["F8", ""] },
  pad: { thrUp: ["12"], thrDn: ["13"], ab: ["6"], slide: ["4"], match: ["11"], stop: [], fire: ["7"], missile: ["5"], cycGun: [], cycMis: ["2"], decoy: ["1"],
    tgtNext: ["15"], tgtPrev: ["14"], tgtNear: ["0"], comms: ["3"], auto: ["8"], land: [], cloak: ["10"], eject: ["8+1"], view: [], look: [], pause: ["9"], fullscreen: [],
    pitchDown: [], pitchUp: [], yawLeft: [], yawRight: [], rollLeft: [], rollRight: [] },
  axes: { pitch: { axis: 1, inv: false }, yaw: { axis: 0, inv: true }, roll: { axis: 2, inv: true }, throttle: { axis: 3, inv: true } },
};
export const binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
try { const saved = JSON.parse(localStorage.getItem("halcyonwing.binds") || "null"); if (saved) for (const k of ["kb", "pad", "axes"]) Object.assign(binds[k], saved[k] || {}); } catch (e) { }
export function saveBinds() { try { localStorage.setItem("halcyonwing.binds", JSON.stringify(binds)); } catch (e) { } }
export function resetBinds(which) { for (const k of which || ["kb", "pad", "axes"]) binds[k] = JSON.parse(JSON.stringify(DEFAULT_BINDS[k])); saveBinds(); }
C.binds = binds;
// capture hook for the rebinding UI: receives the next key/mouse/pad press instead of the game
export const capture = { fn: null };
function readControls() {
  const k = c => keys.has(c), e = c => edges.has(c), p = pad, pb = i => p.pressed.has(i), ph = i => !!p.buttons[i];
  const ctrl = () => k("ControlLeft") || k("ControlRight");
  const kHeld = code => !code ? false : code.startsWith("Ctrl+") ? ctrl() && k(code.slice(5)) : code === "MouseL" ? mouse.l : code === "MouseR" ? mouse.r : (k(code) && !(ctrl() && code === "KeyE"));
  const kEdge = code => !code ? false : code.startsWith("Ctrl+") ? ctrl() && e(code.slice(5)) : code === "MouseL" ? e("MouseL") : code === "MouseR" ? e("MouseR") : (e(code) && !(ctrl() && code === "KeyE"));
  // pad: combos ("8+1") consume their buttons so the single-button actions underneath don't also fire
  const used = new Set(); if (p.connected) for (const list of Object.values(binds.pad)) for (const s of list || []) if (s && s.includes("+")) { const bs = s.split("+").map(Number); if (bs.every(ph)) bs.forEach(b => used.add(b)); }
  const sHeld = s => { if (!s || !p.connected) return false; if (s.includes("+")) return s.split("+").map(Number).every(ph); const b = +s; return ph(b) && !used.has(b); };
  const sEdge = s => { if (!s || !p.connected) return false; if (s.includes("+")) { const bs = s.split("+").map(Number); return bs.every(ph) && bs.some(pb); } const b = +s; return pb(b) && !used.has(b); };
  const H = id => (binds.kb[id] || []).some(kHeld) || (binds.pad[id] || []).some(sHeld);
  const E = id => (binds.kb[id] || []).some(kEdge) || (binds.pad[id] || []).some(sEdge);
  const ax = a => { const b = binds.axes[a]; if (!b || b.axis < 0 || !p.connected) return 0; return (p.axes[b.axis] || 0) * (b.inv ? -1 : 1); };
  const inv = C.opts.invert ? -1 : 1;
  let pitch = 0, yaw = 0, roll = 0;
  // keyboard (joystick convention: "nose down" = stick forward)
  if (H("pitchDown")) pitch -= inv; if (H("pitchUp")) pitch += inv;
  if (H("yawLeft")) yaw += 1; if (H("yawRight")) yaw -= 1;
  if (H("rollLeft")) roll += 1; if (H("rollRight")) roll -= 1;
  // mouse virtual stick (mouse up = nose up)
  if (mouse.locked || (mouse.fallback && mouse.active)) { const dz = v => Math.abs(v) < (mouse.locked ? 0.04 : 0.08) ? 0 : v; pitch += -dz(mouse.y) * (C.opts.mouseInvert ? -1 : 1) * 1.4; yaw += -dz(mouse.x) * 1.4; }
  // gamepad sticks
  if (p.connected) { pitch += ax("pitch") * inv; yaw += ax("yaw"); roll += ax("roll"); }
  const thrA = ax("throttle");
  const ctl = {
    pitch: clamp(pitch, -1, 1), yaw: clamp(yaw, -1, 1), roll: clamp(roll, -1, 1),
    thrUp: H("thrUp") || k("NumpadAdd") || thrA > 0.5, thrDn: H("thrDn") || k("NumpadSubtract") || thrA < -0.5,
    fire: H("fire") || (p.connected && (binds.pad.fire || []).includes("7") && p.rt > 0.3),
    missile: E("missile") || e("Enter") || e("NumpadEnter"),
    ab: H("ab") || (p.connected && (binds.pad.ab || []).includes("6") && p.lt > 0.3),
    slide: H("slide"), decoy: E("decoy"),
    tgtNext: E("tgtNext"), tgtPrev: E("tgtPrev"), tgtNear: E("tgtNear"),
    cycGun: E("cycGun"), cycMis: E("cycMis"),
    comms: E("comms"), commsPick: [1, 2, 3, 4, 5, 6].find(n => e("Digit" + n) || e("Numpad" + n)) || 0,
    auto: E("auto"), land: E("land"), cloak: E("cloak"), match: E("match"), stop: E("stop"),
    eject: E("eject"), pause: e("Escape") || E("pause"), view: E("view"), look: H("look"), fullscreen: E("fullscreen"),
  };
  // dpad in comms menu picks
  if (C.commsOpen && p.connected) { if (pb(12)) ctl.commsPick = 1; if (pb(15)) ctl.commsPick = 2; if (pb(13)) ctl.commsPick = 3; if (pb(14)) ctl.commsPick = 4; if (pb(0)) ctl.commsPick = 5; ctl.tgtNext = ctl.tgtPrev = ctl.tgtNear = false; ctl.thrUp = ctl.thrDn = false; }
  edges.clear();
  return ctl;
}
export function consumeEdges() { edges.clear(); }

// ======================================================================= SHIPS
let UID = 1;
const VNAMES = ["Vosk'ar", "Thrael", "Ka'zun", "Rhesk", "Ghavri", "Ulmek", "Sh'tor", "Dhaavik", "Kresh", "Varrun", "Ithek", "Mor'ga", "Zhal", "Hekri"];
export class Ship {
  constructor(type, team, o = {}) {
    this.id = o.id || type + "_" + UID++; this.uid = UID++; this.type = type; this.team = team;
    this.def = SHIPS[type]; this.isCap = !!this.def.capital; this.alive = true; this.pilot = o.pilot || null;
    this.name = o.name || (this.pilot && CAST[this.pilot] ? (CAST[this.pilot].callsign || CAST[this.pilot].name) : this.def.name);
    if (!this.pilot && !this.isCap && team === "vharr") this.hunter = "Hunter " + pick(VNAMES);
    const modelKey = o.model || type;
    this.m = M.buildShip(modelKey); this.obj = this.m.obj; this.obj.userData.ship = this;
    C.world.add(this.obj);
    this.pos = this.obj.position; this.q = this.obj.quaternion; this.vel = tv(); this.av = tv();
    this.radius = this.isCap ? this.m.radius : Math.max(5, this.def.size * 0.45);
    if (this.isCap) {
      this.hullMax = this.hull = this.def.hull * (team === "vharr" ? (0.8 + 0.2 * C.opts.difficulty) : 1);
      const b = new THREE.Box3().setFromObject(this.obj); this.bmin = b.min.clone(); this.bmax = b.max.clone();
      this.speed = this.def.speed * K * 0.35; this.setSpeed = this.speed;
      this.comps = [];
      (this.m.turrets || []).forEach((t, i) => this.comps.push(new Comp(this, "Turret " + (i + 1), t, 90 + this.def.size * 0.08, "turret")));
      if (this.m.gen && this.def.shieldGen) { const g = new THREE.Object3D(); g.position.copy(this.m.gen); this.obj.add(g); this.gen = new Comp(this, "Shield Generator", g, 380, "gen"); this.comps.push(this.gen); }
      this.launches = 0; this.launchT = 25;
    } else {
      const d = this.def;
      this.shMax = [...d.shield]; this.sh = [...d.shield]; this.arMax = [...d.armor]; this.ar = [...d.armor]; this.coreMax = this.core = d.core;
      if (team === "vharr" && !this.pilot) { const k = 0.75 + 0.25 * C.opts.difficulty; this.sh = this.sh.map(x => x * k); this.shMax = [...this.sh]; this.ar = this.ar.map(x => x * k); this.arMax = [...this.ar]; }
      this.energyMax = this.energy = d.energy; this.fuel = d.fuel || 100; this.fuelMax = this.fuel;
      this.guns = d.guns.map((g, i) => ({ type: g, pos: this.m.guns[i % this.m.guns.length] || tv(), ok: true }));
      this.gunMode = 0; this.gunCd = 0; this.gunAlt = 0;
      this.mis = { ...(o.loadout || d.missiles) }; this.misSel = Object.keys(this.mis)[0] || null; this.decoys = d.decoys;
      this.speed = d.speed * K * 0.6; this.setSpeed = this.speed; this.vel.set(0, 0, -this.speed);
      this.dmg = {}; this.lastHit = -9; this.lock = { tgt: null, t: 0 };
      this.ai = { mode: "attack", t: 0, jink: tv(), skill: o.skill ?? (this.pilot ? 0.82 : 0.55 + 0.1 * C.opts.difficulty), misT: rand(4, 9), lockT: 0 };
      if (o.ace) { this.ace = true; this.ai.skill = 0.95; }
    }
    this.targetPref = o.target || null;
    if (o.protect) this.protect = true;
  }
  get fwd() { return _fw.set(0, 0, -1).applyQuaternion(this.q); }
  forward(out = tv()) { return out.set(0, 0, -1).applyQuaternion(this.q); }
  up(out = tv()) { return out.set(0, 1, 0).applyQuaternion(this.q); }
  hostile(o) { return o.team !== this.team; }
  remove() { this.alive = false; C.world.remove(this.obj); if (this.comps) this.comps.forEach(c => c.alive = false); }
  healthFrac() { if (this.isCap) return this.hull / this.hullMax; const a = this.ar.reduce((x, y) => x + y, 0), am = this.arMax.reduce((x, y) => x + y, 0); return (a / am) * 0.5 + (this.core / this.coreMax) * 0.5; }
}
const _fw = tv();
class Comp {
  constructor(parent, name, obj, hp, kind) { this.parent = parent; this.name = name; this.obj = obj; this.hp = this.hpMax = hp; this.kind = kind; this.alive = true; this.comp = true; this.team = parent.team; this.isCap = false; this.radius = kind === "gen" ? 22 : 12 + parent.def.size * 0.006; this.pos = tv(); this.vel = parent.vel; this.cd = rand(1, 3); this.def = { name, cls: kind === "gen" ? "Subsystem" : "Gun Turret" }; this.id = parent.id + ":" + name; }
  update() { this.obj.getWorldPosition(this.pos); }
  healthFrac() { return this.hp / this.hpMax; }
}

// ======================================================================= MISSION RUNTIME
export function clearWorld(keepPlayer) {
  for (const e of C.ents) if (!(keepPlayer && e.keep)) { if (e.obj) C.world.remove(e.obj); }
  C.ents = keepPlayer ? C.ents.filter(e => e.keep && e.alive) : [];
  for (const b of C.boltPool) { b.life = 0; b.m.visible = false; }
  for (const m of C.missiles) C.world.remove(m.mesh); C.missiles = [];
  for (const d of C.decoys) C.world.remove(d.s); C.decoys = [];
  for (const p of C.pool) { p.life = 0; p.s.visible = false; }
  const keep = C.ents.map(e => e.obj);
  C.world.children.slice().forEach(ch => { if (!keep.includes(ch)) C.world.remove(ch); });
  C.target = null;
}
export function addShip(s) { C.ents.push(s); if (s.comps) C.ents.push(...s.comps); return s; }

export function startMission(mission, camp, onEnd) {
  C.mission = mission; C.camp = camp; C.onEnd = onEnd;
  mouse.x = mouse.y = 0; mouse.active = false;
  setCockpit(mission.ship); C.cockpit.userData.power = 0;
  if (C.cockpit.userData.flair) C.cockpit.userData.flair.personalize({ callsign: camp.callsign, kills: camp.kills });
  C.camera.fov = C.opts.fov || 72; C.camera.updateProjectionMatrix(); C.sun.intensity = 3.2; C.fill.intensity = 0.55; C.bloom.strength = 0.85; C.scene.background = C.skyTex;
  C.musicLock = false; C._calm = 0;
  C.stats = { kills: 0, killsBy: {}, shots: 0, hits: 0, wingKills: {}, navs: {}, ejected: [], deadIds: new Set(), aceKills: [], hitsTaken: 0, wounded: false, t0: 0, missiles: 0, time: 0, hullEnd: 1 };
  clearWorld(false);
  C.flags = camp.flags || {};
  // player
  const pl = new Ship(mission.ship, "concord", { id: "player", name: camp.callsign || "Rookie", loadout: mission.loadout });
  pl.isPlayer = true; pl.keep = true; pl.obj.visible = false; pl.pilot = "player"; C.player = pl; addShip(pl);
  // wingmen
  C.wing = [];
  const wingShip = mission.ship === "wraith" ? "warden" : mission.ship;
  (mission.wing || []).forEach((w, i) => {
    const s = new Ship(wingShip, "concord", { pilot: w, skill: 0.7 + 0.05 * ((camp.morale || {})[w] || 0) });
    s.wingman = true; s.keep = true; s.slot = i; if (w === "spark" && mission.id === "m6") s.protect = true;
    if (mission.id === "m12" && w === "deacon") s.protect = true;
    C.wing.push(s); addShip(s);
  });
  C.wingOrder = "break";
  C.escorts = (mission.escort || []).map((e, i) => { const s = new Ship(e.type, "concord", { id: e.id, name: e.name }); s.escort = true; s.keep = true; s.slot = i; return addShip(s); });
  C.navIdx = 0; C.result = null; C.dead = false; C.view = "cockpit"; C.comms = []; C.curComm = null; C.msgs = []; C.finaleT = undefined; C.carrierLostT = 0; C.sparkDone = false; C.ghost = null; C.scriptHold = false; C.commsOpen = false; C.dyingCaps = []; C.debris = []; C.t = 0;
  loadNav(0, true);
  C.state = "launch"; C.stateT = 0; C.paused = false; C.fade = 1; C.cracks = null; C.hitDirs = []; C.kick = null; C.shake = 0;   // fade in, so the frames before the cockpit camera settles in the tube never show
  sfx.play("tense");
}

function navEnv(nav) {
  const env = { ...(nav.env || {}) };
  if (!env.planet) { const prev = C.mission.navs.find(n => n.env && n.env.planet); env.planet = prev ? prev.env.planet : null; env.pdir = [0.8, -0.4, 0.6]; }
  if (C.mission.id === "m12" && C.flags.targetAshkar && C.navIdx === 2) env.planet = "ashkar";
  return env;
}
function loadNav(i, first) {
  C._nagT = 8; if (first) C._nagged = false;   // autopilot reminder: a few seconds after arriving at each nav
  const ms = C.mission, nav = ms.navs[i];
  clearWorld(true);
  C.navIdx = i; C.navT = 0; C.fired = new Set(); C.cleared = false; C.flak = 0;
  buildNavEnv(navEnv(nav));
  const pl = C.player;
  pl.pos.set(0, 0, 0); pl.q.identity(); pl.vel.set(0, 0, -pl.speed); pl.av.set(0, 0, 0);
  C.wing.forEach((w, k) => { if (!w.alive) return; w.pos.set(k % 2 ? -45 : 45, 8, nav.start ? -70 - k * 30 : 40 + k * 30); w.q.identity(); w.vel.set(0, 0, -w.speed); });
  C.escorts.forEach((e, k) => { if (!e.alive || e.safe) return; e.pos.set(k % 2 ? 160 : -160, -60, 260 + k * 120); e.q.identity(); e.speed = e.setSpeed = pl.def.speed * K * 0.25; });
  C.carrier = null;
  // friends
  for (const f of nav.friends || []) {
    const s = addShip(new Ship(f.type, "concord", { id: f.id }));
    if (f.type === "halcyon") {
      if (nav.start) s.pos.set(0, -8, 560); else if (nav.home) { s.pos.set(0, -140, -2600); s.q.setFromAxisAngle(new V3(0, 1, 0), Math.PI); } else s.pos.set(...f.pos);
      s.speed = s.setSpeed = nav.home || nav.start ? 0 : s.speed;
      C.carrier = s;
    } else s.pos.set(...(f.pos || [rand(-500, 500), 0, rand(-1500, -500)]));
    if (f.type === "lifepod") { s.speed = 0; s.obj.rotation.set(rand(0, 6), rand(0, 6), 0); }
  }
  for (const g of nav.groups || []) spawnGroup(g);
  if (nav.home) C.comms.push({ who: "comms", text: `${C.camp.callsign || "Vigil"}, Halcyon. We have you on scope. Request landing when ready.` });
  if (nav.start && first) { pl.pos.set(0, 0, 400); pl.speed = 0; pl.vel.set(0, 0, 0); C.tube = buildTube(); C.world.add(C.tube); C.wing.forEach((w, k) => { w.pos.set(k % 2 ? -60 : 60, 10, -250 - k * 40); }); }
  if (nav.env && nav.env.flakField) C.flak = 1;
  if (ms.id === "m12" && i === 2) C.flak = 1;
}

function buildTube() {
  const g = new THREE.Group();
  const T = M.tex().concord1;
  const wall = new THREE.MeshStandardMaterial({ color: 0x5a606a, map: T.map, bumpMap: T.bump, bumpScale: 2, roughness: 0.6, metalness: 0.6, side: THREE.BackSide });
  const box = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 440), wall); box.position.set(0, 2, 230); g.add(box);
  const glowA = new THREE.MeshBasicMaterial({ color: 0xffc070 }), glowB = new THREE.MeshBasicMaterial({ color: 0x60b0ff }), red = new THREE.MeshBasicMaterial({ color: 0xff3020 });
  for (let z = 20; z < 440; z += 14) {
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 5), glowA); l.position.set(s * 10.7, 7.6, z); g.add(l); const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 2), glowB); l2.position.set(s * 10.7, -3.5, z + 6); g.add(l2); }
    const f = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.2), z % 28 ? glowB : red); f.position.set(0, -4.9, z); g.add(f);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.5, metalness: 0.7 })); rib.position.set(0, 8.4, z); g.add(rib);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 440), new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.9, roughness: 0.3 })); rail.position.set(0, -4.6, 230); g.add(rail);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })); door.position.set(0, 2, 10); g.add(door);
  return g;
}
export function spawnGroup(g) {
  const team = SHIPS[g.type].faction === "vharr" ? "vharr" : "concord";
  const base = g.pos ? new V3(...g.pos) : new V3(rand(-900, 900), rand(-300, 300), rand(-2400, -3400));
  if (!g.pos && C.player) base.applyQuaternion(C.player.q).add(C.player.pos);
  const out = [];
  for (let i = 0; i < (g.n || 1); i++) {
    const model = g.ace === "shkara" ? "shkara" : g.ace === "kaerr" ? "bloodcrown" : g.ace === "ember" ? "embership" : undefined;
    const type = g.ace === "kaerr" ? "bloodcrown" : g.type;
    const s = new Ship(type, team, { id: g.n > 1 ? undefined : g.id, pilot: g.ace, ace: !!g.ace, model, target: g.target });
    if (g.id && g.n === 1) s.id = g.id;
    s.pos.copy(base).add(new V3((i % 3 - 1) * 60, Math.floor(i / 3) * 40, i * 30));
    s.obj.lookAt(C.player ? C.player.pos : new V3()); if (!s.isCap) s.q.multiply(_q.setFromAxisAngle(new V3(0, 1, 0), Math.PI));
    if (s.isCap) { s.q.setFromAxisAngle(new V3(0, 1, 0), rand(-0.6, 0.6) + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1)); }
    s.forward(s.vel).multiplyScalar(s.speed);
    addShip(s); out.push(s);
  }
  return out;
}

function hostiles(team = "concord", range = Infinity, fightersOnly = false) {
  const p = C.player.pos;
  return C.ents.filter(e => e.alive && !e.comp && e.team !== team && !e.def.shearOnly && (!fightersOnly || !e.isCap) && (!e.isCap || e.comps.some(c => c.alive && c.kind === "turret") || e.def.launcher) && e.pos.distanceTo(p) < range);
}
function pendingSpawns() { const nav = C.mission.navs[C.navIdx]; return (nav.events || []).some(ev => ev.spawn && !C.fired.has(ev)); }

function runEvents(dt) {
  const nav = C.mission.navs[C.navIdx]; if (!nav.events) return;
  for (const ev of nav.events) {
    if (C.fired.has(ev)) continue;
    let go = false;
    if (ev.at === "arrive") go = C.navT > 1.2;
    else if (ev.at === "clear") go = C.navT > 3 && hostiles("concord", Infinity, true).length === 0 && !pendingSpawns();
    else if (ev.at.startsWith("t:")) go = C.navT > +ev.at.slice(2);
    else if (ev.at.startsWith("dead:")) go = C.stats.deadIds.has(ev.at.slice(5));
    if (!go) continue;
    C.fired.add(ev);
    (ev.say || []).forEach(([w, t]) => C.comms.push({ who: w, text: t }));
    (ev.spawn || []).forEach(g => spawnGroup(g));
    if (ev.fn) scripted(ev.fn);
  }
}
// ======================================================================= GHOST SIGNAL (m9b)
// Ricochet peels off to chase a sensor ghost, finds a cloaked capital ship, is disabled by it and
// killed by its fighters. Every beat after the distress call is keyed to the player's distance from
// him, so the explosion always happens in front of the player, just out of reach.
function sayNow(who, text) { voice.stop(); C.comms = [{ who, text }]; C.curComm = null; }
function ghostTick(dt) {
  if (C.navIdx !== 1) { C.scriptHold = false; return; }
  const G = C.ghost || (C.ghost = { ph: 0, t: 0, f: {} });
  G.t += dt; C.scriptHold = G.ph < 6; C.musicLock = G.ph >= 3;
  const pl = C.player, rico = C.wing.find(w => w.pilot === "ricochet");
  const once = (k, fn) => { if (!G.f[k]) { G.f[k] = G.t; fn(); return true; } return false; };
  const ago = k => G.f[k] ? G.t - G.f[k] : -1;
  if (G.ph === 0) {
    if (G.t > 6) once("a", () => C.comms.push({ who: "ricochet", text: "Hold up. Long-range is picking up something big. It keeps flickering in and out. Probably an ion ghost." }));
    if (G.t > 12) once("b", () => {
      C.comms.push({ who: "ricochet", text: "I'm gonna go take a look. You take the convoy, I'll be right back. Don't hog all the kills, partner." });
      G.spot = new V3(6500, 600, 6200);
      if (rico && rico.alive) { rico.id = "ricochet"; rico.protect = true; rico.scriptGoto = G.spot; }
      G.ph = 1;
    });
  }
  if (G.ph >= 1 && G.ph < 3) {
    const L = ago("b");
    if (L > 16) once("d1", () => C.comms.push({ who: "ricochet", text: "Getting closer. {callsign}, this isn't an ion storm. Whatever it is, it's huge." }));
    if (L > 30) once("d2", () => C.comms.push({ who: "ricochet", text: "Oh my God. It's a ship. A Vharr capital ship, bigger than a Hunt-Mother, and it's cloaked. I'm looking right at it and it's barely there." }));
    if (L > 42) once("d3", () => C.comms.push({ who: "ricochet", text: "I can't believe something that big has a cloak. I'm getting a sensor recording. Halcyon needs to see this." }));
    const convoyDead = C.stats.deadIds.has("conv1") && C.stats.deadIds.has("conv2");
    if (!G.primary && convoyDead && hostiles("concord", Infinity, true).length === 0 && C.navT > 5) { G.primary = true; G.primaryT = G.t; C.msgs.push({ t: 3.5, text: "CONVOY DESTROYED — PRIMARY OBJECTIVE COMPLETE" }); }
    // the distress call: only once the convoy is dead and he has told you what he found
    if (G.ph === 1 && G.primary && G.f.d3 && G.t - G.primaryT > 3 && ago("d3") > 5) {
      G.ph = 3; G.ds = G.t;
      if (rico) { rico.scriptGoto = null; rico.disabled = true; if (rico.pos.distanceTo(G.spot) > 900) rico.pos.copy(G.spot); }
      const sp = rico.pos.clone().add(new V3(-600, 380, -1700));
      const sh = spawnGroup({ type: "shroud", n: 1, id: "shroud", pos: [sp.x, sp.y, sp.z] })[0]; G.shroud = sh;
      explode(sp, 420, 0x9a70ff); explode(rico.pos, 30, 0x80c0ff);
      sayNow("ricochet", "{callsign}! It just uncloaked right on top of me! Some kind of pulse, everything's dead! Engines, guns, shields, nothing!");
      C.comms.push({ who: "ricochet", text: "I'm drifting. I need you, partner. Please." }, { who: "player", text: "Hang on, Danny. I'm coming." });
      C.target = rico; G.d0 = Math.max(4000, pl.pos.distanceTo(rico.pos));
      C.msgs.push({ t: 5, text: "RICOCHET — DISTRESS BEACON — FOLLOW THE TARGET MARKER" }); sfx.play("tense", "m_tense_emergency");
    }
  }
  if (G.ph === 3 && rico) {
    const td = G.t - G.ds, d = pl.pos.distanceTo(rico.pos);
    if (C.target !== rico && !G.f.death) C.target = rico;
    if (!G.f.launch && (d < G.d0 * 0.6 || td > 38)) once("launch", () => {
      const base = G.shroud.pos; G.squad = [];
      const types = ["vhaal", "dhakar", "vhaal", "dhakar", "krosk"];
      types.forEach((t, i) => { const p = base.clone().add(new V3((i - 2) * 140, -220 - (i % 2) * 60, 500 + i * 40)); const s = spawnGroup({ type: t, n: 1, pos: [p.x, p.y, p.z], target: "ricochet" })[0]; s.protect = true; s.squad = true; G.squad.push(s); });
      sayNow("ricochet", "Multiple contacts launching from the big ship! Five of them! They're coming right at me!");
    });
    if (G.f.launch && !G.f.hit1 && ((ago("launch") > 2.5 && (d < 4300 || td > 52)) || d < 2700)) once("hit1", () => sayNow("ricochet", "They're on me! I'm taking hits! I can't move, I can't shoot, I'm a sitting duck out here!"));
    if (G.f.hit1 && !G.f.hit2 && ((ago("hit1") > 2 && (d < 3200 || td > 64)) || d < 2000)) once("hit2", () => sayNow("ricochet", "Shields are gone! Hull's breached! {callsign}, where are you?!"));
    if (G.f.hit2 && !G.f.death && ((ago("hit2") > 1.8 && (d < 2050 || td > 82)) || d < 1500)) once("death", () => {
      sayNow("ricochet", "No, no, no — {callsign}, tell them I — AAAAAHH!");
      const p = rico.pos.clone(); rico.protect = false; kill(rico, null); C.stats.deadIds.add("ricochet");
      explode(p, 70, 0xffb060); setTimeout(() => { explode(p.clone().add(new V3(12, 6, -8)), 48, 0xffd090); }, 380);
      C.target = null; G.ph = 4; G.deathT = G.t; sfx.play("sad", "m_sad_brother");
      for (const s of G.squad) { s.protect = false; s.targetPref = "player"; if (s.ai) { s.ai.retarget = 0; s.ai.tgt = null; } }
    });
  }
  if (G.ph === 4) {
    if (G.t - G.deathT > 12) once("vengeance", () => sfx.play("combat", "m_combat_tropic"));
    if (G.t - G.deathT > 4) once("silence", () => C.comms.push({ who: "comms", text: "Halcyon to {callsign}. We've lost Ricochet's transponder. ...Those fighters are turning toward you. Weapons free." }));
    const alive = G.squad.filter(s => s.alive);
    // a silent, generous clock: after it, the survivors run for their ship
    if (!G.fled && alive.length && G.t - G.deathT > 210) { G.fled = true; for (const s of alive) s.fleeing = 9; }
    if (!alive.length) { if (!G.fled) C.stats.ghostSquadron = true; G.ph = 5; G.endT = G.t; sfx.play("sad", "m_sad_leap"); }
  }
  if (G.ph === 5 && G.t - G.endT > 3) {
    G.ph = 6; C.scriptHold = false;
    if (G.shroud && G.shroud.alive) { explode(G.shroud.pos, 600, 0x9a70ff); G.shroud.remove(); }
    C.msgs.push({ t: 4, text: "UNKNOWN VESSEL HAS JUMPED OUT" });
    C.comms.push({ who: "comms", text: "Halcyon to {callsign}. The contact has jumped. ...Come home, {rank}. Come home." });
    C.cleared = true; (C.stats.navs[1] = C.stats.navs[1] || {}).cleared = true; C.msgs.push({ t: 4, text: "NAV 1 SECURE — AUTOPILOT AVAILABLE" });
  }
}
function scripted(fn) {
  if (fn === "escortJump") { setTimeout(() => { for (const e of C.escorts) if (e.alive) { explode(e.pos, 30, 0x80c0ff); e.safe = true; e.remove(); } }, 6000); }
  if (fn === "marinesDone") { const m = C.ents.find(e => e.id === "marines" && e.alive); if (m) { m.safe = true; m.leaving = 1; } }
  if (fn === "sparkRam") {
    const sp = C.wing.find(w => w.pilot === "spark" && w.alive); const tgt = C.ents.find(e => e.id === "gharzen" && e.alive);
    if (sp && tgt) { sp.ram = tgt; sp.protect = true; } else C.sparkDone = true;
  }
  if (fn === "finale") { C.finaleT = 9; C.msgs.push({ t: 6, text: "SHOCKWAVE INBOUND — BURN FOR ESCAPE" }); }
}

export function evaluate(landed) {
  const ms = C.mission, out = [];
  let critical = true, clears = 0, clearN = 0;
  ms.navs.forEach((nav, i) => {
    const st = C.stats.navs[i] || {};
    if (nav.obj === "clear") { clearN++; const ok = !!st.cleared; if (ok) clears++; out.push([`${nav.name}: clear hostiles`, ok]); }
    if (nav.obj === "destroy" || nav.obj === "duel") { const ok = C.stats.deadIds.has(nav.target); out.push([`${nav.name}: destroy ${SHIPS[nav.target]?.name || CAST[nav.target]?.name || nav.target}`, ok]); if (!ok && nav.obj === "destroy") critical = false; if (!ok && nav.obj === "duel") critical = false; }
    if (nav.obj === "protect" && !ms.protect) { const ids = (nav.friends || []).filter(f => f.type !== "halcyon" && f.type !== "station").map(f => f.id); const ok = ids.length ? ids.some(id => !C.stats.deadIds.has(id)) && st.visited : true; out.push([`${nav.name}: protect friendlies`, ok]); if (!ok) critical = false; }
  });
  if (ms.protect) {
    const alive = ms.protect.filter(id => !C.stats.deadIds.has(id)).length; const ok = alive >= (ms.protectMin || ms.protect.length);
    out.push([`Protect ${ms.protect.map(id => SHIPS[id]?.name || (ms.escort || []).find(e => e.id === id)?.name || C.ents.find(e => e.id === id)?.name || id).join(", ")}`, ok]);
    if (!ok) critical = false;
  }
  if (ms.defend) { const ok = !!(C.stats.navs[0] || {}).cleared; out.push(["Repel the attack", ok]); if (!ok) critical = false; }
  if (ms.id === "m6") { critical = !!(C.stats.navs[1] || {}).cleared; }
  const visitedAll = ms.navs.every((n, i) => C.stats.navs[i] && C.stats.navs[i].visited) || ms.defend || ms.final;
  out.push(["Complete all nav points", visitedAll]);
  if (!ms.final) out.push(["Land safely aboard the Halcyon", !!landed]);
  const success = critical && visitedAll && (clearN === 0 || clears / clearN >= 0.5) && (landed || ms.final);
  return { success, list: out };
}

function endMission(how) {
  if (C.result) return;
  const ev = evaluate(how === "landed" || how === "final");
  if (how === "kia") ev.success = false;
  if (how === "eject") ev.success = false;
  C.stats.time = (C.t || 0) - (C.stats.t0 || 0);
  { const p = C.player; C.stats.hullEnd = p && p.coreMax ? Math.max(0, p.core / p.coreMax) : 0; }
  C.result = { how, ...ev, stats: C.stats };
  C.state = "ended"; exitPointer(); voice.stop(); sfx.engine(0, false); C.comms = []; C.curComm = null; C.commsOpen = false;
  C.onEnd && C.onEnd(C.result);
}
export function abortMission() { endMission("abort"); }
export function finishMission(how) { endMission(how); }
export function debugNav(i) { loadNav(i); C.stats.navs[i] = C.stats.navs[i] || { visited: true }; C.state = "flight"; }

// ======================================================================= FLIGHT
function flyShip(s, ctl, dt) {
  const d = s.def;
  const rateMul = s.dmg && s.dmg.engine ? 0.7 : 1;
  const tgtAv = _a.set(ctl.pitch * d.pitch * DEG, ctl.yaw * d.yaw * DEG, ctl.roll * d.roll * DEG).multiplyScalar(rateMul);
  s.av.lerp(tgtAv, Math.min(1, dt * (s.isPlayer ? 5 : 4)));
  _q.setFromEuler(new THREE.Euler(s.av.x * dt, s.av.y * dt, s.av.z * dt, "YXZ")); s.q.multiply(_q).normalize();
  let maxV = d.speed * K * (s.dmg && s.dmg.engine ? 0.6 : 1);
  const ab = ctl.ab && s.fuel > 0 && !s.cloaked;
  if (ab) { maxV = d.ab * K; if (s.isPlayer) s.fuel = Math.max(0, s.fuel - dt * 7); }
  if (s.cloaked) s.fuel = Math.max(0, s.fuel - dt * 3.5);
  s.abOn = ab;
  const want = ab ? maxV : clamp(s.setSpeed, 0, maxV);
  const acc = d.accel * K * (ab ? 2.2 : 1);
  s.speed += clamp(want - s.speed, -acc * dt * 1.4, acc * dt);
  const f = s.forward(_b);
  if (ctl.slide && s.isPlayer) { const m = s.vel.length(); s.vel.setLength(Math.max(m, 0.01)); s.vel.lerp(_c.copy(s.vel).setLength(s.speed), dt); }
  else s.vel.lerp(_c.copy(f).multiplyScalar(s.speed), Math.min(1, dt * 3.2));
  s.pos.addScaledVector(s.vel, dt);
  // engine glow
  const k = 0.5 + (s.speed / (d.speed * K)) * 0.6 + (ab ? 0.9 : 0);
  for (const e of s.m.eng || []) e.scale.setScalar(e.userData.base * k * (0.92 + Math.random() * 0.16));
}

function fireGuns(s, inheritVel) {
  if (s.gunCd > 0 || s.cloaked) return false;
  const usable = s.guns.filter(g => g.ok);
  if (!usable.length) return false;
  const list = s.gunMode === 0 ? usable : [usable[s.gunAlt++ % usable.length]];
  let cost = list.reduce((a, g) => a + GUNS[g.type].energy, 0);
  if (s.energy < cost) return false;
  s.energy -= cost;
  const f = s.forward(_b);
  // convergence for player
  let conv = 600; if (s.isPlayer && C.target && C.target.alive) conv = clamp(C.target.pos.distanceTo(s.pos), 120, 1400);
  for (const g of list) {
    const o = g.pos.clone().applyQuaternion(s.q).add(s.pos);
    const aimP = _a.copy(s.pos).addScaledVector(f, conv);
    const dir = aimP.sub(o).normalize();
    if (!s.isPlayer) dir.add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.012 * (1.2 - s.ai.skill))).normalize();
    fireBolt(s, o, dir, g.type, inheritVel || s.vel);
    spawnPart(o, s.vel, 0.06, 1.5, 3, GUNS[g.type].color, 0x000000, 1, true);
  }
  s.gunCd = Math.max(...list.map(g => GUNS[g.type].rof)) * (s.gunMode === 0 ? 1 : 0.5);
  if (s.isPlayer) { C.stats.shots += list.length; sfx.gun(list[0].type); } else sfx.gun(list[0].type, s.pos);
  return true;
}

// ---------- missiles
function launchMissile(s, type, tgt) {
  const def = MISSILES[type]; if (!def || !(s.mis[type] > 0)) return false;
  s.mis[type]--; if (s.isPlayer) C.stats.missiles++;
  const g = new THREE.Group();
  const big = type === "torp" || type === "shear";
  const body = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.7 : 0.3, big ? 0.7 : 0.3, big ? 6 : 3, 8), new THREE.MeshStandardMaterial({ color: type === "shear" ? 0xd0d0e0 : 0xb0b0b0, metalness: 0.8, roughness: 0.3 }));
  body.rotation.x = Math.PI / 2; g.add(body);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.tex().glow, color: type === "shear" ? 0x80ffff : 0xffa050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  fl.scale.setScalar(big ? 12 : 6); fl.position.z = big ? 3.5 : 1.8; g.add(fl);
  const f = s.forward(tv());
  g.position.copy(s.pos).addScaledVector(s.up(_a), -2.5).addScaledVector(f, 3); g.quaternion.copy(s.q);
  C.world.add(g);
  const m = { mesh: g, pos: g.position, vel: f.clone().multiplyScalar(s.speed + def.speed * K * 0.4), type, def, owner: s, team: s.team, target: tgt, life: def.life, trail: 0, hp: big ? 20 : 4 };
  if (type === "ff") m.target = null;
  if (def.seek === "none") m.target = null;
  C.missiles.push(m);
  if (s.isPlayer) sfx.missile(type); else sfx.missile(type, s.pos);
  if (m.target && m.target.isPlayer) { C.incoming = 2; }
  return true;
}
function updMissiles(dt) {
  for (const m of C.missiles) {
    m.life -= dt;
    if (m.def.seek === "auto" && (!m.target || !m.target.alive)) {
      let best = null, bd = 2500; for (const e of C.ents) if (e.alive && !e.comp && !e.isCap && e.team !== m.team) { const d = e.pos.distanceTo(m.pos); if (d < bd) { bd = d; best = e; } } m.target = best;
    }
    const sp = m.def.speed * K;
    if (m.target && m.target.alive !== false && m.def.turn > 0) {
      const tp = m.target.pos; const dist = tp.distanceTo(m.pos);
      const lead = _a.copy(tp).addScaledVector(m.target.vel || tv(), Math.min(2, dist / sp) * 0.7);
      const want = lead.sub(m.pos).normalize(); const cur = m.vel.clone().normalize();
      const ang = cur.angleTo(want); const maxT = m.def.turn * dt;
      if (ang > 1e-4) { const k = Math.min(1, maxT / ang); cur.lerp(want, k).normalize(); }
      m.vel.copy(cur).multiplyScalar(Math.min(sp, m.vel.length() + sp * dt * 2));
      const hitR = (m.target.radius || 6) * (m.target.isCap ? 1 : 0.8) + 4;
      if (m.target.isCap ? insideCap(m.target, m.pos, 1.05) : dist < hitR) { missileHit(m, m.target); continue; }
    } else { m.vel.setLength(Math.min(sp, m.vel.length() + sp * dt * 2)); }
    m.pos.addScaledVector(m.vel, dt);
    m.mesh.quaternion.setFromUnitVectors(new V3(0, 0, -1), _b.copy(m.vel).normalize());
    // proximity for dumbfire / non-target hits
    if (m.def.seek === "none" || !m.target) for (const e of C.ents) { if (!e.alive || e.comp || e.team === m.team) continue; if (e.isCap ? insideCap(e, m.pos, 1) : e.pos.distanceTo(m.pos) < e.radius + 3) { missileHit(m, e); break; } }
    m.trail -= dt; if (m.trail <= 0 && m.life > 0) { m.trail = 0.025; spawnPart(m.pos, _a.copy(m.vel).multiplyScalar(-0.05), 0.9, m.type === "torp" ? 3 : 1.4, m.type === "torp" ? 9 : 5, 0xbbbbbb, 0x303030, 0.35); }
    if (m.life <= 0) { explode(m.pos, 4, 0xffb060); m.dead = true; C.world.remove(m.mesh); }
  }
  C.missiles = C.missiles.filter(m => !m.dead);
}
function missileHit(m, tgt) {
  m.dead = true; C.world.remove(m.mesh);
  if (tgt.decoy) { explode(m.pos, 8); return; }
  explode(m.pos, m.type === "torp" ? 26 : m.type === "shear" ? 40 : 10, m.type === "shear" ? 0x80ffff : 0xffa040);
  if (m.type === "shear") { if (tgt.def && tgt.def.shearOnly) kill(tgt, m.owner); return; }
  damage(tgt, m.def.dmg, m.pos, m.owner, m.type === "torp" ? "torp" : "missile");
}
function dropDecoy(s) {
  if (!(s.decoys > 0)) return; s.decoys--;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.tex().glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.scale.setScalar(10); sp.position.copy(s.pos).addScaledVector(s.forward(_a), -8); C.world.add(sp);
  const d = { decoy: true, s: sp, pos: sp.position, vel: s.vel.clone().multiplyScalar(0.3), life: 4, alive: true, radius: 6, team: s.team };
  C.decoys.push(d);
  for (const m of C.missiles) if (m.target === s && m.pos.distanceTo(s.pos) < 1500 && Math.random() < (m.type === "ff" ? 0.35 : m.type === "torp" ? 0.2 : 0.7)) m.target = d;
  if (s.isPlayer) { sfx.cue("u_decoy", 0.55, {}, 1600, 0.05, 0.08); sfx.cue("m_launch", 0.25, { rate: 1.7 }); }
}
function updDecoys(dt) { for (const d of C.decoys) { d.life -= dt; d.pos.addScaledVector(d.vel, dt); d.s.material.opacity = Math.max(0, d.life / 4) * (0.6 + Math.random() * 0.4); if (Math.random() < 0.3) spawnPart(d.pos, tv(), 0.3, 3, 6, 0xffffff, 0xff6010, 0.6, true); if (d.life <= 0) { d.alive = false; C.world.remove(d.s); } } C.decoys = C.decoys.filter(d => d.life > 0); }

// ---------- damage
function insideCap(s, p, k = 1) {
  const l = _c.copy(p).sub(s.pos).applyQuaternion(_q.copy(s.q).invert());
  return l.x > s.bmin.x * k && l.x < s.bmax.x * k && l.y > s.bmin.y * k && l.y < s.bmax.y * k && l.z > s.bmin.z * k && l.z < s.bmax.z * k;
}
// ---- impact kinetics on the player: directional jolt, smoothed shake, thud, hit-direction arcs, canopy cracks
function playerHitFx(pl, amt, at, src, shieldOnly) {
  const d = (src && src.pos ? src.pos.clone() : at.clone()).sub(pl.pos).applyQuaternion(_q.copy(pl.q).invert()).normalize();
  const k = clamp(amt / 18, 0.35, 1);
  C.shake = Math.min(0.8, (C.shake || 0) + (shieldOnly ? amt / 70 : amt / 26));
  // the nose is knocked away from the impact, then springs back
  const kk = C.kick || (C.kick = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
  const s = (shieldOnly ? 0.6 : 1.4) * k;
  kk.vx += -d.y * s; kk.vy += d.x * s; kk.vz += (Math.random() - 0.5) * s * 0.8;
  sfx.thud(shieldOnly ? 0.45 * k : 1.0 * k);
  (C.hitDirs || (C.hitDirs = [])).push({ a: Math.atan2(-d.y, d.x), behind: d.z > 0.2, t: 1.5, hull: !shieldOnly, k });
  if (C.hitDirs.length > 8) C.hitDirs.shift();
  if (!shieldOnly) addCrack(d, amt);
}
function addCrack(d, amt) {
  const cr = C.cracks || (C.cracks = { list: [], cv: null, w: 0, h: 0 });
  if (cr.list.length >= 14) cr.list.shift();
  // land roughly where the shot came from (behind: anywhere near the canopy rim)
  let u, v; if (d.z < 0.2) { u = 0.5 + d.x * 0.42 + (Math.random() - 0.5) * 0.18; v = 0.45 - d.y * 0.36 + (Math.random() - 0.5) * 0.16; }
  else { const a = Math.random() * Math.PI * 2; u = 0.5 + Math.cos(a) * 0.4; v = 0.42 + Math.sin(a) * 0.3; }
  cr.list.push({ u: clamp(u, 0.06, 0.94), v: clamp(v, 0.06, 0.7), r: clamp(0.05 + amt / 260, 0.06, 0.16), seed: Math.random() * 1e6 | 0 });
  cr.w = 0;   // force a redraw
}
function paintCracks(W, H) {
  const cr = C.cracks; if (!cr || !cr.list.length) return null;
  if (cr.cv && cr.w === W && cr.h === H) return cr.cv;
  const cv = cr.cv || (cr.cv = document.createElement("canvas")); cv.width = W; cv.height = H; cr.w = W; cr.h = H;
  const x = cv.getContext("2d"); x.clearRect(0, 0, W, H); x.lineCap = "round"; x.lineJoin = "round";
  for (const c of cr.list) {
    let s = c.seed; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const cx = c.u * W, cy = c.v * H, r = c.r * Math.min(W, H) * 1.6;
    const fog = x.createRadialGradient(cx, cy, 0, cx, cy, r * 0.45); fog.addColorStop(0, "rgba(210,225,240,.16)"); fog.addColorStop(1, "rgba(210,225,240,0)"); x.fillStyle = fog; x.beginPath(); x.arc(cx, cy, r * 0.45, 0, 7); x.fill();
    const arms = 7 + (R() * 5 | 0), ends = [];
    const line = (pts, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke(); };
    for (let i = 0; i < arms; i++) {
      let a = (i / arms) * Math.PI * 2 + (R() - 0.5) * 0.5, px = cx, py = cy; const len = r * (0.45 + R() * 0.6), segs = 5 + (R() * 4 | 0), pts = [[px, py]];
      for (let j = 0; j < segs; j++) { a += (R() - 0.5) * 0.5; const L = len / segs * (0.7 + R() * 0.6); px += Math.cos(a) * L; py += Math.sin(a) * L; pts.push([px, py]);
        if (R() < 0.3 && j > 0) { let ba = a + (R() < 0.5 ? 1 : -1) * (0.4 + R() * 0.6), bx = px, by = py; const bp = [[bx, by]]; for (let q = 0; q < 3; q++) { ba += (R() - 0.5) * 0.4; bx += Math.cos(ba) * L * 0.6; by += Math.sin(ba) * L * 0.6; bp.push([bx, by]); } line(bp.map(([p, q]) => [p + 1, q + 1]), 1.2, "rgba(0,0,0,.3)"); line(bp, 0.9, "rgba(225,235,250,.45)"); } }
      ends.push(pts); line(pts.map(([p, q]) => [p + 1, q + 1]), 2.2, "rgba(0,0,0,.35)"); line(pts, 1.5, "rgba(235,242,255,.6)");
    }
    // concentric spider-web rings between neighbouring arms
    for (const f of [0.22, 0.45, 0.7]) { if (R() < 0.25) continue; for (let i = 0; i < ends.length; i++) { if (R() < 0.35) continue; const A = ends[i], B = ends[(i + 1) % ends.length]; const ia = Math.min(A.length - 1, Math.round(A.length * f)), ib = Math.min(B.length - 1, Math.round(B.length * f)); const m = [(A[ia][0] + B[ib][0]) / 2 + (R() - 0.5) * 6, (A[ia][1] + B[ib][1]) / 2 + (R() - 0.5) * 6]; line([A[ia], m, B[ib]], 1.0, "rgba(225,235,250,.4)"); } }
    // impact chip
    x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.arc(cx, cy, Math.max(2, r * 0.04), 0, 7); x.fill();
    x.fillStyle = "rgba(20,24,30,.5)"; x.beginPath(); x.arc(cx, cy, Math.max(1, r * 0.018), 0, 7); x.fill();
  }
  return cv;
}
export function damage(t, amt, at, src, kind = "gun") {
  if (!t.alive) return;
  if (t.comp) { t.hp -= amt; spawnPart(at, tv(), 0.3, 3, 8, 0xffd080, 0x803010, 1, true); if (t.hp <= 0) killComp(t, src); return; }
  if (src && src.isPlayer) C.stats.hits++;
  if (t.isCap) {
    if (t.def.shearOnly) return;
    let mult = kind === "torp" || kind === "ram" ? 1 : (t.gen && t.gen.alive) ? 0.06 : t.def.corvette || t.def.small ? 1 : 0.35;
    if (t.def.shieldGen && t.gen && t.gen.alive && kind === "missile") mult = 0.15;
    t.hull -= amt * mult; t.lastAttacker = src;
    spawnPart(at, tv(), 0.25, 3, 10, kind === "torp" ? 0xffffff : 0xffc080, 0x602010, 1, true);
    if (t.protect && t.hull < t.hullMax * 0.1) t.hull = t.hullMax * 0.1;
    if (t.hull <= 0) kill(t, src);
    return;
  }
  t.lastHit = C.t; t.lastAttacker = src;
  const l = _c.copy(at).sub(t.pos).applyQuaternion(_q.copy(t.q).invert());
  const front = l.z < 0; const si = front ? 0 : 1;
  let rem = amt;
  const sh = Math.min(t.sh[si], rem); t.sh[si] -= sh; rem -= sh;
  if (rem > 0) {
    const ai = Math.abs(l.x) > Math.abs(l.z) ? (l.x < 0 ? 2 : 3) : (front ? 0 : 1);
    const a = Math.min(t.ar[ai], rem); t.ar[ai] -= a; rem -= a;
    if (rem > 0) { t.core -= rem; if (t.isPlayer && Math.random() < 0.35) { const sys = pick(["guns", "engine", "radar", "itts", "shields", "comms"]); if (!t.dmg[sys]) { t.dmg[sys] = true; C.msgs.push({ t: 3, text: "DAMAGE: " + { guns: "GUN MOUNT", engine: "ENGINE", radar: "RADAR", itts: "ITTS", shields: "SHIELD GENERATOR", comms: "COMMS" }[sys] }); if (sys === "guns") { const g = t.guns.find(g => g.ok); if (g && t.guns.filter(x => x.ok).length > 1) g.ok = false; } } } }
  }
  if (t.isPlayer) { playerHitFx(t, amt, at, src, sh >= amt); C.hitFlash = rem > 0 || sh < amt ? "armor" : "shield"; C.hitFlashT = 0.25; sfx.hit(sh >= amt); rumble(Math.min(1, amt / 25), 140); C.stats.hitsTaken += amt; if (t.core < t.coreMax * 0.5) C.stats.wounded = true; }
  else spawnPart(at, t.vel, 0.2, 2, 6, sh >= amt ? 0x80c0ff : 0xffb060, 0x000000, 1, true);
  if (t.protect && t.core < 5) t.core = 5;
  if (t.core <= 0) {
    if (t.wingman && !t.protect) { ejectWing(t); return; }
    kill(t, src);
  }
  if (t.ace && t.healthFrac() < 0.25 && !t.fleeing && t.pilot !== "kaerr" && t.pilot !== "shkara") { t.fleeing = 14; C.comms.push({ who: t.pilot, text: t.pilot === "ember" ? "Not like this... not by your hand. I am leaving, my friend." : "You have not won, human!" }); }
  if (t.ace && t.pilot === "kaerr" && t.healthFrac() < 0.2 && !t.fleeing) { t.fleeing = 12; C.comms.push({ who: "kaerr", text: "Enough! I will finish you on Kethra, hunter!" }); }
}
function ejectWing(t) {
  t.alive = false; explode(t.pos, 12); C.world.remove(t.obj);
  C.comms.push({ who: t.pilot, text: pick(["I'm hit bad! Punching out!", "Ejecting! Somebody tell SAR where I am!", "Lost it, I'm out! Ejecting!"]) });
  C.stats.ejected.push(t.pilot);
}
function killComp(c, src) {
  c.alive = false; explode(c.pos, c.kind === "gen" ? 24 : 12);
  c.obj.visible = false;
  if (c.kind === "gen") { C.msgs.push({ t: 3, text: c.parent.name.toUpperCase() + " SHIELDS DOWN" }); if (src && src.isPlayer) C.comms.push({ who: pick(C.wing.filter(w => w.alive).map(w => w.pilot)) || "comms", text: "Shield generator's gone! Guns will hurt it now!" }); }
}
export function kill(t, src) {
  if (!t.alive) return;
  t.alive = false; C.stats.deadIds.add(t.id);
  if (t.pilot && t.pilot !== "player") C.stats.deadIds.add(t.pilot);
  if (src && src.isPlayer && t.team !== "concord") {
    C.stats.kills++; C.stats.killsBy[t.type] = (C.stats.killsBy[t.type] || 0) + 1; if (t.ace) C.stats.aceKills.push(t.pilot);
    if (Math.random() < 0.5 && !t.isCap) { const w = C.wing.find(w => w.alive); if (w) C.comms.push({ who: w.pilot, text: pick(["Nice shot!", "Scratch one!", "Good kill!", "That's one for the board!", "He's toast!"]) }); }
  } else if (src && src.wingman && t.team !== "concord") { C.stats.wingKills[src.pilot] = (C.stats.wingKills[src.pilot] || 0) + 1; if (Math.random() < 0.5) C.comms.push({ who: src.pilot, text: pick(["Got one!", "Splash one!", "Target destroyed.", "That one won't be bothering anybody."]) }); }
  if (t.team === "concord" && !t.wingman && !t.isPlayer && t.isCap && !t.def.small) C.comms.push({ who: "comms", text: `${t.name} is breaking up! We've lost her!` });
  if (t.team === "concord" && t.def && (t.def.small || t.escort)) C.msgs.push({ t: 3, text: t.name.toUpperCase() + " DESTROYED" });
  if (C.target === t) C.target = null;
  if (t.isCap) { t.dying = t.def.size > 600 ? 6 : 3.5; t.alive = false; t.comps.forEach(c => c.alive = false); C.dyingCaps = (C.dyingCaps || []).concat([t]); return; }
  explode(t.pos, t.def.size * 1.1, t.team === "vharr" ? 0xff8030 : 0xffb060, t.vel);
  debris(t);
  if (t.isPlayer) { C.dead = true; C.deadT = 0; C.view = "chase"; }
  C.world.remove(t.obj);
}
function debris(t) {
  const n = 6; const mat = t.obj.children.find(c => c.isMesh)?.material;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(rand(0.5, 2.5), rand(0.3, 1.2), rand(0.5, 3)), mat);
    m.position.copy(t.pos); C.world.add(m);
    const v = t.vel.clone().add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(40)); const av = new V3(rand(-4, 4), rand(-4, 4), rand(-4, 4));
    C.debris = (C.debris || []).concat([{ m, v, av, life: 6 }]);
  }
}
export function updDebris(dt) {
  for (const d of C.debris || []) { d.life -= dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.av.x * dt; d.m.rotation.y += d.av.y * dt; if (Math.random() < 0.2 && d.life > 3) spawnPart(d.m.position, tv(), 0.6, 1, 4, 0xff8030, 0x202020, 0.6); if (d.life <= 0) C.world.remove(d.m); }
  C.debris = (C.debris || []).filter(d => d.life > 0);
  for (const s of C.dyingCaps || []) {
    s.dying -= dt;
    if (Math.random() < dt * 9) { const p = new V3(rand(s.bmin.x, s.bmax.x), rand(s.bmin.y, s.bmax.y), rand(s.bmin.z, s.bmax.z)).applyQuaternion(s.q).add(s.pos); explode(p, rand(14, 40)); }
    if (s.dying <= 0) { explode(s.pos, s.def.size * 0.25, 0xffffff); for (let i = 0; i < 8; i++) explode(_a.copy(s.pos).add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(s.def.size * 0.3)), s.def.size * 0.08); C.world.remove(s.obj); s.gone = true; C.shake = 1; }
  }
  C.dyingCaps = (C.dyingCaps || []).filter(s => !s.gone);
}

// ---------- bolts
const segDist = (p, a, b) => { const ab = _a.copy(b).sub(a); const t = clamp(_b.copy(p).sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1); return _c.copy(a).addScaledVector(ab, t).distanceTo(p); };
function updBolts(dt) {
  const prev = tv();
  for (const b of C.boltPool) {
    if (b.life <= 0) continue;
    b.life -= dt; if (b.life <= 0) { b.m.visible = false; continue; }
    prev.copy(b.pos); b.pos.addScaledVector(b.vel, dt);
    let hit = null;
    for (const e of C.ents) {
      if (!e.alive || e === b.owner || (e.comp && e.parent === b.owner)) continue;
      if (e.team === b.team && !(b.owner && b.owner.isPlayer)) continue;
      if (e.comp) { if (segDist(e.pos, prev, b.pos) < e.radius) { hit = e; break; } continue; }
      if (e.isCap) { if (e === b.owner) continue; if (insideCap(e, b.pos)) { hit = e; for (const c of e.comps) if (c.alive && c.pos.distanceTo(b.pos) < c.radius * 1.6) { hit = c; break; } break; } continue; }
      if (segDist(e.pos, prev, b.pos) < e.radius * 0.85) { hit = e; break; }
    }
    if (!hit) for (const m of C.missiles) if ((m.type === "torp") && m.team !== b.team && segDist(m.pos, prev, b.pos) < 7) { m.hp -= b.dmg; if (m.hp <= 0) { m.dead = true; C.world.remove(m.mesh); explode(m.pos, 12); } b.life = 0; b.m.visible = false; break; }
    if (hit) {
      if (hit.team === "concord" && b.owner && b.owner.isPlayer && hit.wingman && Math.random() < 0.2) C.comms.push({ who: hit.pilot, text: pick(["Watch your fire!", "Hey! I'm on your side!", "Check your fire, Lieutenant!"]) });
      damage(hit, b.dmg, b.pos, b.owner, "gun"); b.life = 0; b.m.visible = false;
    }
  }
}

// ======================================================================= AI
function steerTo(s, point, dt, ctl, aggr = 1) {
  const l = _a.copy(point).sub(s.pos).applyQuaternion(_q.copy(s.q).invert());
  const len = l.length() || 1;
  const k = 2.6 * aggr;
  ctl.yaw = clamp(-l.x / len * k * 2, -1, 1);
  ctl.pitch = clamp(l.y / len * k * 2, -1, 1);
  if (l.z > 0) { ctl.yaw = Math.abs(l.x) < 1 ? 1 : Math.sign(-l.x); }
  ctl.roll = clamp(-l.x / len * 1.2, -0.7, 0.7);
  return Math.acos(clamp(-l.z / len, -1, 1));
}
function leadPoint(src, tgt, speed) {
  const d = tgt.pos.distanceTo(src.pos); const t = d / speed;
  return _b.copy(tgt.pos).addScaledVector(_c.copy(tgt.vel || tv()).sub(src.vel), t);
}
function nearestHostile(s, range = 6000, filt) {
  let best = null, bd = range;
  for (const e of C.ents) {
    if (!e.alive || e.comp || e.team === s.team || e.cloaked || e.def.shearOnly) continue;
    if (filt && !filt(e)) continue;
    let d = e.pos.distanceTo(s.pos); if (e.isCap) d *= 2.2; if (e.isPlayer && s.team === "vharr") d *= 0.8;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function aiFighter(s, dt) {
  const ai = s.ai, ctl = { pitch: 0, yaw: 0, roll: 0, ab: false };
  ai.t -= dt; s.gunCd -= dt; s.energy = Math.min(s.energyMax, s.energy + dt * s.energyMax * 0.25);
  for (let i = 0; i < 2; i++) if (C.t - s.lastHit > 3) s.sh[i] = Math.min(s.shMax[i], s.sh[i] + dt * 4);
  // scripted ram
  if (s.ram) {
    const p = s.ram.pos.clone().add(new V3(0, 40, -120).applyQuaternion(s.ram.q));
    steerTo(s, p, dt, ctl, 2); s.setSpeed = s.def.ab * K; ctl.ab = true; s.fuel = 100;
    if (insideCap(s.ram, s.pos, 1.0) || s.pos.distanceTo(p) < 60) { const tg = s.ram; s.ram = null; s.protect = false; kill(s, null); C.stats.deadIds.add("spark"); damage(tg, tg.hullMax * 1.5, s.pos, C.player, "ram"); C.sparkDone = true; for (let i = 0; i < 6; i++) explode(_a.copy(s.pos).add(new V3(rand(-60, 60), rand(-30, 30), rand(-60, 60))), 40); }
    flyShip(s, ctl, dt); return;
  }
  // scripted: flying off alone, or drifting dead in space
  if (s.disabled) { s.setSpeed = 0; s.fuel = 0; ctl.roll = 0.08; ctl.pitch = 0.03; flyShip(s, ctl, dt); return; }
  if (s.scriptGoto) { const dd = s.pos.distanceTo(s.scriptGoto); if (dd > 250) steerTo(s, s.scriptGoto, dt, ctl, 1.2); s.fuel = 100; ctl.ab = dd > 600; s.setSpeed = dd > 600 ? s.def.ab * K : dd > 250 ? s.def.speed * K * 0.4 : 0; flyShip(s, ctl, dt); return; }
  // leaving (scripted)
  if (s.fleeing !== undefined && s.fleeing !== false) {
    s.fleeing -= dt; const away = s.pos.clone().add(s.pos.clone().sub(C.player.pos).normalize().multiplyScalar(1000));
    steerTo(s, away, dt, ctl); ctl.ab = true; s.fuel = 100; s.setSpeed = s.def.ab * K; flyShip(s, ctl, dt);
    if (s.fleeing <= 0) { explode(s.pos, 20, 0x80c0ff); s.remove(); C.stats.deadIds.add("fled:" + s.id); C.msgs.push({ t: 3, text: s.name.toUpperCase() + " HAS JUMPED OUT" }); }
    return;
  }
  // ---------- target selection
  if (ai.retarget === undefined || ai.retarget <= 0 || !ai.tgt || !ai.tgt.alive || ai.tgt.cloaked) {
    ai.retarget = rand(4, 8);
    let tgt = null;
    if (s.wingman) {
      const order = C.wingOrder;
      if (order === "attack" && C.target && C.target.alive && C.target.team !== "concord") tgt = C.target.comp ? C.target.parent : C.target;
      else if (order === "help") tgt = C.ents.find(e => e.alive && !e.comp && e.team === "vharr" && e.ai && e.ai.tgt === C.player) || nearestHostile(s, 4000, e => !e.isCap);
      else if (order === "form") tgt = null;
      else {
        const bomber = C.ents.find(e => e.alive && e.def.bomber && e.team === "vharr");
        tgt = bomber && Math.random() < 0.6 ? bomber : nearestHostile(s, 8000, e => !e.isCap || (s.mis.torp > 0));
        if (!tgt) tgt = nearestHostile(s, 9000);
      }
    } else if (s.team === "vharr") {
      const pref = s.targetPref;
      if (pref === "player" && !C.player.cloaked) tgt = C.player;
      else if (pref === "escort") { const es = C.ents.filter(e => e.alive && (e.escort || ["pod1", "pod2", "pod3", "rescue", "marines", "lifepod"].includes(e.id))); tgt = es.length ? pick(es) : null; }
      else if (pref && pref !== "player") tgt = C.ents.find(e => e.alive && e.id === pref) || null;
      if (!tgt || (s.def.bomber === undefined && Math.random() < 0.35)) tgt = nearestHostile(s, 9000, e => !e.isCap || s.def.bomber) || tgt;
      if (s.def.bomber && !tgt) tgt = C.carrier && C.carrier.alive ? C.carrier : nearestHostile(s);
    } else tgt = nearestHostile(s);
    ai.tgt = tgt;
  }
  ai.retarget -= dt;
  const T = ai.tgt;
  const sk = ai.skill;
  // formation
  if (!T || (s.wingman && C.wingOrder === "form")) {
    const lead = C.player; const slot = new V3(s.slot % 2 ? -50 : 50, 6, 40 + Math.floor(s.slot / 2) * 40).applyQuaternion(lead.q).add(lead.pos);
    const ang = steerTo(s, _c.copy(slot).addScaledVector(lead.forward(tv()), 120), dt, ctl, 0.8);
    const d = s.pos.distanceTo(slot); s.setSpeed = lead.speed + clamp(d - 20, -60, 200) * 0.5; ctl.ab = d > 600;
    if (s.wingman && C.wingOrder === "form") { const e = nearestHostile(s, 1200); if (e && ang < 0.1) fireGuns(s); }
    flyShip(s, ctl, dt); return;
  }
  const d = T.pos.distanceTo(s.pos);
  const gunSpeed = GUNS[s.guns[0].type].speed * K;
  // evade if hit recently or missile incoming
  const threat = C.missiles.find(m => m.target === s && m.pos.distanceTo(s.pos) < 700);
  if (threat && ai.mode !== "evade") { ai.mode = "evade"; ai.t = rand(1.2, 2.2); ai.jink.set(rand(-1, 1), rand(-1, 1), 0).normalize(); if (Math.random() < sk * 0.8) dropDecoy(s); }
  if (C.t - s.lastHit < 0.2 && ai.mode === "attack" && Math.random() < 0.08 + (1 - sk) * 0.1) { ai.mode = "evade"; ai.t = rand(0.6, 1.4); ai.jink.set(rand(-1, 1), rand(-1, 1), 0).normalize(); }
  if (ai.mode === "evade") {
    const jk = 0.45 + 0.55 * sk; ctl.pitch = ai.jink.y * jk; ctl.yaw = ai.jink.x * jk; ctl.roll = 0.5 + 0.3 * sk; ctl.ab = true; s.setSpeed = s.def.speed * K;
    if (ai.t <= 0) ai.mode = "attack";
    flyShip(s, ctl, dt); return;
  }
  if (ai.mode === "break") {
    const away = _c.copy(s.pos).add(ai.jink.clone().multiplyScalar(500)); steerTo(s, away, dt, ctl); s.setSpeed = s.def.speed * K; ctl.ab = Math.random() < 0.5;
    if (ai.t <= 0) ai.mode = "attack";
    flyShip(s, ctl, dt); return;
  }
  // bomber torpedo run / capital strafing
  if (T.isCap) {
    const aimAt = T.gen && T.gen.alive && !(s.mis.torp > 0) ? T.gen.pos : T.pos;
    const ang = steerTo(s, aimAt, dt, ctl, 0.9);
    s.setSpeed = s.def.speed * K * (d > 2500 ? 1 : 0.7); ctl.ab = d > 3500;
    if (s.mis.torp > 0) {
      if (ang < 0.25 && d < 2200) { ai.lockT += dt; if (ai.lockT > 3) { launchMissile(s, "torp", T); ai.lockT = 0; ai.mode = "break"; ai.t = 4; ai.jink.set(rand(-1, 1), 1, 0).normalize().applyQuaternion(s.q); if (T === C.carrier) C.comms.push({ who: "comms", text: "Torpedo launch! Torpedo inbound on the Halcyon! Shoot it down!" }); } } else ai.lockT = Math.max(0, ai.lockT - dt);
    } else if (ang < 0.12 && d < 1600) fireGuns(s);
    if (d < (T.radius * 0.6 + 250)) { ai.mode = "break"; ai.t = rand(2, 3.5); ai.jink.copy(s.up(tv())).multiplyScalar(1).add(new V3(rand(-1, 1), 0, rand(-1, 1))).normalize(); }
    flyShip(s, ctl, dt); return;
  }
  // dogfight: a small tactics state machine — slashing gun passes, extensions, yo-yos, defensive breaks and scissors —
  // instead of pure pursuit, which collapses into an endless tight turning circle nobody can aim at
  const vh = s.team === "vharr";
  const turnMul = vh ? clamp(0.6 + 0.5 * ((C.opts.difficulty || 1) - 0.6), 0.6, 1) : 1;   // rookie Vharr can't out-turn you
  const fw = s.forward(new V3()), toT = new V3().subVectors(T.pos, s.pos).normalize();
  const tFw = T.forward ? T.forward(new V3()) : null;
  const onMyTail = !!tFw && d < 850 && tFw.dot(toT) < -0.92 && fw.dot(toT) < 0.3;   // it's behind me and pointing at me
  ai.defCd = (ai.defCd || 0) - dt; ai.circ = ai.circ || 0; ai.attT = (ai.attT || 0) + dt;
  const go = (mode, t) => { ai.mode = mode; ai.t = t; ai.attT = 0; ai.circ = 0; };
  const steerDir = (dir, k = 1) => steerTo(s, _c.copy(s.pos).addScaledVector(dir, 800), dt, ctl, k);
  if (ai.mode === "attack" && onMyTail && ai.defCd <= 0 && Math.random() < dt * (1.2 + sk * 2.5)) {
    // defensive: break across the attacker's line of fire; good pilots follow with a reversal (scissors), others run
    const side = new V3().crossVectors(tFw, s.up(new V3())).normalize().multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    ai.brk = side.addScaledVector(s.up(new V3()), rand(-0.3, 0.6)).normalize(); go("defend", rand(1.1, 1.9)); ai.defCd = rand(3, 6) + (1 - sk) * 6;
    if (vh && Math.random() < sk * 0.5) dropDecoy(s);
  }
  if (ai.mode === "defend") {
    steerDir(ai.brk, 1.6); s.setSpeed = s.def.speed * K; ctl.ab = Math.random() < 0.6;
    if (ai.t <= 0) { if (Math.random() < 0.25 + sk * 0.5) { ai.brk.negate(); go("reverse", rand(0.9, 1.5)); } else { ai.ext = fw.clone().addScaledVector(toT, -0.4).normalize(); go("extend", rand(2, 3.5)); } }
    flyShip(s, ctl, dt); return;
  }
  if (ai.mode === "reverse") { steerDir(ai.brk, 1.6); s.setSpeed = s.def.speed * K * 0.85; if (ai.t <= 0) go("attack", 0); flyShip(s, ctl, dt); return; }
  if (ai.mode === "extend") {
    // run out straight and fast to open the range, then turn back in for another slashing pass
    steerDir(ai.ext, 0.5); s.setSpeed = s.def.speed * K; ctl.ab = !vh || Math.random() < 0.5 + sk * 0.4;
    if (ai.t <= 0 || d > 1000 + sk * 600) go("attack", 0);
    flyShip(s, ctl, dt); return;
  }
  if (ai.mode === "yoyo") {
    // high yo-yo: climb out of the turn, then roll back down onto the target
    steerDir(ai.ext, 1); s.setSpeed = s.def.speed * K * 0.9;
    if (ai.t <= 0) go("attack", 0);
    flyShip(s, ctl, dt); return;
  }
  // attack: lead pursuit for a limited time
  const lp = leadPoint(s, T, gunSpeed).clone();
  const jitter = (1 - sk) * 60; lp.x += Math.sin(C.t * 1.7 + s.uid) * jitter; lp.y += Math.cos(C.t * 1.3 + s.uid) * jitter;
  const ang = steerTo(s, lp, dt, ctl, 0.7 + sk * 0.6);
  ctl.pitch *= turnMul; ctl.yaw *= turnMul;
  const tspd = T.speed || 0;
  s.setSpeed = d > 900 ? s.def.speed * K : Math.max(Math.min(tspd, s.def.speed * K), s.def.speed * K * 0.8);   // never slow down to tighten the circle
  ctl.ab = d > 2200 || (d > 900 && Math.random() < 0.02);
  if (ang < 0.035 + (1 - sk) * 0.05 + 6 / Math.max(d, 1) && d < GUNS[s.guns[0].type].range * 0.9) fireGuns(s);
  // stuck in a turning fight (close, can't bring the nose round): break it off — extend or yo-yo
  if (d < 750 && ang > 0.6) ai.circ += dt; else ai.circ = Math.max(0, ai.circ - dt);
  if (ai.circ > 2.2 + sk * 1.2) { if (Math.random() < 0.55) { ai.ext = fw.clone().addScaledVector(toT, -0.5).add(new V3(0, rand(-0.3, 0.3), 0)).normalize(); go("extend", rand(2.2, 4)); } else { ai.ext = s.up(new V3()).multiplyScalar(1.2).add(fw).normalize(); go("yoyo", rand(1.2, 2)); } }
  // a slashing pass that has gone on too long at close range: pull off and set up the next one
  else if (ai.attT > rand(6, 10) && d < 500) { ai.ext = fw.clone().normalize(); go("extend", rand(1.8, 3)); }
  // missiles
  ai.misT -= dt;
  const misKeys = Object.keys(s.mis).filter(k => s.mis[k] > 0 && k !== "torp");
  if (misKeys.length && ang < 0.35 && d < 1500 && d > 250) { ai.lockT += dt; if (ai.lockT > 1.8 && ai.misT <= 0) { launchMissile(s, pick(misKeys), T); ai.misT = rand(8, 16) / (0.5 + sk); ai.lockT = 0; if (T.isPlayer && s.team === "vharr" && Math.random() < 0.4) C.comms.push({ who: s.pilot || "vharrpilot", text: pick(["The hunt ends now!", "Run, little prey!", "Your blood for my name!"]) }); } } else ai.lockT = Math.max(0, ai.lockT - dt * 0.5);
  if (d < 140 && ang < 0.6) { ai.mode = "break"; ai.t = rand(0.8, 1.8); ai.jink.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); }
  flyShip(s, ctl, dt);
}
function aiCapital(s, dt) {
  // movement
  if (s.leaving) { s.speed = Math.min(s.speed + dt * 30, 200); s.leaving += dt; if (s.leaving > 14) { s.remove(); } }
  s.forward(_a); s.pos.addScaledVector(_a, s.speed * dt); s.vel.copy(_a).multiplyScalar(s.speed);
  if (s.def.shearOnly) return;
  // turrets
  for (const c of s.comps) {
    if (!c.alive) continue; c.update(); if (c.kind !== "turret") continue;
    c.cd -= dt; if (c.cd > 0) continue;
    const gun = s.def.gun || "capLaser"; const g = GUNS[gun];
    let tgt = null, bd = g.range * 0.95;
    for (const e of C.ents) { if (!e.alive || e.comp || e.isCap || e.team === s.team || e.cloaked) continue; const d = e.pos.distanceTo(c.pos); if (d < bd) { bd = d; tgt = e; } }
    if (!tgt) { c.cd = 0.5; continue; }
    const lp = leadPoint({ pos: c.pos, vel: s.vel }, tgt, g.speed * K).clone();
    const err = (s.team === "vharr" ? 22 : 30) + bd * 0.02; lp.add(new V3(rand(-err, err), rand(-err, err), rand(-err, err)));
    const head = c.obj.userData.head; if (head) { head.lookAt(lp); head.rotateY(Math.PI); }
    const dir = lp.sub(c.pos).normalize();
    fireBolt(s, _c.copy(c.pos).addScaledVector(dir, 10), dir, gun, s.vel);
    c.cd = g.rof * rand(1, 1.8) * (s.team === "vharr" ? 1.4 - 0.2 * C.opts.difficulty : 1);
    sfx.gun(gun, c.pos);
    // flak bursts
    if (s.team === "vharr" && Math.random() < 0.3 && bd < 1600) { const fp = tgt.pos.clone().add(new V3(rand(-70, 70), rand(-70, 70), rand(-70, 70))); setTimeout(() => { if (!C.player) return; explode(fp, 6, 0xffc070); for (const e of C.ents) if (e.alive && !e.isCap && !e.comp && e.team !== s.team && e.pos.distanceTo(fp) < 45) damage(e, 8, fp, s, "gun"); }, 300 + bd * 0.6); }
  }
  // launch fighters
  if (s.def.launcher && s.team === "vharr" && s.launches < 2) {
    s.launchT -= dt; if (s.launchT <= 0) {
      s.launchT = 40; s.launches++;
      const bay = (s.m.bay || new V3(0, 0, -s.def.size / 2)).clone().applyQuaternion(s.q).add(s.pos);
      spawnGroup({ type: pick(["dhakar", "skrel"]), n: 2, pos: [bay.x, bay.y, bay.z] });
      C.msgs.push({ t: 3, text: s.name.toUpperCase() + " LAUNCHING FIGHTERS" });
    }
  }
}

// ======================================================================= PLAYER
function playerUpdate(dt, ctl) {
  const s = C.player;
  s.gunCd -= dt;
  const regen = s.cloaked ? 0 : s.energyMax * 0.2;
  s.energy = Math.min(s.energyMax, s.energy + dt * regen);
  if (!s.dmg.shields && C.t - s.lastHit > 2.5) for (let i = 0; i < 2; i++) s.sh[i] = Math.min(s.shMax[i], s.sh[i] + dt * 5);
  if (!s.abOn && !s.cloaked) s.fuel = Math.min(s.fuelMax, s.fuel + dt * 1.2);
  // throttle
  const step = s.def.speed * K * 0.8;
  if (ctl.thrUp) s.setSpeed = Math.min(s.def.speed * K, s.setSpeed + step * dt);
  if (ctl.thrDn) s.setSpeed = Math.max(0, s.setSpeed - step * dt);
  if (ctl.stop) s.setSpeed = 0;
  if (ctl.match && C.target && C.target.speed !== undefined) { s.setSpeed = clamp(C.target.speed, 0, s.def.speed * K); C.msgs.push({ t: 1.5, text: "SPEED MATCHED" }); }
  // weapons
  if (ctl.fire && !s.cloaked && fireGuns(s)) { }
  if (ctl.cycGun) { s.gunMode = 1 - s.gunMode; C.msgs.push({ t: 1.5, text: s.gunMode === 0 ? "GUNS: FULL" : "GUNS: SEQUENCE" }); sfx.cue("u_gunmode", 0.5, {}, 660); }
  if (ctl.cycMis) { const keys = Object.keys(s.mis).filter(k => s.mis[k] > 0); if (keys.length) { s.misSel = keys[(keys.indexOf(s.misSel) + 1) % keys.length]; s.lock.t = 0; sfx.cue("u_missel", 0.5, {}, 990); } }
  if (s.misSel && !(s.mis[s.misSel] > 0)) { const keys = Object.keys(s.mis).filter(k => s.mis[k] > 0); s.misSel = keys[0] || s.misSel; }
  updLock(dt);
  if (ctl.missile && !s.cloaked && s.misSel && s.mis[s.misSel] > 0) {
    const def = MISSILES[s.misSel];
    if (def.lock > 0 && !(s.lock.tgt === C.target && s.lock.t >= def.lock)) { C.msgs.push({ t: 1.5, text: def.capital || def.special ? "NO TORPEDO LOCK" : "NO MISSILE LOCK" }); sfx.cue("u_nolock", 0.45, {}, 220, 0.15); }
    else { launchMissile(s, s.misSel, def.seek === "none" ? null : C.target); s.lock.t = 0; }
  }
  if (ctl.decoy) dropDecoy(s);
  // targeting
  if (ctl.tgtNear) C.target = nearestHostile(s, 30000) || C.target;
  if (ctl.tgtNext || ctl.tgtPrev) cycleTarget(ctl.tgtPrev ? -1 : 1);
  if (C.target && (!C.target.alive)) C.target = null;
  // cloak
  if (ctl.cloak && s.def.cloak) { s.cloaked = !s.cloaked && s.fuel > 5; C.msgs.push({ t: 2, text: s.cloaked ? "CLOAK ENGAGED" : "CLOAK DISENGAGED" }); sfx.whoosh(0.8, s.cloaked); for (const e of C.ents) if (e.ai && e.ai.tgt === s && s.cloaked) e.ai.tgt = null; }
  if (s.cloaked && s.fuel <= 0) { s.cloaked = false; C.msgs.push({ t: 2, text: "CLOAK FAILED — FUEL EXHAUSTED" }); }
  // comms
  if (ctl.comms) { C.commsOpen = !C.commsOpen; sfx.cue(C.commsOpen ? "u_open" : "u_close", 0.4, {}, 1200, 0.04); }
  if (C.commsOpen && ctl.commsPick) { doComms(ctl.commsPick); C.commsOpen = false; }
  if (ctl.view) C.view = C.view === "cockpit" ? "chase" : "cockpit";
  if (ctl.auto) tryAutopilot();
  if (ctl.land) tryLanding(true);
  if (ctl.eject) { C.msgs.push({ t: 3, text: "EJECTING" }); explode(s.pos, 10); s.obj.visible = false; endMission("eject"); return; }
  flyShip(s, ctl, dt);
  // collisions
  for (const r of C.rocks || []) { const d = r.p.distanceTo(s.pos); if (d < r.r + s.radius) { const n = _a.copy(s.pos).sub(r.p).normalize(); s.pos.copy(r.p).addScaledVector(n, r.r + s.radius + 1); s.vel.reflect(n).multiplyScalar(0.4); s.speed *= 0.4; damage(s, 25, _b.copy(s.pos).addScaledVector(n, -s.radius), null); explode(_b, 6, 0xa08060); } }
  for (const e of C.ents) if (e.alive && e.isCap && e !== s && insideCap(e, s.pos, 1.02)) { const n = _a.copy(s.pos).sub(e.pos).normalize(); s.pos.addScaledVector(n, 25); s.vel.copy(n).multiplyScalar(60); s.speed = 30; damage(s, 30, _b.copy(s.pos), null, "ram"); }
  sfx.engine(s.speed / (s.def.speed * K), s.abOn);
  // adaptive score: dogfight music when hostiles close in, calm cruise after a quiet spell
  if (C.state === "flight" && !C.musicLock) {
    let hot = false; for (const e of C.ents) if (e.alive && e.team && e.team !== s.team && e.def && !e.def.small && e.pos.distanceTo(s.pos) < 3600) { hot = true; break; }
    C._calm = hot ? 0 : (C._calm || 0) + dt;
    if (hot && sfx.mood !== "combat") sfx.play("combat"); else if (!hot && C._calm > 9 && sfx.mood !== "cruise") sfx.play("cruise");
  }
  // fighters streaking past the canopy
  const nowS = performance.now() / 1000;
  if (nowS - (C._fbAll || 0) > 0.6) for (const e of C.ents) {
    if (e === s || !e.alive || !e.def || e.def.capital || !e.vel) continue;
    const d = e.pos.distanceTo(s.pos); if (d > 110 || nowS - (e._fbT || 0) < 3) continue;
    if (e.vel.clone().sub(s.vel).length() < 120) continue;
    e._fbT = C._fbAll = nowS; sfx.flyby(e.pos); break;
  }
}
function updLock(dt) {
  const s = C.player, T = C.target, def = MISSILES[s.misSel];
  if (!T || !def || def.lock === 0 || !T.alive) { s.lock.t = 0; s.lock.tgt = T; return; }
  if (s.lock.tgt !== T) { s.lock.tgt = T; s.lock.t = 0; }
  const tpos = T.pos; const to = _a.copy(tpos).sub(s.pos); const d = to.length(); const ang = s.forward(_b).angleTo(to);
  let ok = d < (def.capital || def.special ? 4200 : 2600);
  if (def.capital) ok = ok && (T.isCap && !T.comp);
  if (def.special) ok = ok && T.def && T.def.shearOnly;
  if (!def.capital && !def.special) ok = ok && !T.isCap;
  const cone = def.seek === "heat" ? 0.4 : def.capital || def.special ? 0.22 : 0.35;
  if (def.seek === "heat") ok = ok && (T.forward ? T.forward(_c).dot(to.clone().normalize()) > 0.2 : true);
  if (ok && ang < cone) { const was = s.lock.t < def.lock; s.lock.t += dt; if (was && s.lock.t >= def.lock) { sfx.cue("u_lock", 0.55, {}, 1760, 0.25, 0.12, "sine"); C.msgs.push({ t: 1.2, text: def.capital || def.special ? "TORPEDO LOCK" : "MISSILE LOCK" }); } else if (was && Math.floor(s.lock.t * 6) !== Math.floor((s.lock.t - dt) * 6)) sfx.cue("u_seek", 0.3, { rate: 1.3 }, 1320, 0.03, 0.05); }
  else s.lock.t = Math.max(0, s.lock.t - dt * 2);
}
function cycleTarget(dir) {
  const list = C.ents.filter(e => e.alive && e !== C.player && (!e.comp || (C.target && (C.target === e.parent || C.target.parent === e.parent))) && e.pos.distanceTo(C.player.pos) < 30000);
  list.sort((a, b) => (a.team === b.team ? a.pos.distanceTo(C.player.pos) - b.pos.distanceTo(C.player.pos) : a.team === "vharr" ? -1 : 1));
  if (!list.length) { C.target = null; return; }
  const i = list.indexOf(C.target); C.target = list[(i + dir + list.length) % list.length]; sfx.cue("u_target", 0.45, {}, 1500, 0.03);
}
function doComms(n) {
  const w = C.wing.filter(x => x.alive);
  const say = (txt) => w.length && C.comms.push({ who: w[0].pilot, text: txt });
  if (n === 1) { C.wingOrder = "break"; w.forEach(x => x.ai.retarget = 0); say(pick(["Breaking and attacking!", "Engaging!", "On it!"])); }
  if (n === 2) { C.wingOrder = "form"; say(pick(["Forming on your wing.", "Coming back to you, lead.", "Right behind you."])); }
  if (n === 3) { if (C.target && C.target.team === "vharr") { C.wingOrder = "attack"; w.forEach(x => x.ai.retarget = 0); say(pick(["Going after your target!", "I see him. Moving in.", "Your target, copy."])); } else say("No hostile target, lead."); }
  if (n === 4) { C.wingOrder = "help"; w.forEach(x => x.ai.retarget = 0); say(pick(["Hang on, I'm coming!", "I've got your six!", "Shake him loose, I'm on my way!"])); }
  if (n === 5) { const T = C.target; if (T && T.team === "vharr" && !T.isCap) { T.ai.tgt = C.player; T.ai.retarget = 15; C.comms.push({ who: "player", text: pick(["You fly like a wounded grazer, Vharr.", "Is that the best the Hegemony has?", "I've seen better hunting from a house cat."]) }); C.comms.push({ who: T.pilot || "vharrpilot", text: pick(["Your throat will be mine, human!", "I will wear your name!", "Insolent prey!"]) }); } }
  if (n === 6) tryLanding(true);
}
function boundKey(id) { const c = (binds.kb[id] || []).find(Boolean); if (!c) return "?"; return c.replace(/^Ctrl\+/, "Ctrl+").replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num "); }
// tell the player how to move on: the mission advances by autopilot, which isn't obvious to a newcomer
function autoNag(dt) {
  const ms = C.mission, nav = ms.navs[C.navIdx], next = ms.navs[C.navIdx + 1];
  if (!next || nav.home || ms.defend || C.scriptHold) return;
  C._nagT = (C._nagT ?? 4) - dt;
  if (C._nagT > 0 || !autoAvailable()) return;
  const first = !C._nagged; C._nagged = true; C._nagT = 30;
  C.msgs.push({ t: 5, text: `PRESS ${boundKey("auto")} — AUTOPILOT TO ${next.name.toUpperCase()}` });
  if (first) { const w = (C.wing || []).find(x => x.alive && x.pilot); C.comms.push({ who: w ? w.pilot : "comms", text: `Area's clear. Hit autopilot and we'll jump to ${next.name}.` }); }
}
function autoAvailable() {
  if (C.scriptHold) return false;
  const hs = hostiles("concord", 7000).filter(e => !e.isCap || e.pos.distanceTo(C.player.pos) < 2500);
  return hs.length === 0 && !pendingSpawns() && C.navT > 3;
}
function tryAutopilot() {
  const ms = C.mission, nav = ms.navs[C.navIdx];
  if (nav.home || ms.defend) { tryLanding(true); return; }
  if (C.navIdx >= ms.navs.length - 1) { C.msgs.push({ t: 2, text: "NO FURTHER NAV POINTS" }); return; }
  if (!autoAvailable()) { C.msgs.push({ t: 2, text: "AUTOPILOT UNAVAILABLE — HOSTILES IN AREA" }); sfx.cue("u_unavail", 0.5, {}, 200, 0.2); return; }
  C.state = "auto"; C.stateT = 0; sfx.whoosh(3.2);
  C.autoCam = C.player.pos.clone().add(new V3(rand(-60, 60), rand(15, 40), -160).applyQuaternion(C.player.q));
  C.msgs.push({ t: 2, text: "AUTOPILOT ENGAGED" });
}
function tryLanding(ask) {
  const ms = C.mission, nav = ms.navs[C.navIdx];
  const car = C.carrier && C.carrier.alive ? C.carrier : null;
  const canHome = nav.home || ms.defend;
  if (!car || !canHome) { C.msgs.push({ t: 2, text: "NO CARRIER IN RANGE" }); return; }
  if (ms.defend && !(C.stats.navs[0] || {}).cleared) { C.comms.push({ who: "comms", text: "Negative! Hostiles still in the area. Clear them first." }); return; }
  if (hostiles("concord", 6000).length) { C.comms.push({ who: "comms", text: "Negative, hostiles in the area. Clear them out first." }); return; }
  if (car.pos.distanceTo(C.player.pos) > 6000) { C.comms.push({ who: "comms", text: "Close to within 6 km for landing clearance." }); return; }
  C.comms.push({ who: "comms", text: `Landing clearance granted. Welcome home, ${C.camp.callsign || "Vigil"}.` });
  C.state = "landing"; C.stateT = 0; C.landFrom = C.player.pos.clone(); C.landQ = C.player.q.clone();
}

// ======================================================================= MAIN LOOP
let last = performance.now();
function loop() {
  const now = performance.now();
  if (C.opts.fps) { C._fc = (C._fc || 0) + 1; if (now - (C._ft || 0) > 500) { const el = document.getElementById("fpsMeter"); if (el) { el.textContent = Math.round(C._fc * 1000 / (now - (C._ft || now - 500))) + " FPS"; el.hidden = false; } C._fc = 0; C._ft = now; } } else if (C._ft) { const el = document.getElementById("fpsMeter"); if (el) el.hidden = true; C._ft = 0; } let dt = Math.min(C.dtCap || 0.05, (now - last) / 1000); last = now;
  pollPad();
  if (C.hooks.frame) C.hooks.frame(dt);
  const fl = ["flight", "auto", "landing", "launch"].includes(C.state);
  if (fl && !C.paused) { C.t += dt; stepFlight(dt); }
  else if (C.state === "cine" && C.hooks.cine) C.hooks.cine(dt);
  else if (C.hooks.idle) C.hooks.idle(dt);
  if (fl) { const ctl = readControls(); if (ctl.pause && C.hooks.pause) C.hooks.pause(); if (ctl.fullscreen && C.hooks.fullscreen) C.hooks.fullscreen(); C.pendingCtl = ctl; } else consumeEdges();
  render(dt, fl && !!C.mission && ["flight", "auto", "landing", "launch"].includes(C.state));
}
function stepFlight(dt) {
  const ctl = C.pendingCtl || readControls(); C.pendingCtl = null; if (C.botCtl) C.botCtl(ctl);   // test hook: lets an automated pilot fly the player
  C.navT += dt; C.stateT += dt;
  const ms = C.mission; const pl = C.player;
  C.stats.navs[C.navIdx] = C.stats.navs[C.navIdx] || {}; C.stats.navs[C.navIdx].visited = true;
  if (C.state === "launch") {
    const t = C.stateT, ck = C.cockpit;
    ck.userData.power = clamp((t - 0.6) / 3.0, 0, 1);
    sfx.engine(clamp((t - 0.5) / 3.5, 0, 1) * 0.5 + (t > 4 ? 0.6 : 0), t > 4);
    if (t > 0.5 && !C.ls1) { C.ls1 = 1; C.comms.push({ who: "comms", text: `${C.camp.callsign || "Vigil"}, Halcyon flight control. Tube three is hot. Bring your systems up.` }); sfx.cue("u_powerup", 0.5, {}, 440, 0.4, 0.06, "sine"); }
    if (t > 2.4 && !C.ls2) { C.ls2 = 1; C.comms.push({ who: "comms", text: "Catapult armed. Launch in three... two... one..." }); }
    if (t < 4.2) { pl.speed = 0; pl.vel.set(0, 0, 0); if (t > 0.5) C.shake = Math.max(C.shake || 0, 0.04 + Math.min(1, (t - 0.5) / 3.7) * 0.07); }
    else { if (!C.ls3) { C.ls3 = 1; sfx.whoosh(2.4); rumble(0.8, 600); sfx.thud(0.9); C.shake = 0.6; const kk = C.kick || (C.kick = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }); kk.vx += 1.4; } pl.speed = Math.min(pl.def.ab * K * 1.2, pl.speed + dt * 520); pl.vel.set(0, 0, -pl.speed); pl.pos.addScaledVector(pl.vel, dt); C.shake = Math.max(C.shake || 0, 0.14); }
    if (pl.pos.z < -60) { C.state = "flight"; C.ls1 = C.ls2 = C.ls3 = 0; C.view = "cockpit"; pl.setSpeed = pl.def.speed * K * 0.7; pl.speed = pl.def.speed * K; sfx.play("cruise"); C._calm = 0; if (C.tube) { C.world.remove(C.tube); C.tube = null; } }
  } else if (C.state === "auto") {
    if (C.stateT > 3.2) { loadNav(C.navIdx + 1); C.state = "flight"; C.fade = 1; }
    for (const e of C.ents) if (e.alive && !e.isCap && !e.comp && e.keep) { e.speed = e.def.speed * K * 1.4; e.forward(e.vel).multiplyScalar(e.speed); e.pos.addScaledVector(e.vel, dt); }
  } else if (C.state === "landing") {
    const car = C.carrier; const bay = (car.m.bay || new V3(0, 0, -400)).clone().applyQuaternion(car.q).add(car.pos);
    const k = Math.min(1, C.stateT / 6); const ent = bay.clone().add(car.forward(tv()).multiplyScalar(500));
    const p1 = C.landFrom.clone().lerp(ent, Math.min(1, k * 1.4)); p1.lerp(bay.clone().add(car.forward(tv()).multiplyScalar(-140)), Math.max(0, (k - 0.7) / 0.3));
    pl.pos.copy(p1); const look = new THREE.Matrix4().lookAt(pl.pos, bay.clone().add(car.forward(tv()).multiplyScalar(-300)), new V3(0, 1, 0)); _q.setFromRotationMatrix(look); pl.q.slerp(_q, Math.min(1, dt * 2));
    if (C.stateT > 6.5) endMission("landed");
  } else if (!C.dead) {
    playerUpdate(dt, ctl);
  }
  if (C.state === "ended") return;
  for (const e of C.ents) { if (!e.alive || e.isPlayer) continue; if (e.comp) { e.update(); continue; } if (e.isCap) aiCapital(e, dt); else if (C.state === "flight") aiFighter(e, dt); }
  if (C.state === "flight") {
    runEvents(dt); autoNag(dt);
    if (ms.script === "ghost") ghostTick(dt);
    updBolts(dt); updMissiles(dt); updDecoys(dt); updDebris(dt);
    // nav cleared tracking
    const nav = ms.navs[C.navIdx];
    if (!C.cleared && !C.scriptHold && C.navT > 2 && hostiles("concord", Infinity, true).length === 0 && !pendingSpawns()) {
      const capsLeft = nav.obj === "destroy" ? !C.stats.deadIds.has(nav.target) : false;
      if (!capsLeft) { C.cleared = true; C.stats.navs[C.navIdx].cleared = true; if (nav.obj && nav.obj !== "none" && !nav.home) C.msgs.push({ t: 3, text: ms.defend ? "AREA SECURE — REQUEST LANDING" : "NAV " + C.navIdx + " SECURE — AUTOPILOT AVAILABLE" }); }
    }
    // flak field (Kethra)
    if (C.flak && !pl.cloaked && Math.random() < dt * 2.2) { const fp = pl.pos.clone().addScaledVector(pl.forward(tv()), rand(50, 300)).add(new V3(rand(-120, 120), rand(-120, 120), rand(-120, 120))); explode(fp, 8, 0xffa060); if (fp.distanceTo(pl.pos) < 50) damage(pl, 9, fp, null); }
    if (C.finaleT !== undefined) { C.finaleT -= dt; if (C.finaleT <= 0) { C.finaleT = undefined; endMission("final"); } }
    // player death
    if (C.dead) { C.deadT += dt; if (C.deadT > 3.5) endMission("kia"); }
    // carrier destroyed (defend)
    if (C.carrier && !C.carrier.alive && !C.carrierLostT) { C.carrierLostT = C.t; C.comms.push({ who: "comms", text: "All fighters... the Halcyon is lost. Abandon ship..." }); }
    if (C.carrierLostT && C.t - C.carrierLostT > 8) { C.carrierLostT = 0; endMission("carrierLost"); }
  }
  updParticles(dt);
  C.incoming = Math.max(0, (C.incoming || 0) - dt);
  if (C.missiles.some(m => m.target === pl && m.pos.distanceTo(pl.pos) < 1800)) C.incoming = 0.3;
}

// ======================================================================= CAMERA + RENDER
function render(dt, flight) {
  const cam = C.camera;
  if (flight && C.player) {
    const pl = C.player;
    let view = C.view;
    if (C.state === "auto" || C.state === "landing" || C.dead) view = "cine";
    C.cockpit.visible = view === "cockpit";
    pl.obj.visible = view !== "cockpit";
    if (view === "cockpit") {
      cam.position.copy(pl.pos); cam.quaternion.copy(pl.q);
      if (keysLook()) cam.quaternion.multiply(_q.setFromAxisAngle(new V3(0, 1, 0), Math.PI));
      const shk = C.opts.shake ?? 1;
      if (C.shake > 0) { const ts = performance.now() / 1000 * 38; cam.position.add(new V3(Math.sin(ts * 1.3) + Math.sin(ts * 2.9 + 1) * 0.5, Math.cos(ts * 1.7) + Math.sin(ts * 3.7 + 2) * 0.5, 0).multiplyScalar(C.shake * 0.2 * shk).applyQuaternion(pl.q)); C.shake = Math.max(0, C.shake - dt * 2.5); }
      const kk = C.kick; if (kk) { const w = 90, z = 9;   // damped spring: snaps away, settles in ~0.4 s
        for (const a of ["x", "y", "z"]) { const va = "v" + a; kk[va] += (-w * kk[a] - z * kk[va]) * dt; kk[a] += kk[va] * dt; }
        if (shk > 0) cam.quaternion.multiply(_q.setFromEuler(new THREE.Euler(kk.x * 0.06 * shk, kk.y * 0.06 * shk, kk.z * 0.05 * shk))); }
      const U = C.cockpit.userData; if (U.armPivot) { U.armPivot.rotation.x = -pl.av.x * 0.12; U.armPivot.rotation.z = -pl.av.z * 0.07 + pl.av.y * 0.05; }
      if (U.updateArm) U.updateArm();
      if (U.flair) U.flair.update(dt, pl);
    } else if (view === "chase") {
      const off = new V3(0, pl.def.size * 0.35, pl.def.size * 2.2).applyQuaternion(pl.q);
      cam.position.lerp(_a.copy(pl.pos).add(off), Math.min(1, dt * 8)); cam.quaternion.slerp(pl.q, Math.min(1, dt * 6));
    } else {
      // cinematic external
      let camPos, look = pl.pos;
      if (C.state === "auto") camPos = C.autoCam.clone().addScaledVector(pl.vel, C.stateT * 0.3);
            else if (C.state === "landing") { const car = C.carrier; camPos = car.pos.clone().add(new V3(160, 70, -900).applyQuaternion(car.q)); }
      else camPos = pl.pos.clone().add(new V3(Math.sin(C.deadT) * 60, 25, Math.cos(C.deadT) * 60));
      cam.position.copy(camPos); cam.up.set(0, 1, 0); cam.lookAt(look);
    }
    updDust();
    C.dust.visible = false;   // space dust removed: it read as square specks over the canopy and instruments
    if (view === "cockpit") paintCockpit(dt);
  }
  if (C.camLock) { cam.position.copy(C.camLock.pos); cam.up.set(0, 1, 0); cam.lookAt(C.camLock.look); if (C.camLock.fov) { cam.fov = C.camLock.fov; cam.updateProjectionMatrix(); } }
  if (C.sunFx) { C.sunFx.position.copy(cam.position).addScaledVector(_a.copy(C.sun.position).normalize(), 90000); C.sunFx.visible = C.sun.intensity > 0.2 && !C.indoor; }
  if (C.stars) { const u = C.stars.material.uniforms; u.uTime.value += dt; u.uScale.value = C.renderer.getPixelRatio() * Math.max(1, C.H / 1000); }
  const b0 = C.bloom.strength; C.bloom.strength = b0 * (C.opts.bloom ?? 1); C.bloom.enabled = (C.opts.bloom ?? 1) > 0;
  C.composer.render(dt); C.bloom.strength = b0;
  // target camera into the left screen (render target)
  if (flight && C.view === "cockpit" && C.state === "flight" && C.player && C.target && C.target.alive && !commsActive() && !C.player.dmg.radar) {
    const r = C.renderer, T = C.target; const vc = C.vduCam; const tp = T.pos; const rad = T.comp ? 20 : T.radius;
    const dir = _a.copy(C.player.pos).sub(tp).normalize();
    vc.position.copy(tp).addScaledVector(dir, rad * 3.2).addScaledVector(C.player.up(_b), rad * 0.8); vc.up.copy(C.player.up(_c)); vc.lookAt(tp);
    vc.aspect = 512 / 368; vc.far = 300000; vc.updateProjectionMatrix();
    const pv = C.dust.visible; C.dust.visible = false; r.setRenderTarget(C.vduRT); r.clear(); r.render(C.scene, vc); r.setRenderTarget(null); C.dust.visible = pv;
  }
  drawHUD(flight);
}
function keysLook() { return keys.has("KeyZ") || (pad.connected && pad.axes[3] > 0.85 && false); }
function commsActive() { return C.curComm && C.curComm.t > 0 && C.curComm.who !== "player" && !C.player.dmg.comms; }

// ======================================================================= COCKPIT
export function setCockpit(type) {
  if (C.cockpit) C.camera.remove(C.cockpit);
  let ck = C.cockpits[type] || C.cockpits[CK.THEMES[type] ? type : "kestrel"];
  if (!ck) {
    ck = CK.buildCockpit(CK.THEMES[type] ? type : "kestrel");
    const L = ck.userData.D.left;
    const rp = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), new THREE.MeshBasicMaterial({ map: C.vduRT.texture }));
    rp.position.copy(L.mesh.position); rp.quaternion.copy(L.mesh.quaternion); rp.translateZ(-0.003); rp.layers.set(1); ck.add(rp); L.rtPlane = rp;
    L.mesh.material.transparent = true;
    C.cockpits[type] = ck;
  }
  C.cockpit = ck; C.camera.add(ck);
  return ck;
}
let paintAcc = 0;
function paintCockpit(dt) {
  const ck = C.cockpit, pl = C.player; if (!ck || !pl) return;
  const D = ck.userData.D, U = ck.userData;
  paintAcc += dt; if (paintAcc < 1 / 30) return; paintAcc = 0;
  const pw = U.power ?? 1;
  const L = D.left, R = D.right;
  const showRT = pw >= 1 && C.state === "flight" && C.target && C.target.alive && !commsActive() && !pl.dmg.radar;
  L.rtPlane.visible = !!showRT;
  for (const S of [L, R]) { const c = S.ctx; c.clearRect(0, 0, S.canvas.width, S.canvas.height); if (S !== L || !showRT) { c.fillStyle = "#03100a"; c.fillRect(0, 0, S.canvas.width, S.canvas.height); } }
  if (pw < 1) bootScreen([L, R, D.aux1, D.aux2, D.status].filter(Boolean), pw);
  else drawVDUs(L.ctx, R.ctx, { x: 0, y: 0, w: L.canvas.width, h: L.canvas.height }, { x: 0, y: 0, w: R.canvas.width, h: R.canvas.height });
  L.tex.needsUpdate = R.tex.needsUpdate = true;
  const rc = D.radar.ctx; rc.fillStyle = "#020c06"; rc.fillRect(0, 0, 512, 512);
  if (pw >= 0.5) drawRadar(rc, { x: 256, y: 256, r: 236 }); D.radar.tex.needsUpdate = true;
  // auxiliary screens (bombers and heavies)
  for (const k of ["aux1", "aux2", "status"]) { const S = D[k]; if (!S || pw < 1) continue; const c = S.ctx, w = S.canvas.width, h = S.canvas.height; c.fillStyle = "#03100a"; c.fillRect(0, 0, w, h); c.strokeStyle = "rgba(125,255,168,.4)"; c.lineWidth = 3; c.strokeRect(6, 6, w - 12, h - 12); c.font = `bold ${Math.max(18, h * 0.11) | 0}px 'Share Tech Mono', monospace`; c.textBaseline = "top"; c.fillStyle = GREEN;
    if (k === "aux1") { c.fillText("WING", 18, 16); C.wing.forEach((wm, i) => { c.fillStyle = wm.alive ? GREEN : RED; c.fillText(`${(CAST[wm.pilot].callsign || "").toUpperCase()} ${wm.alive ? (wm.disabled ? "NO SIGNAL" : Math.round(wm.healthFrac() * 100) + "%") : C.stats.deadIds.has(wm.pilot) ? "KIA" : "EJECTED"}`, 18, 16 + (i + 1) * h * 0.16); }); }
    else if (k === "aux2") { c.fillText("TORPEDO", 18, 16); const tq = pl.mis.torp || 0; for (let i = 0; i < 4; i++) { c.fillStyle = i < tq ? AMBER : "#2a2a1a"; c.fillRect(18 + i * (w - 36) / 4, h * 0.4, (w - 36) / 4 - 10, h * 0.35); } }
    else { c.fillText(C.msgs.length ? C.msgs[C.msgs.length - 1].text.slice(0, 24) : "SYSTEMS NOMINAL", 14, h * 0.2); }
    S.tex.needsUpdate = true; }
  const def = MISSILES[pl.misSel];
  CK.paintLights(ck, { eject: pl.core < pl.coreMax * 0.35, auto: autoAvailable() && !C.mission.navs[C.navIdx].home, lock: !!(def && def.lock > 0 && pl.lock.tgt === C.target && pl.lock.t >= def.lock), missile: C.incoming > 0, ab: pl.abOn, shield: pl.sh[0] < pl.shMax[0] * 0.25 || pl.sh[1] < pl.shMax[1] * 0.25, cloak: pl.cloaked }, C.t);
  CK.paintReadouts(ck, { set: pl.setSpeed / K, kps: pl.speed / K, gun: pl.energy / pl.energyMax, fuel: pl.fuel / pl.fuelMax });
}
function bootScreen(list, pw) {
  const lines = ["CONCORD NAVY AVIONICS", "BIOS 7.11 ......... OK", "REACTOR ............ " + (pw > 0.3 ? "ONLINE" : "SPOOL"), "SHIELD EMITTERS ... " + (pw > 0.5 ? "OK" : "--"), "WEAPONS BUS ....... " + (pw > 0.65 ? "ARMED" : "--"), "ITTS / RADAR ...... " + (pw > 0.8 ? "OK" : "--"), "NAV COMPUTER ...... " + (pw > 0.9 ? "LOCKED" : "--")];
  for (const S of list) { const c = S.ctx, w = S.canvas.width, h = S.canvas.height; c.fillStyle = "#020803"; c.fillRect(0, 0, w, h); if (pw < 0.12) { S.tex.needsUpdate = true; continue; } c.fillStyle = GREEN; c.font = `bold ${Math.max(14, h * 0.07) | 0}px 'Share Tech Mono', monospace`; c.textBaseline = "top"; const n = Math.min(lines.length, Math.floor(pw * 9)); for (let i = 0; i < n; i++) c.fillText(lines[i], 14, 14 + i * h * 0.12); S.tex.needsUpdate = true; }
}

// ======================================================================= HUD
const AMBER = "#ffb440", GREEN = "#7dffa8", RED = "#ff5040", CYAN = "#78e0ff", DIM = "rgba(255,180,64,.35)";
function proj(v) { const p = _a.copy(v).project(C.camera); return { x: (p.x * 0.5 + 0.5) * C.W, y: (-p.y * 0.5 + 0.5) * C.H, behind: p.z > 1 }; }
function teamCol(e) { return e.team === "vharr" ? RED : e.isCap ? CYAN : GREEN; }
function drawHUD(flight) {
  const x = C.hx, W = C.W, H = C.H;
  x.clearRect(0, 0, W, H);
  // comms queue tick (also in cinematics)
  tickComms();
  if (!flight || !C.player) return;
  const pl = C.player;
  if (C.fade > 0) { C.fade = Math.max(0, C.fade - (C.hudDt || 1 / 60) * 1.5); }
  let fadeA = C.fade || 0;
  if (C.state === "auto") fadeA = clamp((C.stateT - 2.4) / 0.8, 0, 1);
  if (C.state === "landing") fadeA = clamp((C.stateT - 5.5) / 1, 0, 1);
  const cockpit = C.view === "cockpit" && (C.state === "flight" || C.state === "launch") && !C.dead;
  x.font = "600 13px 'Share Tech Mono', monospace"; x.textBaseline = "middle";
  if (cockpit) {
    const cx = W / 2, cy = H / 2;
    // crosshair
    x.strokeStyle = AMBER; x.lineWidth = 1.5; x.globalAlpha = 0.9;
    x.beginPath(); for (const [a, b, c, d] of [[-22, 0, -8, 0], [8, 0, 22, 0], [0, -22, 0, -8], [0, 8, 0, 22]]) { x.moveTo(cx + a, cy + b); x.lineTo(cx + c, cy + d); } x.stroke();
    x.beginPath(); x.arc(cx, cy, 2, 0, 7); x.fillStyle = AMBER; x.fill();
    // mouse stick indicator
    if (mouse.locked) { x.strokeStyle = DIM; x.beginPath(); x.arc(cx + mouse.x * 120, cy + mouse.y * 120, 6, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, 120, 0, 7); x.setLineDash([2, 6]); x.stroke(); x.setLineDash([]); }
    // ship markers
    for (const e of C.ents) {
      if (!e.alive || e === pl || e.comp) continue;
      const p = proj(e.pos); if (p.behind || p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) continue;
      const d = e.pos.distanceTo(pl.pos); if (d > 12000) continue;
      x.strokeStyle = teamCol(e); x.globalAlpha = 0.65; const s = clamp(2400 / d, 4, 18);
      if (e !== C.target) { x.strokeRect(p.x - s, p.y - s, s * 2, s * 2); }
    }
    x.globalAlpha = 1;
    // incoming missiles markers
    for (const m of C.missiles) { if (m.team === "concord") continue; const p = proj(m.pos); if (p.behind) continue; x.fillStyle = "#ffe060"; x.beginPath(); x.arc(p.x, p.y, 3, 0, 7); x.fill(); }
    // target
    const T = C.target;
    if (T && T.alive) {
      const p = proj(T.pos); const d = T.pos.distanceTo(pl.pos); const col = teamCol(T);
      if (!p.behind && p.x > 0 && p.x < W && p.y > 0 && p.y < H) {
        const s = clamp((T.radius * 1.4) / d * H, 14, 120);
        x.strokeStyle = col; x.lineWidth = 2; x.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { x.moveTo(p.x + sx * s, p.y + sy * (s - 8)); x.lineTo(p.x + sx * s, p.y + sy * s); x.lineTo(p.x + sx * (s - 8), p.y + sy * s); }
        x.stroke();
        x.fillStyle = col; x.textAlign = "left"; x.fillText(`${(d / 1000 * 2).toFixed(1)}km`, p.x + s + 6, p.y - s + 6);
        // ITTS lead
        if (!T.isCap && !T.comp && !pl.dmg.itts) { const gs = GUNS[pl.guns[0].type].speed * K; const lp = leadPoint(pl, T, gs); const q = proj(lp); if (!q.behind) { x.strokeStyle = col; x.lineWidth = 1.5; x.beginPath(); x.moveTo(q.x, q.y - 7); x.lineTo(q.x + 7, q.y); x.lineTo(q.x, q.y + 7); x.lineTo(q.x - 7, q.y); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.globalAlpha = 0.3; x.stroke(); x.globalAlpha = 1; } }
        // missile lock reticle
        const def = MISSILES[pl.misSel];
        if (def && def.lock > 0 && pl.lock.tgt === T && pl.lock.t > 0) {
          const k = Math.min(1, pl.lock.t / def.lock); const r = 60 - k * 40; const locked = k >= 1;
          x.strokeStyle = locked ? "#ff3020" : "#ffe060"; x.lineWidth = locked ? 3 : 1.5; x.beginPath(); x.arc(p.x, p.y, r + s * 0.3, 0, 7); x.stroke();
          if (locked) { x.fillStyle = "#ff3020"; x.textAlign = "center"; x.fillText(def.capital || def.special ? "TORPEDO LOCK" : "LOCK", p.x, p.y + r + s * 0.3 + 14); }
        }
      } else {
        // off-screen arrow
        const l = _b.copy(T.pos).sub(C.camera.position).applyQuaternion(_q.copy(C.camera.quaternion).invert());
        const a = Math.atan2(-l.y, l.x); const R = Math.min(W, H) * 0.32;
        const ax = cx + Math.cos(a) * R, ay = cy + Math.sin(a) * R;
        x.save(); x.translate(ax, ay); x.rotate(a); x.fillStyle = col; x.beginPath(); x.moveTo(14, 0); x.lineTo(-6, -9); x.lineTo(-6, 9); x.fill(); x.restore();
      }
    }
    // nav / carrier marker
    const nav = C.mission.navs[C.navIdx];
    if ((nav.home || C.mission.defend) && C.carrier && C.carrier.alive) { const p = proj(C.carrier.pos); if (!p.behind) { x.strokeStyle = CYAN; x.setLineDash([4, 4]); x.strokeRect(p.x - 24, p.y - 16, 48, 32); x.setLineDash([]); x.fillStyle = CYAN; x.textAlign = "center"; x.fillText("HALCYON", p.x, p.y - 26); } }
    // top bar: speed / set speed
    const kps = v => Math.round(v / K);
    x.textAlign = "left"; x.fillStyle = AMBER; x.font = "600 15px 'Share Tech Mono', monospace";
    x.textAlign = "right"; x.fillText(`${C.mission.navs[C.navIdx].name.toUpperCase()}`, W - 24, 30);
    if (nav.home || C.mission.defend) { x.fillStyle = GREEN; x.fillText(`[${boundKey("auto")}] LAND`, W - 24, 50); }
    else if (C.mission.navs[C.navIdx + 1] && C.state === "flight") { const ok = autoAvailable(); x.fillStyle = ok ? GREEN : "rgba(255,180,64,.55)"; x.fillText(ok ? `[${boundKey("auto")}] AUTOPILOT → ${C.mission.navs[C.navIdx + 1].name.toUpperCase()}` : "AUTOPILOT LOCKED — HOSTILES", W - 24, 50); }
    if (pl.cloaked) { x.fillStyle = CYAN; x.textAlign = "center"; x.fillText("◈ CLOAKED ◈", W / 2, 34); }
    // energy & fuel bars
    // warnings
    if (C.incoming > 0 && Math.floor(C.t * 6) % 2) { x.fillStyle = RED; x.textAlign = "center"; x.font = "700 20px 'Share Tech Mono', monospace"; x.fillText("◆ MISSILE ◆", cx, cy + 90); if (Math.floor(C.t * 6) % 4 === 1) sfx.cue("u_warn", 0.5, { rate: 1.1 }, 600, 0.05, 0.08); }
    // messages
    C.msgs = C.msgs.filter(m => (m.t -= C.hudDt || 1 / 60) > 0);
    x.font = "600 14px 'Share Tech Mono', monospace"; x.textAlign = "center"; x.fillStyle = AMBER;
    C.msgs.slice(-3).forEach((m, i) => x.fillText(m.text, cx, H * 0.2 + i * 20));
    // panels
    if (C.commsOpen) drawCommsMenu(x);
    // hit flash
    { const cv = cockpit ? paintCracks(W, H) : null; if (cv) x.drawImage(cv, 0, 0, W, H); }
    if (C.hitDirs && C.hitDirs.length) {
      const dtH = C.hudDt || 1 / 60, cxH = W / 2, cyH = H / 2, Rr = Math.min(W, H) * 0.19;
      C.hitDirs = C.hitDirs.filter(h => (h.t -= dtH) > 0);
      for (const h of C.hitDirs) {
        const f = Math.min(1, h.t / 1.5), col = h.hull ? "255,90,40" : "90,170,255", ca = Math.cos(h.a), sa = Math.sin(h.a);
        // glow on the screen edge in that direction
        const ex = cxH + ca * W * 0.5, ey = cyH + sa * H * 0.5, gr = x.createRadialGradient(ex, ey, 0, ex, ey, Math.min(W, H) * 0.42);
        gr.addColorStop(0, `rgba(${col},${0.32 * f * h.k})`); gr.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gr; x.fillRect(0, 0, W, H);
        // arc on a ring around the reticle; behind-you hits get a double arc
        x.save(); x.strokeStyle = `rgba(${col},${0.85 * f})`; x.lineWidth = 5; x.lineCap = "round"; x.shadowColor = `rgba(${col},${f})`; x.shadowBlur = 12;
        x.beginPath(); x.arc(cxH, cyH, Rr, h.a - 0.28, h.a + 0.28); x.stroke();
        if (h.behind) { x.lineWidth = 3; x.beginPath(); x.arc(cxH, cyH, Rr + 9, h.a - 0.2, h.a + 0.2); x.stroke(); }
        x.restore();
      }
    }
    if (C.hitFlashT > 0) { C.hitFlashT -= C.hudDt || 1 / 60; x.fillStyle = C.hitFlash === "shield" ? `rgba(80,160,255,${C.hitFlashT})` : `rgba(255,60,30,${C.hitFlashT * 1.4})`; x.fillRect(0, 0, W, H); }
    if (pl.cloaked) { x.fillStyle = "rgba(40,120,200,.12)"; x.fillRect(0, 0, W, H); }
  } else if (C.view === "chase" && C.state === "flight" && !C.dead) {
    x.fillStyle = AMBER; x.textAlign = "left"; x.fillText(`KPS ${Math.round(pl.speed / K)}   [V] COCKPIT`, 24, 30);
    if (C.target) { const p = proj(C.target.pos); if (!p.behind) { x.strokeStyle = teamCol(C.target); x.strokeRect(p.x - 16, p.y - 16, 32, 32); } }
  }
  // letterbox for cinematic flight states
  if (C.state === "auto" || C.state === "landing" || C.dead) {
    x.fillStyle = "#000"; x.fillRect(0, 0, W, H * 0.11); x.fillRect(0, H * 0.89, W, H * 0.11);
    x.fillStyle = AMBER; x.font = "600 15px 'Share Tech Mono', monospace"; x.textAlign = "center";
    const lbl = C.state === "auto" ? `AUTOPILOT — ${C.mission.navs[C.navIdx + 1]?.name.toUpperCase()}` : C.state === "landing" ? "LANDING APPROACH" : C.dead ? "KILLED IN ACTION" : "LAUNCH";
    x.fillText(lbl, W / 2, H * 0.945);
  }
  // comm subtitle (always in flight)
  drawCommSubtitle(x);
  if (fadeA > 0) { x.fillStyle = `rgba(0,0,0,${fadeA})`; x.fillRect(0, 0, W, H); }
}
function bar(x, px, py, w, h, f, col, label) {
  x.strokeStyle = DIM; x.lineWidth = 1; x.strokeRect(px, py, w, h);
  x.fillStyle = col; x.fillRect(px + 1, py + h - (h - 2) * clamp(f, 0, 1) - 1, w - 2, (h - 2) * clamp(f, 0, 1));
  x.fillStyle = DIM; x.font = "600 9px 'Share Tech Mono', monospace"; x.textAlign = "center"; x.fillText(label, px + w / 2, py + h + 10);
}
function drawRadar(x, sc) {
  const pl = C.player, r = sc.r * 1.05, cx = sc.x, cy = sc.y;
  x.save();
  x.fillStyle = "rgba(4,14,8,.9)"; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  x.strokeStyle = "rgba(125,255,168,.75)"; x.lineWidth = Math.max(1, r / 60); x.beginPath(); x.arc(cx, cy, r * 0.5, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
  x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy); x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.stroke();
  if (pl.dmg.radar) { x.fillStyle = RED; x.textAlign = "center"; x.font = "600 10px 'Share Tech Mono'"; x.fillText("RADAR DMG", cx, cy); x.restore(); return; }
  const inv = _q.copy(pl.q).invert();
  const blip = (pos, col, size) => {
    const l = _a.copy(pos).sub(pl.pos).applyQuaternion(inv); const len = l.length() || 1;
    // WC style: front hemisphere inner disc, rear outer ring
    const ang = Math.acos(clamp(-l.z / len, -1, 1)) / Math.PI; const rr = ang * r;
    const a2 = Math.atan2(-l.y, l.x); size *= Math.max(1, r / 55); x.fillStyle = col; x.shadowColor = col; x.shadowBlur = size; x.fillRect(cx + Math.cos(a2) * rr - size / 2, cy + Math.sin(a2) * rr - size / 2, size, size); x.shadowBlur = 0;
  };
  for (const e of C.ents) { if (!e.alive || e === pl || e.comp) continue; if (e.pos.distanceTo(pl.pos) > 9000) continue; blip(e.pos, e === C.target ? "#fff" : teamCol(e), e.isCap ? 5 : 3); }
  for (const m of C.missiles) if (m.team !== "concord") blip(m.pos, "#ffe060", 2);
  x.restore();
}
function drawVDUs(xL, xR, L, R) {
  const pl = C.player; let x = xL;
  x.save();
  // frames
  for (const s of [L, R]) { x.strokeStyle = "rgba(255,180,64,.55)"; x.lineWidth = 1.5; x.strokeRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6); }
  x.font = `600 ${Math.max(9, L.h * 0.075) | 0}px 'Share Tech Mono', monospace`; x.textBaseline = "top";
  const lh = Math.max(10, L.h * 0.085);
  // LEFT: comms portrait or target
  if (commsActive()) {
    const c = C.curComm; const spec = CAST[c.who] || CAST.comms;
    drawPortrait(x, spec, L.x + 6, L.y + 6, L.w - 12, L.h - 12, voice.speaking || c.talk ? Math.abs(Math.sin(C.t * 14)) : Math.abs(Math.sin(C.t * 12)) * (c.t > 0.5 ? 1 : 0), C.t);
    x.fillStyle = AMBER; x.textAlign = "left"; x.fillText((spec.callsign || spec.name || "").toUpperCase(), L.x + 14, L.y + 14);
  } else {
    const T = C.target; x.textAlign = "left";
    if (pl.dmg.radar) { x.fillStyle = RED; x.fillText("TARGETING OFFLINE", L.x + 10, L.y + 10); }
    else if (T && T.alive) {
      x.fillStyle = teamCol(T);
      const nm = T.comp ? `${T.parent.name} — ${T.name}` : T.isCap ? T.name : `${T.def.name}`;
      x.fillText(nm.toUpperCase().slice(0, 30), L.x + 10, L.y + 8);
      const pilot = T.pilot && CAST[T.pilot] ? (CAST[T.pilot].callsign ? `${CAST[T.pilot].callsign}` : CAST[T.pilot].name) : T.hunter || "";
      if (pilot) x.fillText(pilot.toUpperCase(), L.x + 10, L.y + 8 + lh);
      const hf = T.healthFrac();
      x.fillText(`${(T.pos.distanceTo(pl.pos) / 500).toFixed(1)}KM`, L.x + 10, L.y + L.h - lh * 2 - 6);
      x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(L.x + 10, L.y + L.h - lh - 8, L.w - 20, lh * 0.7);
      x.fillStyle = hf > 0.6 ? GREEN : hf > 0.3 ? AMBER : RED; x.fillRect(L.x + 10, L.y + L.h - lh - 8, (L.w - 20) * hf, lh * 0.7);
      if (T.gen && T.gen.alive) { x.fillStyle = CYAN; x.textAlign = "right"; x.fillText("SHIELDED", L.x + L.w - 10, L.y + 8 + lh); }
    } else { x.fillStyle = DIM; x.fillText("NO TARGET", L.x + 10, L.y + 10); x.fillText("[R] NEAREST  [T] CYCLE", L.x + 10, L.y + 10 + lh); }
  }
  // RIGHT: ship status
  x.restore(); x = xR; x.save(); x.font = `600 ${Math.max(9, L.h * 0.075) | 0}px 'Share Tech Mono', monospace`; x.textBaseline = "top";
  const cx = R.x + R.w * 0.28, cy = R.y + R.h * 0.55, s = Math.min(R.w, R.h) * 0.24;
  const sf = pl.sh[0] / pl.shMax[0], sb = pl.sh[1] / pl.shMax[1];
  x.lineWidth = 3;
  x.strokeStyle = `rgba(120,200,255,${0.25 + sf * 0.75})`; x.beginPath(); x.arc(cx, cy, s * 1.25, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
  x.strokeStyle = `rgba(120,200,255,${0.25 + sb * 0.75})`; x.beginPath(); x.arc(cx, cy, s * 1.25, Math.PI * 0.15, Math.PI * 0.85); x.stroke();
  const acol = i => { const f = pl.ar[i] / pl.arMax[i]; return f > 0.6 ? GREEN : f > 0.25 ? AMBER : f > 0 ? RED : "#550000"; };
  x.lineWidth = 4;
  x.strokeStyle = acol(0); x.beginPath(); x.moveTo(cx - s * 0.35, cy - s * 0.9); x.lineTo(cx + s * 0.35, cy - s * 0.9); x.stroke();
  x.strokeStyle = acol(1); x.beginPath(); x.moveTo(cx - s * 0.35, cy + s * 0.9); x.lineTo(cx + s * 0.35, cy + s * 0.9); x.stroke();
  x.strokeStyle = acol(2); x.beginPath(); x.moveTo(cx - s * 0.75, cy - s * 0.5); x.lineTo(cx - s * 0.75, cy + s * 0.5); x.stroke();
  x.strokeStyle = acol(3); x.beginPath(); x.moveTo(cx + s * 0.75, cy - s * 0.5); x.lineTo(cx + s * 0.75, cy + s * 0.5); x.stroke();
  const cf = pl.core / pl.coreMax; x.fillStyle = cf > 0.6 ? GREEN : cf > 0.3 ? AMBER : RED;
  x.beginPath(); x.moveTo(cx, cy - s * 0.6); x.lineTo(cx + s * 0.4, cy + s * 0.5); x.lineTo(cx, cy + s * 0.3); x.lineTo(cx - s * 0.4, cy + s * 0.5); x.closePath(); x.fill();
  x.fillStyle = AMBER; x.textAlign = "left";
  const tx = R.x + R.w * 0.56; let ty = R.y + 10;
  x.fillText(pl.def.name.split(" ").pop().toUpperCase(), R.x + 10, R.y + 8);
  x.fillText(`GUNS ${pl.gunMode === 0 ? "FULL" : "SEQ"}`, tx, ty); ty += lh;
  x.fillText(GUNS[pl.guns[0].type].name.split(" ")[0].toUpperCase(), tx, ty); ty += lh * 1.3;
  for (const [k, n] of Object.entries(pl.mis)) { x.fillStyle = k === pl.misSel ? "#fff" : DIM; x.fillText(`${k === pl.misSel ? "▶" : " "}${MISSILES[k].short} ×${n}`, tx, ty); ty += lh; }
  x.fillStyle = AMBER; x.fillText(`DECOY ×${pl.decoys}`, tx, ty); ty += lh;
  const dmgs = Object.keys(pl.dmg); if (dmgs.length) { x.fillStyle = RED; x.fillText("DMG: " + dmgs.map(d => d.toUpperCase()).join(" "), R.x + 10, R.y + R.h - lh - 6); }
  x.restore();
}
function drawCommsMenu(x) {
  const opts = ["Break and attack", "Form on my wing", "Attack my target", "Help me out", "Taunt target", "Request landing"];
  const w = 260, h = opts.length * 24 + 40, px = 24, py = C.H * 0.28;
  x.save(); x.fillStyle = "rgba(10,14,12,.85)"; x.fillRect(px, py, w, h); x.strokeStyle = AMBER; x.strokeRect(px, py, w, h);
  x.fillStyle = AMBER; x.font = "600 13px 'Share Tech Mono'"; x.textAlign = "left"; x.textBaseline = "middle";
  x.fillText(`COMMS → ${C.wing.filter(w => w.alive).map(w => (CAST[w.pilot].callsign || "").toUpperCase()).join(", ") || "ALL"}`, px + 12, py + 18);
  const pads = ["↑", "→", "↓", "←", "A", "—"];
  opts.forEach((o, i) => x.fillText(`${i + 1}${pad.connected ? " " + pads[i] : ""}  ${o}`, px + 12, py + 44 + i * 24));
  x.restore();
}
// comms queue: one message at a time
let lastComm = performance.now();
function tickComms() {
  const now = performance.now(); const dt = Math.min(0.1, (now - lastComm) / 1000); lastComm = now; C.hudDt = dt;
  if (C.curComm) { C.curComm.t -= dt; if (C.curComm.t <= 0 && !C.curComm.waiting) C.curComm = null; }
  if (!C.curComm && C.comms.length) {
    const c = C.comms.shift(); if (c.text && c.text.includes("{")) c.text = c.text.replace(/\{rank\}/g, (C.camp && C.camp.addr) || "Pilot").replace(/\{callsign\}/g, (C.camp && C.camp.callsign) || "Rookie"); c.t = Math.max(2.8, c.text.split(" ").length * 0.36 + 1); C.curComm = c;
    if (c.who !== "player") { sfx.cue("u_comms", 0.35, {}, 2200, 0.04, 0.05, "sine"); voice.say(c.who, c.text); } else voice.say("player", c.text);
  }
}
function drawCommSubtitle(x) {
  const c = C.curComm; if (!c || c.t <= 0) return;
  const spec = CAST[c.who] || {}; const name = c.who === "player" ? (C.camp?.callsign || "YOU") : (spec.callsign || spec.name || "COMMS");
  x.save(); x.font = "600 16px 'Barlow Semi Condensed', sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  const y = C.view === "cockpit" && C.state === "flight" ? C.H * 0.64 : C.H * 0.84;
  const txt = `${name.toUpperCase()}: ${c.text}`; const w = Math.min(C.W - 40, x.measureText(txt).width + 30);
  x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(C.W / 2 - w / 2, y - 14, w, 28);
  x.fillStyle = spec.faction === "vharr" ? "#ffa070" : "#f0e6d0";
  x.fillText(txt.length > 140 ? txt.slice(0, 137) + "…" : txt, C.W / 2, y);
  x.restore();
}

export function cineStep(dt) {
  for (const b of C.boltPool) { if (b.life <= 0) continue; b.life -= dt; if (b.life <= 0) { b.m.visible = false; continue; } b.pos.addScaledVector(b.vel, dt); }
  updParticles(dt); updDebris(dt); updDust();
}
export { K, Ship as ShipClass, readControls, debris };
