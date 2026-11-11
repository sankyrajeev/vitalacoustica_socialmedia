// Cardioid sub array, seen from above the dance floor.
// The pressure field is computed, not drawn: two point sources a quarter wavelength
// apart, the rear one delayed by the travel time between them and polarity-inverted.
import * as THREE from 'three';
import { loadPost, Frame, clamp, ramp, lerp, easeOutBounce } from '../shared/frame.js';

const post = await loadPost();
const { spec, beats } = post;
const W = 1080, H = 1920;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

// ---- Physics -------------------------------------------------------------
const f = spec.params.freq_hz, c = spec.params.speed_of_sound;
const lambda = c / f, d = lambda / 4, k = 2 * Math.PI / lambda;
const delayMs = d / c * 1000;
const SLOW = 0.9 / f;                 // slow motion: 60 Hz plays as 0.9 cycles per second
const omega = 2 * Math.PI * f * SLOW; // visual angular frequency
const cVis = c * SLOW;                // visual wave speed, metres per video second
const SRC = [
  { x: 0, z: 0, pol: 1, phase: 0 },           // front sub, faces the crowd (+z)
  { x: 0, z: -d, pol: -1, phase: k * d },     // rear sub: delayed by d/c, polarity flipped
];
const amp = r => 1 / Math.sqrt(r + 1.2);      // softened spreading loss, for legibility
const tFront = 0.4;                            // front sub starts
const tRear = beats.add.end - 0.5;             // rear sub starts
const onTimes = [tFront, tRear];
const env = (i, r, t) => ramp(cVis * (t - onTimes[i]) - r, 0, 2.5);
// Level at a point: magnitude of the summed phasors, in dB relative to the front sub alone.
function levelDb(x, z, t) {
  let re = 0, im = 0;
  SRC.forEach((s, i) => {
    const r = Math.hypot(x - s.x, z - s.z), a = s.pol * amp(r) * env(i, r, t), ph = k * r + s.phase;
    re += a * Math.cos(ph); im += a * Math.sin(ph);
  });
  const ref = amp(Math.hypot(x - SRC[0].x, z - SRC[0].z));
  return { db: 20 * Math.log10(Math.max(Math.hypot(re, im) / ref, 1e-3)), lin: Math.hypot(re, im) };
}

// ---- Scene ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1); renderer.setClearColor(C.obsidian);
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 400);

// Pressure field as a grid of dots that rise and brighten with the wave.
const FX = 14, FZ0 = -17, FZ1 = 15, NX = 150, NZ = 170;
const pts = new Float32Array(NX * NZ * 3);
for (let j = 0, n = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
  pts[n++] = lerp(-FX, FX, i / (NX - 1)) + (j % 2 ? FX / NX : 0); pts[n++] = 0; pts[n++] = lerp(FZ0, FZ1, j / (NZ - 1));
}
const fieldGeo = new THREE.BufferGeometry(); fieldGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
const field = new THREE.Points(fieldGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: {
    uT: { value: 0 }, uK: { value: k }, uOmega: { value: omega }, uC: { value: cVis },
    uSrc: { value: SRC.map(s => new THREE.Vector4(s.x, s.z, s.pol, s.phase)) },
    uOn: { value: onTimes },
    uBrass: { value: new THREE.Color(C.brass) }, uIvory: { value: new THREE.Color(C.ivory) }, uGrey: { value: new THREE.Color(C.grey) },
    uExt: { value: new THREE.Vector3(FX, FZ0, FZ1) },
  },
  vertexShader: `
    uniform float uT, uK, uOmega, uC; uniform vec4 uSrc[2]; uniform float uOn[2]; uniform vec3 uExt;
    varying float vP; varying float vFade;
    void main() {
      vec3 p = position; float s = 0.0; float near = 1e3;
      for (int i = 0; i < 2; i++) {
        float r = distance(p.xz, uSrc[i].xy); near = min(near, r);
        float e = smoothstep(0.0, 2.5, uC * (uT - uOn[i]) - r);
        s += uSrc[i].z * e * sin(uK * r - uOmega * (uT - uOn[i]) + uSrc[i].w) / sqrt(r + 1.2);
      }
      float clear = smoothstep(1.7, 3.4, near);   // keep the dots off the cabinets
      s *= clear; vP = s; p.y = s * 1.5;
      vFade = clear * smoothstep(uExt.x, uExt.x - 4.0, abs(p.x)) * smoothstep(uExt.y, uExt.y + 4.0, p.z) * smoothstep(uExt.z, uExt.z - 4.0, p.z);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (2.4 + 9.0 * max(s, 0.0)) * (118.0 / -mv.z);
    }`,
  fragmentShader: `
    uniform vec3 uBrass, uIvory, uGrey; varying float vP; varying float vFade;
    void main() {
      float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
      float up = clamp(vP * 1.75, 0.0, 1.0);
      vec3 col = mix(uGrey, uBrass, smoothstep(0.02, 0.45, up)); col = mix(col, uIvory, smoothstep(0.8, 1.0, up) * 0.85);
      float a = mix(0.20, 1.0, up) * vFade * smoothstep(0.5, 0.3, r);
      gl_FragColor = vec4(col, a);
    }`,
}));
scene.add(field);

// Subwoofers: charcoal boxes with a brass outline and a grille on the driver side.
function makeSub(facing) {
  const g = new THREE.Group(), w = 2.5, h = 1.25, dp = 1.36;
  const box = new THREE.BoxGeometry(w, h, dp);
  g.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: C.charcoal })));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: C.brass })));
  for (const x of [-0.6, 0.6]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.42, 40), new THREE.MeshBasicMaterial({ color: C.brass, side: THREE.DoubleSide }));
    ring.position.set(x, 0, facing * (dp / 2 + 0.01)); g.add(ring);
    const top = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.34, 40), new THREE.MeshBasicMaterial({ color: C.grey, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
    top.rotation.x = -Math.PI / 2; top.position.set(x, h / 2 + 0.01, 0); g.add(top);
  }
  g.userData.h = h; return g;
}
const subF = makeSub(1), subR = makeSub(-1);
subF.position.set(0, subF.userData.h / 2, 0); subR.position.set(0, 0, -d);
scene.add(subF, subR);

// Stage behind the subs, with a microphone on it.
const stageGrp = new THREE.Group();
const slab = new THREE.BoxGeometry(17, 0.4, 6);
stageGrp.add(new THREE.Mesh(slab, new THREE.MeshBasicMaterial({ color: C.charcoal, transparent: true, opacity: 0.38, depthWrite: false })));
stageGrp.add(new THREE.LineSegments(new THREE.EdgesGeometry(slab), new THREE.LineBasicMaterial({ color: C.grey, transparent: true, opacity: 0.55 })));
stageGrp.position.set(0, 0.2, -8.6); stageGrp.renderOrder = -1; scene.add(stageGrp);
const mic = new THREE.Group();
mic.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3), new THREE.MeshBasicMaterial({ color: C.grey })));
const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), new THREE.MeshBasicMaterial({ color: C.ivory })); head.position.y = 1.25; mic.add(head);
const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 48), new THREE.MeshBasicMaterial({ color: C.brass, side: THREE.DoubleSide, transparent: true }));
halo.position.y = 1.25; mic.add(halo);
mic.position.set(0, 1.55, -8.4); scene.add(mic);

// Crowd: dots that jump with the bass where they stand.
const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(7);
const people = [];
const crowd = new THREE.InstancedMesh(new THREE.SphereGeometry(0.21, 14, 10), new THREE.MeshBasicMaterial({ color: C.ivory }), 110);
for (let i = 0; i < 110; i++) people.push({ x: lerp(-10.5, 10.5, rnd()), z: lerp(4.2, 11.8, rnd()), ph: rnd() * 0.6 });
scene.add(crowd);
const M = new THREE.Matrix4();

// ---- Labels --------------------------------------------------------------
const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagStage"><span class="va-label">On stage</span><span class="val">0 dB</span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagFloor"><span class="va-label">Dance floor</span><span class="val">0 dB</span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="note"><b>Rear sub</b><br>Delayed ${delayMs.toFixed(1)} ms<br>Polarity flipped<br>${d.toFixed(2)} m behind<br>¼ wave at ${f} Hz</div>`);
const frame = new Frame(ui, post);
const tagStage = ui.querySelector('#tagStage'), tagFloor = ui.querySelector('#tagFloor'), note = ui.querySelector('#note');
const v = new THREE.Vector3();
const place = (el, x, y, z) => { v.set(x, y, z).project(camera); el.style.left = (v.x * 0.5 + 0.5) * W + 'px'; el.style.top = (-v.y * 0.5 + 0.5) * H + 'px'; };
const stagePts = [[-3, -8.4], [0, -8.4], [3, -8.4], [0, -10.5]], floorPts = [[-4, 8], [0, 8], [4, 8], [0, 11]];
const avgDb = (ptsList, t) => { let s = 0; for (const [x, z] of ptsList) s += levelDb(x, z, t).lin / amp(Math.hypot(x, z)); return 20 * Math.log10(Math.max(s / ptsList.length, 1e-3)); };
function setTag(el, db, show) {
  const shown = clamp(db, -30, 12), txt = (shown > 0.5 ? '+' : shown < -0.5 ? '−' : '') + Math.abs(Math.round(shown)) + ' dB';
  el.querySelector('.val').textContent = txt;
  el.querySelector('i').style.width = clamp((shown + 30) / 42) * 100 + '%';
  el.style.opacity = show;
}

// ---- Timeline ------------------------------------------------------------
function renderFrame(t) {
  // Camera drifts slowly in; it never cuts.
  const drift = t / post.timeline.duration;
  camera.position.set(lerp(-2.5, 2.5, drift), lerp(80, 76, drift), lerp(52, 49, drift));
  camera.lookAt(0, 0, 0.6);
  camera.updateMatrixWorld(); 

  field.material.uniforms.uT.value = t;

  // Rear sub drops in when the narration introduces it.
  const drop = clamp((t - beats.add.start - 0.25) / 0.95);
  subR.visible = drop > 0;
  subR.position.y = subR.userData.h / 2 + 9 * (1 - easeOutBounce(drop));

  // Sub cones pulse; crowd jumps with the local level.
  const pulse = (i) => 1 + 0.035 * Math.sin(omega * (t - onTimes[i])) * ramp(t, onTimes[i], onTimes[i] + 0.5);
  subF.scale.setScalar(pulse(0)); subR.scale.setScalar(pulse(1));
  people.forEach((p, i) => {
    const L = levelDb(p.x, p.z, t).lin, r = Math.hypot(p.x, p.z);
    const hop = Math.max(0, Math.sin(k * r - omega * (t - tFront) + p.ph)) ** 2;
    M.makeTranslation(p.x, 0.3 + 2.6 * L * hop, p.z); crowd.setMatrixAt(i, M);
  });
  crowd.instanceMatrix.needsUpdate = true;

  // Microphone halo shows how much bass is reaching it.
  const micL = levelDb(0, -8.4, t).lin / amp(8.4);
  halo.quaternion.copy(camera.quaternion); halo.scale.setScalar(1 + 1.6 * micL); halo.material.opacity = 0.15 + 0.75 * clamp(micL);

  renderer.render(scene, camera);

  const tagsIn = ramp(t, beats.omni.start + 2.2, beats.omni.start + 2.9) * (1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2));
  setTag(tagStage, avgDb(stagePts, t), tagsIn); setTag(tagFloor, avgDb(floorPts, t), tagsIn);
  note.style.opacity = ramp(t, beats.add.start + 1.9, beats.add.start + 2.5) * (1 - ramp(t, beats.takeaway.start + 1.2, beats.takeaway.start + 1.8));
  place(note, 2.6, 0.6, -d / 2);
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
