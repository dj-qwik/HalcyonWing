// HALCYON WING — worlds. Each planet is baked once on the GPU from 3D noise (no pole pinching,
// no seam) into two equirectangular maps, then drawn with its own lighting: bump-shaded terrain,
// a soft terminator, ocean glint, night-side city lights, a drifting cloud layer, an atmosphere
// that only glows on the sunlit limb, and rings for the giants.
import * as THREE from "three";
import { NOISE_GLSL } from "./space.js";

let RENDERER = null, SUN = null;
export function setPlanetRenderer(r) { RENDERER = r; }
export function setSun(light) { SUN = light; }
let BAKE_W = 2048; export function setBakeSize(w) { BAKE_W = w; }
const _sun = new THREE.Vector3(-1, 0.5, 0.5).normalize();
const sunDir = () => (SUN ? _sun.copy(SUN.position).normalize() : _sun);

// kind: 0 earth, 1 red homeworld, 2 gas giant, 3 ice, 4 airless moon, 5 burning world
export const PLANETS = {
  calder: { kind: 0, a: "#2a5a8a", b: "#8c7a4c", c: "#2a5624", atm: 0x5aa8ff, cloud: 0xf4f6f8, night: 0xffc070, clouds: 0.62 },
  thessaly: { kind: 2, a: "#b89058", b: "#ead2a2", c: "#7a5030", atm: 0xffc890, ring: [1.45, 2.35, "#d8c4a0"] },
  hale: { kind: 2, a: "#4a3a7a", b: "#a898d8", c: "#241a4a", atm: 0xa080ff },
  corinthBurn: { kind: 5, a: "#2a2a24", b: "#5a4a38", c: "#14120e", atm: 0xff6a30, cloud: 0x2a2420, night: 0xff7a20, clouds: 0.55, lava: 0xff5a10 },
  tessaly: { kind: 3, a: "#7a9ab8", b: "#e8f2ff", c: "#2a4a6a", atm: 0x9ad0ff, cloud: 0xffffff, clouds: 0.3 },
  varenne: { kind: 2, a: "#b0502a", b: "#f0b070", c: "#5a2010", atm: 0xff9050, ring: [1.35, 2.1, "#c89070"] },
  ashkar: { kind: 4, a: "#5a5048", b: "#a89888", c: "#2a2420", atm: 0 },
  deadmoon: { kind: 4, a: "#4a4a4e", b: "#9a9a9e", c: "#1e1e22", atm: 0 },
  hyperion: { kind: 2, a: "#2a7a72", b: "#b0f0e0", c: "#123a3a", atm: 0x60ffd0, ring: [1.5, 2.6, "#a8d8d0"] },
  kethra: { kind: 1, a: "#3a1a10", b: "#c89a60", c: "#5a5a26", atm: 0xff9a50, cloud: 0xe8c8a0, night: 0xff8a30, clouds: 0.4, lava: 0xff4a10 },
  kethraClose: { kind: 1, a: "#3a1a10", b: "#c89a60", c: "#5a5a26", atm: 0xff9a50, cloud: 0xe8c8a0, night: 0xff8a30, clouds: 0.4, lava: 0xff4a10 },
};

// ---------------------------------------------------------------- BAKE
const BAKE_FS = `
precision highp float;
varying vec2 vUv; uniform int uKind, uPass; uniform vec3 uA, uB, uC; uniform float uSeed;
${NOISE_GLSL}
const float PI = 3.14159265;
vec3 dirFromUv(vec2 uv){ float phi = uv.x * 2.0 * PI, th = (1.0 - uv.y) * PI; return vec3(-cos(phi) * sin(th), cos(th), sin(phi) * sin(th)); }
// craters: cellular field, returns height contribution
float craters(vec3 p, float sc, float dens){
  vec3 q = p * sc, i = floor(q), f = fract(q); float h = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 c = i + vec3(x, y, z); vec3 r = hash33(c); if (r.z > dens) continue;
    vec3 o = vec3(x, y, z) + r * 0.8 + 0.1 - f; float d = length(o); float R = 0.25 + r.x * 0.3;
    float t = d / R; if (t > 1.6) continue;
    h += t < 1.0 ? (t * t - 1.0) * 0.9 + 0.15 * smoothstep(0.75, 1.0, t) : 0.3 * exp(-pow((t - 1.0) * 5.0, 2.0));
  }
  return h;
}
void main(){
  vec3 d = dirFromUv(vUv);
  vec3 p = d + vec3(uSeed * 1.37, uSeed * 0.73, uSeed * 2.11);
  vec3 col = uB; float water = 0.0, height = 0.5, night = 0.0, cloud = 0.0, lava = 0.0;
  float lat = abs(d.y);
  if (uKind == 0 || uKind == 1 || uKind == 5) {
    vec3 w = p + 0.38 * vec3(fbm(p * 1.4 + 3.0, 4), fbm(p * 1.4 + 9.0, 4), fbm(p * 1.4 + 17.0, 4));
    float cont = fbm(w * 1.25, 8) + 0.12;
    if (uKind == 1) cont += 0.08;
    float sea = 0.0, e = cont - sea;
    float mtn = ridged(w * 3.4 + 5.0, 7) * smoothstep(0.0, 0.25, e);
    height = e + mtn * 0.35;
    float moist = fbm(p * 2.6 + 31.0, 5) * 0.5 + 0.5;
    float temp = 1.0 - pow(lat, 1.8) * 1.1 - max(e, 0.0) * 0.35 - mtn * 0.25 + fbm(p * 4.0, 3) * 0.12;
    if (e < 0.0) {                                   // seas: deep to shallow shelf
      water = 1.0;
      vec3 deep = uKind == 1 ? vec3(0.07, 0.025, 0.02) : uKind == 5 ? vec3(0.02, 0.025, 0.03) : vec3(0.008, 0.03, 0.09);
      vec3 shelf = uKind == 1 ? vec3(0.22, 0.09, 0.05) : uKind == 5 ? vec3(0.06, 0.06, 0.06) : vec3(0.03, 0.2, 0.28);
      col = mix(deep, shelf, smoothstep(-0.16, 0.0, e) * (0.6 + 0.4 * fbm(p * 9.0, 3)));
    } else {
      vec3 desert = uB, green = uC, dark = uC * 0.55, rock = mix(uB, vec3(0.32, 0.29, 0.26), 0.6), tundra = vec3(0.42, 0.42, 0.36);
      vec3 low = mix(desert, mix(green, dark, smoothstep(0.45, 0.7, moist)), smoothstep(0.18, 0.38, moist + (1.0 - lat) * 0.1));
      if (uKind == 1) low = mix(uB * vec3(1.0, 0.75, 0.55), mix(uC, uC * 0.6, moist), smoothstep(0.45, 0.7, moist) * 0.8);
      col = mix(low, tundra, smoothstep(0.22, 0.02, temp));
      col = mix(col, rock, smoothstep(0.5, 0.8, mtn));
      col *= (0.85 + 0.3 * (fbm(p * 22.0, 4) * 0.5 + 0.5)) * (uKind == 0 ? 0.8 : 1.0);
      col = mix(col, uB * 1.05, smoothstep(0.0, 0.02, e) * (1.0 - smoothstep(0.02, 0.05, e)) * 0.5);   // beaches
      // cities cluster near coasts and rivers, away from poles
      float coast = smoothstep(0.12, 0.0, e);
      float urb = smoothstep(0.62, 0.85, fbm(p * 5.0 + 41.0, 5) * 0.5 + 0.5 + coast * 0.12) * smoothstep(0.75, 0.45, lat);
      float grid = smoothstep(0.55, 0.9, fbm(p * 60.0 + 7.0, 3) * 0.5 + 0.5);
      float spk = step(0.82, hash13(floor(d * 1400.0)));
      night = clamp(urb * (0.25 + grid * 0.9) + spk * smoothstep(0.5, 0.8, fbm(p * 8.0 + 41.0, 4) * 0.5 + 0.5) * 0.5, 0.0, 1.0);
    }
    if (uKind == 0) {                                   // ice caps over land and sea
      float cap = smoothstep(0.91, 0.95, lat + fbm(p * 3.0, 4) * 0.05);
      col = mix(col, vec3(0.92, 0.95, 1.0), cap); water *= 1.0 - cap; night *= 1.0 - cap;
    }
    if (uKind == 1) {                                   // Kethra: unstable mantle, glowing rift lines
      float rift = smoothstep(0.88, 0.97, ridged(p * 2.2 + 13.0, 5));
      lava = rift * (0.5 + 0.5 * fbm(p * 12.0, 3));
      col = mix(col, vec3(0.08, 0.03, 0.02), rift * 0.7);
    }
    if (uKind == 5) {                                   // Corinth burning: charred land, fire fronts, burning cities
      col = mix(col * 0.35, vec3(0.06, 0.05, 0.04), 0.5);
      float front = smoothstep(0.82, 0.95, ridged(p * 3.0 + 7.0, 6)) * step(0.0, e);
      lava = clamp(front + night * 1.4, 0.0, 1.0); night = 0.0;
      col = mix(col, vec3(0.02), front * 0.6);
    }
    // clouds: swirled fbm with latitude belts, cyclones
    vec3 cw = p * 1.0; cw += 0.5 * vec3(fbm(cw * 2.0 + 1.0, 4), fbm(cw * 2.0 + 5.0, 4), fbm(cw * 2.0 + 9.0, 4));
    float c1 = fbm(cw * 2.4 + 50.0, 8) * 0.5 + 0.5;
    float belt = 0.55 + 0.25 * cos(d.y * 9.0) + 0.15 * cos(d.y * 22.0);
    float wisps = smoothstep(0.45, 0.9, ridged(cw * vec3(5.0, 12.0, 5.0), 5));
    cloud = smoothstep(0.48, 0.76, c1 * belt + wisps * 0.12);
  } else if (uKind == 2) {
    // gas giant: turbulent latitude bands, embedded storms
    float y = d.y;
    vec3 t = vec3(d.x * 3.0, d.y * 18.0, d.z * 3.0) + uSeed;
    float turb = fbm(t * vec3(1.0, 0.35, 1.0) + vec3(0.0, fbm(p * 3.0, 4) * 2.0, 0.0), 6);
    float y2 = y + turb * 0.035 + fbm(vec3(d.x * 14.0, d.y * 60.0, d.z * 14.0), 4) * 0.008;
    float band = sin(y2 * 23.0 + sin(y2 * 7.0) * 2.0) * 0.5 + 0.5;
    float band2 = sin(y2 * 61.0 + 1.3) * 0.5 + 0.5;
    float bn = band * 0.75 + (fbm(vec3(d.x * 6.0, d.y * 30.0, d.z * 6.0) + 9.0, 5) * 0.5 + 0.5) * 0.25;
    col = mix(uA, uB, smoothstep(0.1, 0.9, bn));
    col = mix(col, uC, smoothstep(0.7, 0.97, band2) * 0.4);
    col *= 0.88 + 0.24 * (fbm(vec3(d.x * 30.0, d.y * 120.0, d.z * 30.0), 4) * 0.5 + 0.5);
    for (int i = 0; i < 4; i++) {
      vec3 sc = normalize(hash33(vec3(float(i), uSeed, 1.0)) * 2.0 - 1.0); sc.y *= 0.55; sc = normalize(sc);
      vec3 rel = d - sc; float r = length(vec2(length(rel.xz) * 0.55, rel.y * 1.4)) / (0.05 + hash13(sc) * 0.07);
      if (r < 1.4) { float sw = fbm(vec3(rel * 30.0 + r * 2.0), 4) * 0.5 + 0.5;
        vec3 sc2 = mix(uC * 1.3 + vec3(0.12, 0.04, 0.0), uB * 1.05, smoothstep(0.2, 0.9, r) * 0.7 + sw * 0.3);
        col = mix(col, sc2, smoothstep(1.4, 0.5, r) * 0.75); col = mix(col, uB * 1.1, smoothstep(0.12, 0.0, abs(r - 1.05)) * 0.35); }
    }
    height = 0.5 + turb * 0.05;
  } else if (uKind == 3) {
    float n = fbm(p * 2.2, 7) * 0.5 + 0.5;
    col = mix(uB, uA, smoothstep(0.45, 0.75, n));
    float cr = ridged(p * 4.0 + 3.0, 6); float cracks = smoothstep(0.78, 0.92, cr);
    col = mix(col, uC, cracks * 0.75);
    col *= 0.9 + 0.2 * (fbm(p * 30.0, 3) * 0.5 + 0.5);
    height = 0.5 + n * 0.3 - cracks * 0.2; water = 0.35;
    cloud = smoothstep(0.62, 0.85, fbm(p * 2.0 + 80.0, 6) * 0.5 + 0.5) * 0.7;
  } else {
    // airless moon: maria, multi-scale craters, bright ray craters
    float mare = smoothstep(0.1, 0.4, fbm(p * 1.3 + 2.0, 5));
    float h = craters(p, 3.0, 0.35) * 1.0 + craters(p, 7.0, 0.45) * 0.55 + craters(p, 16.0, 0.55) * 0.3 + craters(p, 38.0, 0.6) * 0.14;
    height = 0.5 + h * 0.18 + fbm(p * 8.0, 5) * 0.05;
    col = mix(uB, uA, mare * 0.75);
    col *= 0.8 + 0.35 * (fbm(p * 18.0, 4) * 0.5 + 0.5) + h * 0.12;
    col = mix(col, uC, smoothstep(-0.4, -0.9, h) * 0.3);
  }
  if (uPass == 0) gl_FragColor = vec4(col, water);
  else gl_FragColor = vec4(clamp(height * 0.5 + 0.25, 0.0, 1.0), night, cloud, lava);
}`;
const BCACHE = new Map();
function bake(key, seed) {
  const ck = key + "|" + seed; if (BCACHE.has(ck)) return BCACHE.get(ck);
  const P = PLANETS[key], W = BAKE_W, H = BAKE_W / 2;
  const lin = h => new THREE.Color(h);
  const mat = new THREE.ShaderMaterial({ uniforms: { uKind: { value: P.kind }, uPass: { value: 0 }, uA: { value: lin(P.a) }, uB: { value: lin(P.b) }, uC: { value: lin(P.c) }, uSeed: { value: seed * 0.37 + key.length * 0.11 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`, fragmentShader: BAKE_FS, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), sc = new THREE.Scene(); sc.add(quad); const cam = new THREE.Camera();
  const mk = () => { const rt = new THREE.WebGLRenderTarget(W, H, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping }); rt.texture.wrapS = THREE.RepeatWrapping; rt.texture.anisotropy = 8; return rt; };
  const day = mk(), aux = mk();
  const r = RENDERER, prevRT = r.getRenderTarget(), prevTM = r.toneMapping, prevAC = r.autoClear;
  r.toneMapping = THREE.NoToneMapping; r.autoClear = true;
  mat.uniforms.uPass.value = 0; r.setRenderTarget(day); r.render(sc, cam);
  mat.uniforms.uPass.value = 1; r.setRenderTarget(aux); r.render(sc, cam);
  r.setRenderTarget(prevRT); r.toneMapping = prevTM; r.autoClear = prevAC; mat.dispose(); quad.geometry.dispose();
  const out = { day: day.texture, aux: aux.texture }; BCACHE.set(ck, out); return out;
}

// ---------------------------------------------------------------- RENDER MATERIALS
const VS = `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv; varying vec3 vN, vT, vB, vW;
void main(){ vUv = uv; vec3 n = normalize(normal); vec3 t = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0));
  mat3 m = mat3(modelMatrix); vN = normalize(m * n); vT = normalize(m * t); vB = normalize(cross(vN, vT));
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
#include <logdepthbuf_vertex>
}`;
const SURF_FS = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uDay, uAux; uniform vec3 uSun, uAtm, uNight, uLava, uCloud; uniform float uBump, uSpec, uTime, uHasAtm, uCloudAmt, uKind;
varying vec2 vUv; varying vec3 vN, vT, vB, vW;
void main(){
#include <logdepthbuf_fragment>
  vec4 day = texture2D(uDay, vUv), aux = texture2D(uAux, vUv);
  vec2 px = 1.0 / vec2(textureSize(uAux, 0));
  float h0 = aux.r, hx = texture2D(uAux, vUv + vec2(px.x, 0.0)).r - h0, hy = texture2D(uAux, vUv + vec2(0.0, px.y)).r - h0;
  vec3 N = normalize(vN), Nb = normalize(N - uBump * (hx * vT + hy * vB) * (1.0 - day.a * 0.9));
  vec3 L = normalize(uSun), V = normalize(cameraPosition - vW);
  float ndl = dot(N, L), lit = smoothstep(-0.12, 0.28, ndl);
  float dif = max(dot(Nb, L), 0.0) * 0.92 + 0.04 * lit;
  // cloud shadows from the drifting layer
  float cs = texture2D(uAux, vUv + vec2(uTime * 0.0016 - 0.003, 0.002)).b * uCloudAmt;
  vec3 col = day.rgb * dif * lit * (1.0 - cs * 0.45);
  vec3 H = normalize(L + V); float sp = pow(max(dot(N, H), 0.0), 70.0) * day.a * uSpec * lit;
  col += vec3(1.0, 0.95, 0.85) * sp * 1.6 + vec3(0.5, 0.6, 0.7) * pow(max(dot(N, H), 0.0), 8.0) * day.a * uSpec * 0.06 * lit;
  float dark = 1.0 - smoothstep(-0.18, 0.06, ndl);
  col += uNight * aux.g * dark * 1.6 * (1.0 - cs * 0.7);
  col += uLava * aux.a * (0.55 + 1.6 * dark);
  // atmosphere haze over the disc: thicker toward the limb, tinted, warm at the terminator
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float term = exp(-pow(ndl * 4.0, 2.0));
  col = mix(col, uAtm * (0.35 + 0.65 * lit), rim * 0.55 * smoothstep(-0.25, 0.3, ndl) * uHasAtm);
  col += uAtm * 0.05 * lit * uHasAtm + vec3(1.0, 0.45, 0.15) * term * rim * 0.25 * uHasAtm;
  gl_FragColor = vec4(col, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const CLOUD_FS = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uAux; uniform vec3 uSun, uCloud, uAtm; uniform float uTime, uCloudAmt;
varying vec2 vUv; varying vec3 vN, vT, vB, vW;
void main(){
#include <logdepthbuf_fragment>
  vec2 uv = vUv + vec2(uTime * 0.0016, 0.0);
  float c = texture2D(uAux, uv).b * uCloudAmt; if (c < 0.01) discard;
  vec3 N = normalize(vN), L = normalize(uSun), V = normalize(cameraPosition - vW);
  float ndl = dot(N, L), lit = smoothstep(-0.15, 0.35, ndl);
  vec2 px = 1.0 / vec2(textureSize(uAux, 0)); float h0 = c, hx = texture2D(uAux, uv + vec2(px.x, 0.0)).b * uCloudAmt - h0, hy = texture2D(uAux, uv + vec2(0.0, px.y)).b * uCloudAmt - h0;
  vec3 Nb = normalize(N - 1.8 * (hx * vT + hy * vB));
  float dif = max(dot(Nb, L), 0.0) * 0.85 + 0.15;
  vec3 col = uCloud * dif * lit + uAtm * 0.04;
  col = mix(col, col * vec3(1.0, 0.6, 0.4), exp(-pow(ndl * 5.0, 2.0)) * 0.6);
  float edge = smoothstep(0.0, 0.25, dot(N, V));
  gl_FragColor = vec4(col, c * (0.55 + 0.45 * edge));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const ATM_FS = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun, uAtm; uniform float uThick;
varying vec2 vUv; varying vec3 vN, vT, vB, vW;
void main(){
#include <logdepthbuf_fragment>
  vec3 N = normalize(vN), L = normalize(uSun), V = normalize(cameraPosition - vW);
  float ndv = dot(N, V);                                    // back faces: 0 at the outer edge, -edge at the planet limb
  float edge = -sqrt(max(0.0, 1.0 - 1.0 / (uThick * uThick)));
  float k = smoothstep(0.0, edge, ndv); k = pow(k, 1.7);
  float day = smoothstep(-0.32, 0.45, dot(N, L));
  float term = exp(-pow(dot(N, L) * 3.5, 2.0));
  vec3 col = uAtm * day * 1.25 + vec3(1.0, 0.5, 0.2) * term * 0.45;
  float a = k * (day * 1.3 + term * 0.3);
  gl_FragColor = vec4(col * a, a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const RING_VS = `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vW, vL;
void main(){ vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
#include <logdepthbuf_vertex>
}`;
const RING_FS = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun, uCol, uCenter; uniform float uR0, uR1, uPR, uSeed;
varying vec3 vW, vL;
float h1(float x){ return fract(sin(x * 127.1 + uSeed) * 43758.5453); }
float vn1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
void main(){
#include <logdepthbuf_fragment>
  float r = (length(vL.xy) - uR0) / (uR1 - uR0); if (r < 0.0 || r > 1.0) discard;
  float d = vn1(r * 18.0) * 0.5 + vn1(r * 55.0) * 0.3 + vn1(r * 160.0) * 0.14 + vn1(r * 500.0) * 0.06;
  float gaps = smoothstep(0.02, 0.0, abs(r - 0.62)) + smoothstep(0.015, 0.0, abs(r - 0.33)) * 0.8;
  float dens = smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.85, r) * pow(d, 1.6) * 1.1 * (1.0 - gaps) * (0.55 + 0.45 * smoothstep(0.1, 0.5, r));
  // planet shadow across the rings
  vec3 L = normalize(uSun), P = vW - uCenter; float along = dot(P, L);
  float shadow = along < 0.0 && length(P - L * along) < uPR ? 0.12 : 1.0;
  vec3 col = mix(uCol * vec3(0.8, 0.75, 0.7), uCol * 1.15, d) * shadow * 1.1;
  gl_FragColor = vec4(col * dens, dens * 0.7);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

const GCACHE = new Map();
const SPHERE = () => GCACHE.get("s") || (GCACHE.set("s", new THREE.SphereGeometry(1, 160, 96)), GCACHE.get("s"));
const SPHERE_LO = () => GCACHE.get("l") || (GCACHE.set("l", new THREE.SphereGeometry(1, 96, 64)), GCACHE.get("l"));
const _c = new THREE.Vector3();
export function makePlanet(key, seed = 3) {
  const P = PLANETS[key] || PLANETS.calder; const T = bake(key, seed);
  const t0 = performance.now() / 1000;
  const u = { uSun: { value: new THREE.Vector3() }, uTime: { value: 0 } };
  const before = () => { u.uSun.value.copy(sunDir()); u.uTime.value = performance.now() / 1000 - t0; };
  const hasAtm = P.atm ? 1 : 0, atmC = new THREE.Color(P.atm || 0x000000);
  const surf = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: SURF_FS,
    uniforms: { ...u, uDay: { value: T.day }, uAux: { value: T.aux }, uAtm: { value: atmC }, uNight: { value: new THREE.Color(P.night || 0xffb060) }, uLava: { value: new THREE.Color(P.lava || 0x000000) }, uCloud: { value: new THREE.Color(P.cloud || 0xffffff) },
      uBump: { value: P.kind === 4 ? 5.0 : P.kind === 2 ? 0.4 : 2.6 }, uSpec: { value: P.kind === 0 ? 1.0 : P.kind === 3 ? 0.5 : P.kind === 1 ? 0.6 : 0.0 }, uHasAtm: { value: hasAtm }, uCloudAmt: { value: P.clouds || 0 }, uKind: { value: P.kind } } });
  surf.onBeforeRender = before;
  const g = new THREE.Group(); const m = new THREE.Mesh(SPHERE(), surf); g.add(m); g.userData.surface = m; g.userData.planetKey = key;
  if (P.clouds) {
    const cm = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false,
      uniforms: { ...u, uAux: { value: T.aux }, uCloud: { value: new THREE.Color(P.cloud) }, uAtm: { value: atmC }, uCloudAmt: { value: P.clouds } } });
    cm.onBeforeRender = before; const c = new THREE.Mesh(SPHERE_LO(), cm); c.scale.setScalar(1.006); g.add(c);
  }
  if (P.atm) {
    const thick = 1.045;
    const am = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: ATM_FS, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      uniforms: { ...u, uAtm: { value: atmC }, uThick: { value: thick } } });
    am.onBeforeRender = before; const a = new THREE.Mesh(SPHERE_LO(), am); a.scale.setScalar(thick); g.add(a);
  }
  if (P.ring) {
    const [r0, r1, rc] = P.ring;
    const rm = new THREE.ShaderMaterial({ vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { ...u, uCol: { value: new THREE.Color(rc) }, uCenter: { value: new THREE.Vector3() }, uR0: { value: r0 }, uR1: { value: r1 }, uPR: { value: 1 }, uSeed: { value: seed } } });
    const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 256, 1), rm); ring.rotation.x = -Math.PI / 2 + 0.12;
    rm.onBeforeRender = (r, s, cam, geo, obj) => { before(); obj.parent.getWorldPosition(rm.uniforms.uCenter.value); rm.uniforms.uPR.value = obj.parent.getWorldScale(_c).x; };
    g.add(ring);
  }
  return g;
}

// ---------------------------------------------------------------- ASTEROIDS
export function makeAsteroidGeo(seed) {
  let s = (seed * 2654435761) >>> 0 || 1; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const g = new THREE.IcosahedronGeometry(1, 4); const p = g.attributes.position;
  const lumps = Array.from({ length: 9 }, () => [new THREE.Vector3(R() - .5, R() - .5, R() - .5).normalize(), (R() - 0.35) * 0.45, 1.5 + R() * 3]);
  const pits = Array.from({ length: 14 }, () => [new THREE.Vector3(R() - .5, R() - .5, R() - .5).normalize(), 0.12 + R() * 0.3, 0.08 + R() * 0.12]);
  const facets = Array.from({ length: 5 }, () => [new THREE.Vector3(R() - .5, R() - .5, R() - .5).normalize(), 0.72 + R() * 0.2]);
  const v = new THREE.Vector3(), n3 = (x, y, z) => { const t = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453; return t - Math.floor(t); };
  const vn = (x, y, z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz); let r = 0; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) r += n3(ix + a, iy + b, iz + c) * (a ? sx : 1 - sx) * (b ? sy : 1 - sy) * (c ? sz : 1 - sz); return r; };
  const elong = 0.6 + R() * 0.45, flat = 0.7 + R() * 0.3;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const dir = v.clone();
    let k = 1; for (const [d, a, sh] of lumps) k += a * Math.max(0, dir.dot(d)) ** sh;
    for (const [d, r, depth] of pits) { const ang = Math.acos(Math.min(1, dir.dot(d))) / r; if (ang < 1.3) k += ang < 1 ? -depth * (1 - ang * ang) : depth * 0.4 * Math.exp(-((ang - 1.05) ** 2) * 40); }
    let f = 0, amp = 0.16, fr = 2.2; for (let o = 0; o < 5; o++) { f += (vn(dir.x * fr + 3, dir.y * fr + 7, dir.z * fr + 11) - 0.5) * amp; fr *= 2.1; amp *= 0.5; } k += f;
    v.multiplyScalar(k); for (const [d, c] of facets) { const t = v.dot(d); if (t > c) v.addScaledVector(d, (c - t) * 0.85); }     // fractured flat faces
    v.x *= 1 / elong; v.y *= flat; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
let ROCK = null;
export function asteroidMaterial() {
  if (ROCK) return ROCK;
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
  const b = document.createElement("canvas"); b.width = b.height = S; const bx = b.getContext("2d");
  x.fillStyle = "#4e4842"; x.fillRect(0, 0, S, S); bx.fillStyle = "#808080"; bx.fillRect(0, 0, S, S);
  const rnd = (() => { let s = 99; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  for (let i = 0; i < 2600; i++) { const px = rnd() * S, py = rnd() * S, r = 1 + Math.pow(rnd(), 3) * 40, dk = rnd() < 0.55;
    for (const [ctx, cs] of [[x, dk ? `rgba(22,20,18,${0.08 + rnd() * 0.2})` : `rgba(140,128,114,${0.06 + rnd() * 0.16})`], [bx, dk ? "rgba(40,40,40,.25)" : "rgba(200,200,200,.2)"]]) { ctx.fillStyle = cs; ctx.beginPath(); ctx.ellipse(px, py, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, 7); ctx.fill(); } }
  for (let i = 0; i < 160; i++) { const px = rnd() * S, py = rnd() * S, r = 4 + Math.pow(rnd(), 2) * 30;     // small craters: dark bowl, bright rim
    for (const [ctx, a, bcol] of [[x, "rgba(18,16,14,.45)", "rgba(170,160,145,.35)"], [bx, "rgba(20,20,20,.7)", "rgba(230,230,230,.6)"]]) { ctx.fillStyle = a; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); ctx.strokeStyle = bcol; ctx.lineWidth = Math.max(1, r * 0.18); ctx.beginPath(); ctx.arc(px - r * 0.1, py - r * 0.1, r, 0, 7); ctx.stroke(); } }
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(16,14,12,${0.25 + rnd() * 0.3})`; bx.strokeStyle = "rgba(10,10,10,.8)"; x.lineWidth = bx.lineWidth = 0.6 + rnd() * 1.6; let px = rnd() * S, py = rnd() * S; x.beginPath(); bx.beginPath(); x.moveTo(px, py); bx.moveTo(px, py); for (let k = 0; k < 8; k++) { px += (rnd() - 0.5) * 50; py += (rnd() - 0.5) * 50; x.lineTo(px, py); bx.lineTo(px, py); } x.stroke(); bx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  const bt = new THREE.CanvasTexture(b); bt.wrapS = bt.wrapT = THREE.RepeatWrapping;
  ROCK = new THREE.MeshStandardMaterial({ map: t, bumpMap: bt, bumpScale: 4, roughness: 0.93, metalness: 0.06, color: 0xd8d0c8 });
  return ROCK;
}
