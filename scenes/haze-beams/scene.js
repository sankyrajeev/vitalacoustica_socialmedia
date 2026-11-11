// Why haze makes a beam visible.
// A beam crosses a dark room: only its landing spot shows. A haze machine then fills
// the air with particles, and each particle inside the beam's cone lights up.
// Every particle's position is a closed-form function of time, so any frame can be
// rendered on its own and the video is identical on every run.
import * as THREE from 'three';
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';

const post = await loadPost();
const { spec, beats } = post;
const W = 1080, H = 1920;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

// ---- Room and timing ----------------------------------------------------
const ROOM = { x: 3.9, y: 7.4, z0: -2.2, z1: 2.2 };       // half-width, height, depth range (metres)
const NOZZLE = new THREE.Vector3(-2.7, 0.45, 0.9);         // haze machine outlet
const TAN = Math.tan(spec.params.beam_half_angle_deg * Math.PI / 180), LENS = 0.13;
const tHaze = beats.haze.start + 0.5;                      // machine starts
const EMIT = 3.6, SPEED = 3.0;                             // seconds of output, spread speed m/s
const tBeam = 0.5;

// Beams: one from the start, three more join for the takeaway.
const FIX = [0, -2.6, 2.6, -1.3, 1.3].map(x => new THREE.Vector3(x, 6.9, 0));
const NB = FIX.length;
function beamState(i, t) {
  const tk = beats.takeaway.start;
  let a, I;
  if (i === 0) { a = 0.12 + 0.3 * Math.sin(0.62 * t + 0.4); I = ramp(t, tBeam, tBeam + 0.5); }
  else { a = 0.5 * Math.sin(0.9 * (t - tk) + i * 1.3) + (FIX[i].x > 0 ? -0.18 : 0.18); I = ramp(t, tk + 0.15 * i, tk + 0.6 + 0.15 * i); }
  const dir = new THREE.Vector3(Math.sin(a), -Math.cos(a), 0.06).normalize();
  return { dir, I };
}

// ---- Scene ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1); renderer.setClearColor(C.obsidian);
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);

// Floor grid and truss, drawn as thin lines.
const line = (pts, color, opacity) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
const grid = [];
for (let x = -ROOM.x; x <= ROOM.x + 1e-6; x += 0.92) grid.push(new THREE.Vector3(x, 0, ROOM.z0 - 1), new THREE.Vector3(x, 0, ROOM.z1 + 1.4));
for (let z = ROOM.z0 - 1; z <= ROOM.z1 + 1.41; z += 0.92) grid.push(new THREE.Vector3(-ROOM.x, 0, z), new THREE.Vector3(ROOM.x, 0, z));
scene.add(line(grid, C.grey, 0.16));
const truss = [], TY = 7.25, TH = 0.42, TX = 3.7;
for (const y of [TY, TY + TH]) for (const z of [-TH / 2, TH / 2]) truss.push(new THREE.Vector3(-TX, y, z), new THREE.Vector3(TX, y, z));
for (let x = -TX, k = 0; x < TX - 1e-6; x += 0.43, k++) {
  const y0 = k % 2 ? TY : TY + TH, y1 = k % 2 ? TY + TH : TY;
  for (const z of [-TH / 2, TH / 2]) truss.push(new THREE.Vector3(x, y0, z), new THREE.Vector3(x + 0.43, y1, z));
}
scene.add(line(truss, C.grey, 0.7));

// Fixtures: a yoke, a head that follows the beam, and a lens that glows.
const fixtures = FIX.map(p => {
  const g = new THREE.Group(); g.position.copy(p);
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.3), new THREE.MeshBasicMaterial({ color: C.charcoal }));
  yoke.position.y = 0.28; g.add(yoke);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 0.36, 0.3)), new THREE.LineBasicMaterial({ color: C.grey })).translateY(0.28));
  const head = new THREE.Group();
  const body = new THREE.CylinderGeometry(0.17, 0.2, 0.5, 20);
  head.add(new THREE.Mesh(body, new THREE.MeshBasicMaterial({ color: C.charcoal })));
  head.add(new THREE.LineSegments(new THREE.EdgesGeometry(body, 30), new THREE.LineBasicMaterial({ color: C.brass })));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshBasicMaterial({ color: C.ivory, transparent: true, side: THREE.DoubleSide }));
  lens.rotation.x = Math.PI / 2; lens.position.y = -0.255; head.add(lens);
  g.add(head); scene.add(g);
  return { g, head, lens };
});
const DOWN = new THREE.Vector3(0, -1, 0);

// Haze machine.
const hazer = new THREE.Group();
const hb = new THREE.BoxGeometry(0.9, 0.5, 0.6);
hazer.add(new THREE.Mesh(hb, new THREE.MeshBasicMaterial({ color: C.charcoal })));
hazer.add(new THREE.LineSegments(new THREE.EdgesGeometry(hb), new THREE.LineBasicMaterial({ color: C.brass })));
hazer.position.set(NOZZLE.x - 0.5, 0.25, NOZZLE.z); scene.add(hazer);

// Landing spots on the floor: visible with or without haze.
const spots = FIX.map(() => {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uI: { value: 0 }, uCol: { value: new THREE.Color(C.ivory) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uI; uniform vec3 uCol; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.55, r); gl_FragColor = vec4(uCol * a * uI, 1.0); }`,
  }));
  m.rotation.x = -Math.PI / 2; scene.add(m); return m;
});

// Dashed guide: where the beam is while you cannot see it.
const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -1, 0)]),
  new THREE.LineDashedMaterial({ color: C.grey, dashSize: 0.16, gapSize: 0.14, transparent: true, opacity: 0 }));
scene.add(guide);

// Shared GLSL: haze density at a point, and how brightly the beams light it.
const GL = `
  uniform float uT, uT0, uEmit, uSpeed, uTan, uLens; uniform vec3 uNozzle;
  uniform vec3 uO[${NB}]; uniform vec3 uD[${NB}]; uniform float uI[${NB}];
  float hazeAt(vec3 p) { return clamp((uT - uT0 - distance(p, uNozzle) / uSpeed) / uEmit, 0.0, 1.0); }
  float litAt(vec3 p) {
    float s = 0.0;
    for (int i = 0; i < ${NB}; i++) {
      vec3 v = p - uO[i]; float h = dot(v, uD[i]);
      float rad = uLens + h * uTan, dist = length(v - h * uD[i]);
      s += uI[i] * step(0.0, h) * smoothstep(rad, rad * 0.45, dist);
    }
    return s;
  }`;
const shared = {
  uT: { value: 0 }, uT0: { value: tHaze }, uEmit: { value: EMIT }, uSpeed: { value: SPEED }, uTan: { value: TAN }, uLens: { value: LENS },
  uNozzle: { value: NOZZLE }, uO: { value: FIX }, uD: { value: FIX.map(() => new THREE.Vector3(0, -1, 0)) }, uI: { value: FIX.map(() => 0) },
};

// Haze particles. Each has a resting place in the room, a release time, and its own drift.
const N = spec.params.particles;
const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(11);
const home = new Float32Array(N * 3), seed = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
  home[i * 3] = lerp(-ROOM.x, ROOM.x, rnd()); home[i * 3 + 1] = lerp(0.05, ROOM.y, rnd()); home[i * 3 + 2] = lerp(ROOM.z0, ROOM.z1, rnd());
  seed[i * 3] = rnd(); seed[i * 3 + 1] = rnd(); seed[i * 3 + 2] = rnd();
}
const pg = new THREE.BufferGeometry();
pg.setAttribute('position', new THREE.BufferAttribute(home, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 20);
const haze = new THREE.Points(pg, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { ...shared, uIvory: { value: new THREE.Color(C.ivory) }, uBrass: { value: new THREE.Color(C.brass) }, uGrey: { value: new THREE.Color(C.grey) } },
  vertexShader: GL + `
    attribute vec3 aSeed; varying float vLit; varying float vOn; varying float vFly;
    void main() {
      float dist = distance(position, uNozzle), travel = dist / uSpeed;
      float release = uT0 + aSeed.x * uEmit;
      float q = clamp((uT - release) / travel, 0.0, 1.0);
      float e = 1.0 - pow(1.0 - q, 2.2);                       // fast out of the machine, slowing as it spreads
      vec3 p = mix(uNozzle, position, e);
      float ph = aSeed.y * 6.2832, swirl = sin(q * 3.1416) * (0.25 + 0.5 * aSeed.z);
      p += swirl * vec3(sin(ph + uT * 1.3), cos(ph * 1.7 + uT * 0.9), sin(ph * 2.3 + uT * 1.1)) * 0.55;
      p += 0.16 * vec3(sin(uT * 0.31 + ph), sin(uT * 0.23 + ph * 1.9), cos(uT * 0.27 + ph * 2.7));   // slow drift once settled
      vOn = step(release, uT) * smoothstep(0.0, 0.06, q);
      vLit = litAt(p); vFly = 1.0 - smoothstep(0.25, 0.95, q);   // the fresh plume is denser, so it shows
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (2.3 + 5.2 * min(vLit, 1.4) + 1.6 * aSeed.z) * (27.0 / -mv.z);
    }`,
  fragmentShader: `
    uniform vec3 uIvory, uBrass, uGrey; varying float vLit; varying float vOn; varying float vFly;
    void main() {
      float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
      float lit = min(vLit, 1.5);
      vec3 col = mix(uGrey * (0.24 + 0.5 * vFly), mix(uBrass, uIvory, 0.55) * (0.55 + 0.35 * lit), smoothstep(0.0, 0.5, lit));
      gl_FragColor = vec4(col * vOn * smoothstep(0.5, 0.2, r), 1.0);
    }`,
}));
scene.add(haze);

// The soft glow of the beam itself: the sum of all the particles too fine to draw.
const cones = FIX.map((o, i) => {
  const L = 9.5, geo = new THREE.CylinderGeometry(LENS, LENS + L * TAN, L, 40, 24, true);
  geo.translate(0, -L / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { ...shared, uGain: { value: 0 }, uCol: { value: new THREE.Color(C.ivory).lerp(new THREE.Color(C.brass), 0.35) } },
    vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: GL + `uniform float uGain; uniform vec3 uCol; varying vec3 vW; varying vec3 vN;
      void main(){ if (vW.y < 0.0) discard; float face = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
        gl_FragColor = vec4(uCol * uGain * hazeAt(vW) * pow(face, 1.6) * 0.34, 1.0); }`,
  }));
  m.position.copy(o); scene.add(m); return m;
});

// ---- Labels --------------------------------------------------------------
const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagHaze"><span class="va-label">Haze in the air</span><span class="val">0%</span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagLight"><span class="va-label">Light output</span><span class="val">100%</span><div class="bar"><i style="width:100%"></i></div></div>
  <div class="va-note va-label" id="noteBeam"><b>The beam is here</b><br>You just can't see it</div>
  <div class="va-note va-label" id="noteHazer"><b>Haze machine</b></div>`);
const frame = new Frame(ui, post);
const tagHaze = ui.querySelector('#tagHaze'), tagLight = ui.querySelector('#tagLight'), noteBeam = ui.querySelector('#noteBeam'), noteHazer = ui.querySelector('#noteHazer');
const v = new THREE.Vector3();
const place = (el, p, dx = 0, dy = 0) => { v.copy(p).project(camera); el.style.left = (v.x * 0.5 + 0.5) * W + dx + 'px'; el.style.top = (-v.y * 0.5 + 0.5) * H + dy + 'px'; };
const roomCentre = new THREE.Vector3(0, ROOM.y / 2, 0);
const hazeFill = t => clamp((t - tHaze - NOZZLE.distanceTo(roomCentre) / SPEED) / EMIT);

// ---- Timeline ------------------------------------------------------------
function renderFrame(t) {
  const drift = t / post.timeline.duration;
  camera.position.set(lerp(-1.0, 1.0, drift), lerp(5.4, 5.0, drift), lerp(30.5, 28.8, drift));
  camera.lookAt(0, 3.2, 0); camera.updateMatrixWorld();
  shared.uT.value = t;

  const main = beamState(0, t);
  FIX.forEach((o, i) => {
    const { dir, I } = beamState(i, t);
    shared.uD.value[i].copy(dir); shared.uI.value[i] = I;
    fixtures[i].head.quaternion.setFromUnitVectors(DOWN, dir);
    fixtures[i].lens.material.opacity = 0.12 + 0.88 * I;
    cones[i].quaternion.setFromUnitVectors(DOWN, dir); cones[i].material.uniforms.uGain.value = I;
    const h = -o.y / dir.y, rad = LENS + h * TAN;
    spots[i].position.set(o.x + dir.x * h, 0.01, o.z + dir.z * h);
    spots[i].scale.set(rad / Math.abs(dir.y), rad, 1); spots[i].material.uniforms.uI.value = I * 1.15;
  });

  // Guide line along the unseen beam, during the "dark" beat only.
  const g = ramp(t, beats.dark.start + 0.6, beats.dark.start + 1.2) * (1 - ramp(t, tHaze + 0.8, tHaze + 2.2));
  const hMain = -FIX[0].y / main.dir.y, land = FIX[0].clone().addScaledVector(main.dir, hMain);
  guide.geometry.setFromPoints([FIX[0], land]); guide.computeLineDistances(); guide.material.opacity = 0.55 * g;

  renderer.render(scene, camera);

  const show = ramp(t, beats.dark.start + 0.4, beats.dark.start + 1.0) * (1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2));
  const fill = hazeFill(t);
  tagHaze.querySelector('.val').textContent = Math.round(fill * 100) + '%'; tagHaze.querySelector('i').style.width = fill * 100 + '%';
  tagHaze.style.opacity = show; tagLight.style.opacity = show;
  noteBeam.style.opacity = g; place(noteBeam, FIX[0].clone().addScaledVector(main.dir, hMain * 0.5), 34, 0);
  noteHazer.style.opacity = ramp(t, tHaze - 0.6, tHaze) * (1 - ramp(t, beats.scatter.end - 0.6, beats.scatter.end));
  place(noteHazer, hazer.position, -70, -92);
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
