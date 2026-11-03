import * as THREE from 'three';

/*
 * Scroll-driven photo ribbon. Adapted from the Vante ribbon: one smoothed scroll
 * value `p` (0..1) drives everything, the ribbon slides along a fixed rail, then
 * six cards land in a 3x2 (or 2x3 on phones) grid. Video textures are replaced
 * by image textures; the shader gains focus/brightness/depth shading so photos
 * blend into the dark page and sharpen on hover.
 */
const BASE = import.meta.env.BASE_URL;
const WORK = [
  { title: 'Mercedes-Benz interior · Before', f: 'merc-before', fy: .62 },
  { title: 'Front seats & floor · Before', f: 'front-before', fy: .6 },
  { title: 'Rear seats & floor · Before', f: 'rear-before', fy: .55 },
  { title: 'Mercedes-Benz interior · After', f: 'merc-after', fy: .62 },
  { title: 'Front seats & floor · After', f: 'front-after', fy: .62 },
  { title: 'Rear seats & floor · After', f: 'rear-after', fy: .6 },
  { title: 'Chevrolet truck interior · Before', f: 'chevy-before', fy: .72 },
  { title: 'Chevrolet truck interior · After', f: 'chevy-after', fy: .55 },
];
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const out = t => 1 - (1 - t) ** 3;
const span = (p, a, b) => clamp((p - a) / (b - a));

export function initHero() {
  /* ---------- renderer ---------- */
  const canvas = $('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  const FOV = 35, camera = new THREE.PerspectiveCamera(FOV, 1, .1, 100);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); document.documentElement.classList.add('static-hero'); });

  /* ---------- ribbon path ---------- */
  let path, PATH_L = 1;
  const SAMPLES = 1200, pathP = [], pathT = [];
  const PH0 = -1.5, PH1 = Math.PI * 2 + 1.35;
  function buildPath() {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, ph = mix(PH0, PH1, t), cs = Math.cos(ph), u = 2 * t - 1;
      // a shallow arc close to the camera, then long runs far behind it
      const depth = cs > 0 ? 7.6 + 16.4 * cs ** .9 : 7.6 + 2.2 * cs;
      const edge = .84 + .5 * span(.14 - t, 0, .14) + .8 * span(t, .84, 1);
      pts.push(new THREE.Vector3(edge * Math.sin(ph) * depth * .561, .5 * Math.sign(u) * Math.abs(u) ** 1.4 * depth * .63, -depth));
    }
    path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    path.arcLengthDivisions = 1500;
    PATH_L = path.getLength(); pathP.length = pathT.length = 0;
    for (let i = 0; i <= SAMPLES; i++) { const u = i / SAMPLES; pathP.push(path.getPointAt(u)); pathT.push(path.getTangentAt(u)); }
  }
  const at = (s, op, ot) => {
    const f = clamp(s / PATH_L) * SAMPLES, i = Math.min(SAMPLES - 1, Math.floor(f)), k = f - i;
    op.lerpVectors(pathP[i], pathP[i + 1], k); ot.lerpVectors(pathT[i], pathT[i + 1], k).normalize();
  };

  /* ---------- cards ---------- */
  const CARD_W = 2.1, CARD_H = 1.32, GAP = .03, STEP = CARD_W + GAP, NX = 28, NY = 3;
  const vs = `varying vec2 vUv;varying float vDepth;
void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`;
  const fs = `uniform sampler2D map;uniform vec2 cover;uniform vec2 focus;uniform float aspect,ready,radius,bright,alpha;varying vec2 vUv;varying float vDepth;
void main(){
  vec2 q=(abs(vUv-.5)-.5)*vec2(aspect,1.)+radius;
  float d=length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
  float px=fwidth(d),a=1.-smoothstep(-px,px,d);
  if(a<.01)discard;
  vec2 uv=vUv;if(!gl_FrontFacing)uv.x=1.-uv.x;
  vec2 off=vec2(focus.x-.5,.5-focus.y)*(1.-cover);
  vec3 tex=texture2D(map,(uv-.5)*cover+.5+off).rgb;
  vec3 c=mix(vec3(.075),tex,ready);
  c*=1.-.26*smoothstep(.18,.62,length(vUv-.5));
  c*=mix(1.,.5,smoothstep(9.,22.,vDepth));
  c*=bright;
  float edge=smoothstep(-.012-px,-.012,d);
  c=mix(c,vec3(.78,.06,.13),edge*.5);
  float fade=mix(1.,.5,smoothstep(14.,24.,vDepth));
  gl_FragColor=vec4(c,a*alpha*fade);
}`;
  const loader = new THREE.TextureLoader();
  const cards = WORK.map(({ title, f, fy }, i) => {
    const geo = new THREE.PlaneGeometry(1, 1, NX, NY);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vs, fragmentShader: fs, transparent: true, side: THREE.DoubleSide,
      uniforms: {
        map: { value: null }, cover: { value: new THREE.Vector2(1, 1) }, focus: { value: new THREE.Vector2(.5, fy) },
        aspect: { value: CARD_W / CARD_H }, ready: { value: 0 }, radius: { value: .018 },
        bright: { value: .9 }, alpha: { value: .93 },
      },
    });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    return { i, title, f, geo, mat, mesh, rect: null, mode: 'hidden', hover: false, b: .9, bt: .9 };
  });
  function loadTextures() {
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    cards.forEach(c => loader.load(`${BASE}img/${c.f}-800.webp`, tex => {
      tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = aniso;
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
      const va = tex.image.width / tex.image.height, ca = CARD_W / CARD_H;
      c.mat.uniforms.cover.value.set(va > ca ? ca / va : 1, va > ca ? 1 : va / ca);
      c.mat.uniforms.map.value = tex; c.mat.uniforms.ready.value = 1;
      dirty = true; kick();
    }));
  }

  /* ---------- layout ---------- */
  const GZ = 8;
  let W = 1, H = 1, asp = 1, cols = 3, rows = 2, tanH = .3153, runEnd = 76, RISE = 34;
  function resize() {
    W = innerWidth; H = innerHeight; asp = W / H; RISE = H < 520 ? 26 : 34;
    // headline must fully clear the screen at the end of its run, even on narrow phones
    const wide = Math.max(...['l1', 'l2'].map(id => { const s = $(id).firstElementChild; return s.offsetWidth + (id === 'l1' ? 0 : 0) + .15 * W; }));
    runEnd = Math.max(76, 50 + (wide / 2) / W * 100 + 3);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, H, false);
    camera.aspect = asp; camera.fov = asp < 16 / 9 ? Math.atan(.561 / asp) * 360 / Math.PI : FOV; camera.updateProjectionMatrix();
    tanH = Math.tan(camera.fov * Math.PI / 360);
    cols = asp < .9 ? 2 : 3; rows = asp < .9 ? 3 : 2;
    dirty = true; kick();
  }
  function grid(i) {
    const vh = 2 * GZ * tanH, vw = vh * asp, gw = vw * (cols === 3 ? .74 : .88), gap = gw * .017;
    const cw = (gw - gap * (cols - 1)) / cols, ch = cw / (CARD_W / CARD_H), gh = ch * rows + gap * 1.6 * (rows - 1);
    const c = i % cols, r = Math.floor(i / cols);
    return { x: -gw / 2 + cw / 2 + c * (cw + gap), y: gh / 2 - ch / 2 - r * (ch + gap * 1.6), w: cw, h: ch, vw, vh, c, r };
  }

  /* ---------- scroll ---------- */
  let target = 0, p = 0, dirty = true, active = true, raf = 0;
  const readScroll = () => { const t = $('track'); target = clamp(scrollY / Math.max(1, t.offsetHeight - innerHeight)); kick(); };

  /* ---------- pose ---------- */
  const op = new THREE.Vector3(), ot = new THREE.Vector3(), up = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), vp = new THREE.Vector3();
  function poseRibbon(c, head) {
    const pos = c.geo.attributes.position, centre = head - c.i * STEP;
    for (let iy = 0; iy <= NY; iy++) for (let ix = 0; ix <= NX; ix++) {
      const k = iy * (NX + 1) + ix, lu = ix / NX - .5, lv = .5 - iy / NY;
      at(centre + lu * CARD_W, op, ot);
      // keep the sheet upright, leaning a little into the turn
      up.copy(Y).addScaledVector(ot, -Y.dot(ot)).normalize();
      vp.copy(op).addScaledVector(up, lv * CARD_H);
      pos.setXYZ(k, vp.x, vp.y, vp.z);
    }
    pos.needsUpdate = true;
  }
  function poseGrid(c, q) {
    const g = grid(c.i), pos = c.geo.attributes.position;
    const dx = (g.c - (cols - 1) / 2) * 1.2, dy = g.r < rows / 2 ? 1 : -1;
    const ox = dx * g.vw * .62 * (1 - q), oy = dy * g.vh * (g.c === 1 ? .95 : .34) * (1 - q), tilt = (1 - q) * .22 * (g.c - 1 || .5) * dy;
    const cs = Math.cos(tilt), sn = Math.sin(tilt);
    for (let iy = 0; iy <= NY; iy++) for (let ix = 0; ix <= NX; ix++) {
      const k = iy * (NX + 1) + ix, x = (ix / NX - .5) * g.w, y = (.5 - iy / NY) * g.h;
      pos.setXYZ(k, g.x + ox + x * cs - y * sn, g.y + oy + x * sn + y * cs, -GZ - (1 - q) * .6 * Math.sin(ix / NX * Math.PI));
    }
    pos.needsUpdate = true;
    c.rect = g;
  }

  const RIB_A = .14, RIB_B = .63;
  const el = { car: $('hero-car'), l1: $('l1'), l2: $('l2'), cap: $('cap'), rule: $('rule'), intro: $('intro'), cta: $('gridcta'),
    fade: ['cross', 'glow'].map($) };
  // Vehicle fade, driven by the hero's own scroll progress `p` (0..1), reversible. Opacity + translate only.
  const CAR = [[0, 1], [.1, .85], [.25, .55], [.4, .2], [.5, 0]], CAR_RISE = 30;
  function carOpacity(pp) {
    for (let i = 1; i < CAR.length; i++) if (pp <= CAR[i][0]) { const [a, x] = CAR[i - 1], [b, y] = CAR[i]; return mix(x, y, (pp - a) / (b - a)); }
    return 0;
  }
  function render() {
    const pp = p;
    const co = carOpacity(pp);
    el.car.style.opacity = co.toFixed(3);
    el.car.style.transform = `translate3d(0,${(-(1 - co) * CAR_RISE).toFixed(2)}px,0)`;
    el.car.style.visibility = co < .003 ? 'hidden' : 'visible';
    // headline runs right across the page in opposite directions
    const rise = 1 - out(span(pp, 0, .12));
    const run = mix(-50, runEnd, span(pp, 0, .58));
    el.l1.style.transform = `translate3d(${run}vw,${rise * RISE}vh,0)`;
    el.l2.style.transform = `translate3d(${-run}vw,${rise * RISE}vh,0)`;
    el.cap.style.opacity = 1 - span(pp, .52, .57);
    el.cap.style.transform = `translate(-50%,calc(-50% + ${rise * RISE}vh))`;
    const intro = 1 - span(pp, 0, .05);
    el.fade.forEach(n => n.style.opacity = intro);
    // intro block (name, what we do, area, booking) fades once the show starts; booking stays in the header
    const ia = 1 - span(pp, .04, .13);
    el.intro.style.opacity = ia; el.intro.style.visibility = ia < .02 ? 'hidden' : 'visible';
    const ca = span(pp, .82, .9);
    el.cta.style.opacity = ca; el.cta.style.visibility = ca < .02 ? 'hidden' : 'visible';
    el.rule.style.transform = `scaleX(${ease(span(pp, .72, .86))})`;
    // ribbon, then the grid
    const pr = span(pp, RIB_A, RIB_B), head = mix(0, PATH_L + cards.length * STEP, pr);
    for (const c of cards) {
      const s = head - c.i * STEP, end = PATH_L - CARD_W, u = c.mat.uniforms;
      if (s < end) {
        c.mode = 'rail'; c.mesh.visible = s > CARD_W; c.rect = null;
        u.alpha.value = .93;
        if (c.mesh.visible) poseRibbon(c, head);
      } else if (c.i < cols * rows) {
        // each card flies to its slot the moment it leaves the rail
        const st = mix(RIB_A, RIB_B, (end + c.i * STEP) / (PATH_L + cards.length * STEP)), q = out(span(pp, st, st + .13));
        c.mode = 'grid'; c.mesh.visible = q > .001; u.alpha.value = mix(.93, 1, q);
        if (c.mesh.visible) poseGrid(c, q);
      } else { c.mode = 'hidden'; c.mesh.visible = false; c.rect = null; }
      u.bright.value = c.b;
    }
    renderer.render(scene, camera);
  }

  /* ---------- hover ---------- */
  const nameEl = $('name');
  function setHover(hit) {
    cards.forEach(c => { c.hover = c === hit; });
    kick();
  }
  $('stage').addEventListener('pointermove', e => {
    let hit = null;
    if (p > .86) {
      const nx = (e.clientX / W - .5), ny = (.5 - e.clientY / H);
      for (const c of cards) { const g = c.rect; if (!g) continue; const x = nx * g.vw, y = ny * g.vh; if (Math.abs(x - g.x) < g.w / 2 && Math.abs(y - g.y) < g.h / 2) hit = c; }
    }
    nameEl.style.opacity = hit ? 1 : 0;
    if (hit) { nameEl.textContent = hit.title; nameEl.style.transform = `translate(${e.clientX + 14}px,${e.clientY + 16}px)`; }
    setHover(hit);
  });
  $('stage').addEventListener('pointerleave', () => { nameEl.style.opacity = 0; setHover(null); });

  /* ---------- loop: runs only while something is changing and the hero is on screen ---------- */
  function kick() { if (!raf && active && !document.hidden) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    if (!active || document.hidden) return;
    const prev = p, d = target - p;
    p = Math.abs(d) < .00005 ? target : p + d * .09;
    let anim = p !== target;
    for (const c of cards) {
      c.bt = c.mode === 'grid' ? (c.hover ? 1.14 : .96) : .9;
      const db = c.bt - c.b;
      if (Math.abs(db) > .003) { c.b += db * .18; anim = true; } else c.b = c.bt;
    }
    if (p !== prev || dirty || anim) { render(); dirty = false; }
    if (anim) kick();
  }
  new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active) { dirty = true; kick(); } }).observe($('track'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { dirty = true; kick(); } });
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', resize);

  buildPath(); resize(); readScroll(); p = target; render();
  loadTextures();
  return true;
}
