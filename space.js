// HALCYON WING — deep space: the baked sky (Milky Way, dust lanes, nebulae, distant galaxies),
// a live starfield that stays pin-sharp at any resolution, and the sun with corona and lens flare.
import * as THREE from "three";
import { Lensflare, LensflareElement } from "three/addons/objects/Lensflare.js";

export const NOISE_GLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p,int oct){ float s=0.,a=.5; for(int i=0;i<10;i++){ if(i>=oct) break; s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
float ridged(vec3 p,int oct){ float s=0.,a=.5,w=1.; for(int i=0;i<10;i++){ if(i>=oct) break; float n=1.-abs(snoise(p)); n*=n; s+=a*n*w; w=clamp(n*1.6,0.,1.); p=p*2.07+vec3(4.1,1.3,7.7); a*=.5; } return s; }
float hash13(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec3 hash33(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
`;

// ---------------------------------------------------------------- SKY (baked into a cubemap by core.setEnv)
export function makeSky(env) {
  const hue = env.hue ?? 0.6;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uHue: { value: hue }, uNeb: { value: env.nebula ? 1.0 : 0.35 }, uSeed: { value: env.seed || 1 }, uWarm: { value: env.warm || 0 } },
    vertexShader: `varying vec3 vDir; varying vec2 vUv; void main(){ vUv = uv; vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      varying vec3 vDir; varying vec2 vUv; uniform float uHue, uNeb, uSeed, uWarm;
      ${NOISE_GLSL}
      vec3 hsv(float h,float s,float v){ vec3 k=clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.); return v*mix(vec3(1),k,s); }
      mat3 rotY(float a){ float c=cos(a),s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
      mat3 rotX(float a){ float c=cos(a),s=sin(a); return mat3(1,0,0, 0,c,s, 0,-s,c); }
      vec3 skyCol(vec3 d){
        vec3 sd = d + uSeed * 0.731;
        // --- galactic frame: a tilted great circle, with the bulge toward one direction
        vec3 g = rotX(0.55 + sin(uSeed) * 0.3) * rotY(uSeed * 1.7) * d;
        float lat = g.y;                                          // galactic latitude (sin)
        float disk = exp(-lat * lat * 38.0);                      // thin disk
        float halo = exp(-lat * lat * 6.0);
        float bulge = exp(-(pow(g.x - 0.92, 2.0) * 3.0 + lat * lat * 16.0));
        // unresolved star glow, broken up by dust lanes
        float clump = fbm(g * 6.0 + 3.0, 6) * 0.5 + 0.5;
        float lanes = smoothstep(0.15, 0.85, ridged(g * vec3(2.2, 9.0, 2.2) + 11.0, 6)) * exp(-lat * lat * 120.0);
        float dust = clamp(lanes * 1.25 + smoothstep(0.55, 0.9, fbm(g * 3.0 + 5.0, 5) * 0.5 + 0.5) * disk * 0.6, 0.0, 1.0);
        vec3 milky = (vec3(0.62, 0.66, 0.78) * disk * (0.35 + clump * 0.9) + vec3(1.0, 0.82, 0.6) * bulge * 1.3 + vec3(0.5, 0.55, 0.7) * halo * 0.08);
        milky *= (1.0 - dust * 0.8);
        milky += vec3(0.25, 0.12, 0.08) * dust * disk * 0.12;     // warm reddened edges of the lanes
        // faint resolved-but-tiny stars that ride the disk density (the bright ones are a live point layer)
        vec3 q = d * 900.0; float s1 = hash13(floor(q)); float tiny = step(0.985 - disk * 0.02, s1) * smoothstep(0.5, 0.1, length(fract(q) - 0.5));
        vec3 q2 = d * 2200.0; float s2 = hash13(floor(q2) + 7.0); tiny += step(0.993 - disk * 0.03, s2) * 0.6;
        vec3 col = vec3(0.0035, 0.0045, 0.008) + milky * 0.05 + tiny * vec3(0.55, 0.6, 0.7) * (0.12 + disk * 0.3);
        // --- emission nebulae: domain-warped clouds in two hues with dark filaments and bright cores
        vec3 w = sd * 1.6; vec3 o = vec3(fbm(w + 1.0, 4), fbm(w + 7.0, 4), fbm(w + 13.0, 4));
        float n1 = fbm(w * 1.3 + o * 1.4, 7) * 0.5 + 0.5;
        float n2 = fbm(w * 2.6 - o * 1.1 + 4.0, 6) * 0.5 + 0.5;
        float mask = smoothstep(0.38, 0.75, fbm(sd * 0.9 + 21.0, 4) * 0.5 + 0.5);
        float fil = smoothstep(0.55, 0.95, ridged(w * 3.0 + o, 5));
        float gas = pow(n1, 3.2) * mask;
        vec3 neb = hsv(uHue + (n2 - 0.5) * 0.12, 0.8, 1.0) * gas * 1.8;
        neb += hsv(uHue + 0.5 + uWarm, 0.75, 1.0) * pow(n2, 5.0) * mask * 0.9;
        neb += vec3(1.0, 0.9, 0.85) * pow(max(gas - 0.18, 0.0), 2.0) * 3.0;      // hot cores
        neb *= 1.0 - fil * 0.75 * mask;                                         // dark filaments
        col += neb * 0.3 * uNeb;
        // reflection-nebula wisps near the galactic plane
        col += hsv(0.6, 0.5, 1.0) * pow(clump, 6.0) * disk * 0.05 * uNeb;
        // --- a few distant galaxies: tilted elliptical smudges with bright cores
        for (int i = 0; i < 9; i++) {
          vec3 c = normalize(hash33(vec3(float(i) * 7.1, uSeed, 3.3)) * 2.0 - 1.0);
          float dd = dot(d, c); if (dd < 0.995) continue;
          vec3 ax = normalize(cross(c, vec3(0.3, 1.0, 0.1))), ay = cross(c, ax);
          float ang = hash13(c * 9.0) * 6.28; vec2 uv = vec2(dot(d, ax), dot(d, ay)); uv = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * uv;
          float sz = 0.0025 + hash13(c * 3.0) * 0.004; uv.y *= 2.0 + hash13(c) * 3.0;
          float r = length(uv) / sz;
          col += mix(vec3(1.0, 0.85, 0.7), vec3(0.7, 0.8, 1.0), hash13(c * 5.0)) * (exp(-r * r * 6.0) * 0.35 + exp(-r * 2.2) * 0.12);
        }
        return col;
      }
      void main(){
      #ifdef BAKE
        // equirectangular: same convention as THREE.EquirectangularReflectionMapping, so there are no faces and no seams
        float phi = (vUv.x - 0.5) * 6.2831853, th = (vUv.y - 0.5) * 3.1415927;
        vec3 d = vec3(cos(th) * cos(phi), sin(th), cos(th) * sin(phi));
        vec3 col = skyCol(d);
        col += (hash13(vec3(gl_FragCoord.xy, 7.0)) - 0.5) / 255.0;         // dither: no banding in the dark gradients
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      #else
        gl_FragColor = vec4(skyCol(normalize(vDir)), 1.0);
      #endif
      }`,
  });
  if (env.bake) { mat.defines = { BAKE: 1 }; mat.side = THREE.FrontSide; mat.vertexShader = `varying vec2 vUv; varying vec3 vDir; void main(){ vUv = uv; vDir = vec3(0.0); gl_Position = vec4(position.xy, 0.0, 1.0); }`; return mat; }
  const m = new THREE.Mesh(new THREE.SphereGeometry(50000, 64, 48), mat); m.frustumCulled = false; m.renderOrder = -10; return m;
}

// ---------------------------------------------------------------- STARFIELD (live, follows the camera)
// Star colours follow a blackbody-ish spread; counts follow magnitude (many faint, few bright).
const STAR_COLS = [[0.62, 0.72, 1.0], [0.78, 0.84, 1.0], [0.95, 0.96, 1.0], [1.0, 0.96, 0.88], [1.0, 0.86, 0.66], [1.0, 0.72, 0.48], [1.0, 0.6, 0.4]];
export function makeStarfield(seed = 3) {
  let s = (seed * 2654435761) >>> 0 || 1; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const N = 9000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), mag = new Float32Array(N);
  // galactic plane for density bias (matches nothing exactly; just keeps the sky from looking uniform)
  const tilt = new THREE.Matrix4().makeRotationX(0.55).multiply(new THREE.Matrix4().makeRotationY(seed * 1.7));
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    let tries = 0;
    do { v.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); } while ((v.lengthSq() > 1 || v.lengthSq() < 0.01) && ++tries < 20);
    v.normalize();
    if (i < N * 0.45) { const g = v.clone().applyMatrix4(tilt); g.y *= 0.18 + R() * 0.25; v.copy(g.normalize().applyMatrix4(tilt.clone().invert())); }
    pos.set([v.x, v.y, v.z], i * 3);
    const t = Math.pow(R(), 1.6) * (STAR_COLS.length - 1); const a = STAR_COLS[Math.floor(t)], b = STAR_COLS[Math.min(STAR_COLS.length - 1, Math.floor(t) + 1)], f = t % 1;
    const c = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    // shuffle so cool stars are not all faint: hot blue giants are rare but bright
    const m = Math.pow(R(), 5.5);                  // 0 = faint, 1 = brilliant
    col.set(c, i * 3); mag[i] = m;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("mag", new THREE.BufferAttribute(mag, 1));
  const mat = new THREE.ShaderMaterial({
    depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, transparent: false,
    uniforms: { uScale: { value: 1 }, uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `attribute float mag; attribute vec3 color; varying vec3 vCol; varying float vMag; uniform float uScale, uTime;
      void main(){ vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); p.z = p.w * 0.99999; gl_Position = p;
        float tw = 1.0 + 0.12 * sin(uTime * (2.0 + fract(position.x * 91.0) * 5.0) + position.y * 40.0);
        vMag = mag; vCol = color * (0.22 + mag * 1.6) * tw; gl_PointSize = (1.3 + mag * 5.5) * uScale; }`,
    fragmentShader: `varying vec3 vCol; varying float vMag; uniform float uFade;
      void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
        float win = 1.0 - smoothstep(0.55, 1.0, r);
        float core = exp(-r * r * 10.0), glow = exp(-r * 6.0) * 0.22 * vMag;
        float spike = vMag > 0.6 ? (exp(-abs(c.x) * 70.0) + exp(-abs(c.y) * 70.0)) * 0.35 * vMag : 0.0;
        float a = (core + glow + spike) * win; if (a < 0.002) discard;
        gl_FragColor = vec4(vCol * a * uFade, 1.0); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = -9; pts.userData.isStarfield = true;
  return pts;
}

// ---------------------------------------------------------------- SUN (disc, corona, lens flare)
function radial(stops, size = 256) {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); for (const [o, col] of stops) g.addColorStop(o, col); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function streak(size = 512) {
  const c = document.createElement("canvas"); c.width = size; c.height = 64; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, size, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; for (let i = 0; i < 64; i++) { x.globalAlpha = Math.exp(-Math.pow((i - 32) / 6, 2)); x.fillRect(0, i, size, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function rays(size = 512) {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"); x.translate(size / 2, size / 2);
  for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, l = size * (0.15 + Math.random() * 0.35), w = 0.6 + Math.random() * 1.8; const g = x.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l); g.addColorStop(0, "rgba(255,240,220,.35)"); g.addColorStop(1, "rgba(255,240,220,0)"); x.strokeStyle = g; x.lineWidth = w; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * l, Math.sin(a) * l); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SUNTX = {};
export function makeSun(color = 0xfff0d8) {
  SUNTX.disc ||= radial([[0, "rgba(255,255,255,1)"], [0.18, "rgba(255,252,240,1)"], [0.24, "rgba(255,230,190,.85)"], [0.4, "rgba(255,190,120,.25)"], [1, "rgba(255,160,80,0)"]]);
  SUNTX.corona ||= radial([[0, "rgba(255,240,215,.55)"], [0.15, "rgba(255,220,180,.22)"], [0.45, "rgba(255,190,140,.06)"], [1, "rgba(255,180,120,0)"]]);
  SUNTX.ring ||= radial([[0, "rgba(255,255,255,0)"], [0.62, "rgba(255,255,255,0)"], [0.7, "rgba(160,200,255,.22)"], [0.78, "rgba(255,190,140,.12)"], [0.86, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,0)"]]);
  SUNTX.ghost ||= radial([[0, "rgba(255,255,255,.35)"], [0.55, "rgba(255,255,255,.18)"], [0.85, "rgba(255,255,255,.3)"], [1, "rgba(255,255,255,0)"]], 128);
  SUNTX.streak ||= streak(); SUNTX.rays ||= rays();
  const g = new THREE.Group(); g.userData.isSun = true;
  const sp = (tex, s, c, o = 1) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: o, fog: false })); m.scale.setScalar(s); g.add(m); return m; };
  sp(SUNTX.corona, 30000, color, 0.9); sp(SUNTX.rays, 22000, color, 0.7); sp(SUNTX.disc, 6500, 0xffffff);
  // lens flare: anamorphic streak, ring and coloured ghosts along the axis
  const lf = new Lensflare();
  lf.addElement(new LensflareElement(SUNTX.disc, 220, 0, new THREE.Color(0xfff4e0)));
  lf.addElement(new LensflareElement(SUNTX.streak, 900, 0, new THREE.Color(0x9ab8ff)));
  lf.addElement(new LensflareElement(SUNTX.ring, 420, 0.0, new THREE.Color(0xffffff)));
  for (const [s, d, c] of [[60, 0.35, 0x8ab0ff], [110, 0.55, 0xffc890], [40, 0.7, 0x90ffd0], [180, 0.9, 0x7090ff], [70, 1.1, 0xffa070], [260, 1.35, 0x5070c0]]) lf.addElement(new LensflareElement(SUNTX.ghost, s, d, new THREE.Color(c)));
  lf.position.set(0, 0, 0); g.add(lf); g.userData.flare = lf;
  return g;
}
