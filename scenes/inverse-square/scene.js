// Inverse-square law. Energy leaves a point source as spherical shells of dots; the
// number of dots in a shell never changes, so the same dots spread over more area as
// they travel. Square frames at 1, 2 and 4 m show it: one cell, four, sixteen.
// Levels shown are 20·log10(r0/r), computed, for a point source in open air.
import * as THREE from 'three';
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const W = 1080, H = 1920;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

const R = spec.params.distances_m;           // frames, metres
const L = 4.9;                               // drawn length of the pyramid
const SPEED = 1.15, SPACING = 0.62;          // visual shell speed (m/s) and spacing (m)
const t0 = 0.35;                             // emission starts
const dB = r => 20 * Math.log10(R[0] / r);

// When things appear, tied to the words that introduce them.
const tF = [wordAt(beats.double, /^one/), wordAt(beats.double, /^two/), wordAt(beats.level, /^doubles/)];
const tMove2 = tF[1], tMove4 = tF[2];

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1); renderer.setClearColor(C.obsidian);
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);
// The diagram is built along +z, then tilted so the sound travels down the screen toward the viewer.
const rig = new THREE.Group(); rig.rotation.x = 0.92; rig.position.set(0, 3.1, -1.2); scene.add(rig);
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });
const segs = (pts, mat) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);

// Speaker: a box with a driver facing +z.
const spk = new THREE.Group();
const box = new THREE.BoxGeometry(0.62, 0.62, 0.5);
spk.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: C.charcoal })));
spk.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), lineMat(C.brass, 1)));
const drv = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.21, 40), new THREE.MeshBasicMaterial({ color: C.brass, side: THREE.DoubleSide }));
drv.position.z = 0.26; spk.add(drv);
spk.position.z = -0.27; rig.add(spk);

// Pyramid edges: the boundary of the energy we follow.
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const edgeMat = lineMat(C.grey, 0); 
const edges = segs([[1, 1], [1, -1], [-1, 1], [-1, -1]].flatMap(([a, b]) => [V3(0, 0, 0), V3(a * L / 2, b * L / 2, L)]), edgeMat);
rig.add(edges);

// Frames: outline + 1 m grid + cells whose fill shows the energy per square metre (1/r²).
const frames = R.map(r => {
  const g = new THREE.Group(), h = r / 2, pts = [];
  for (let k = 0; k <= r; k++) { const x = -h + k; pts.push(V3(x, -h, r), V3(x, h, r), V3(-h, x, r), V3(h, x, r)); }
  const grid = segs(pts, lineMat(C.ivory, 0)); g.add(grid);
  const cells = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ color: C.brass, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), r * r);
  const M = new THREE.Matrix4(); let n = 0;
  for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) cells.setMatrixAt(n++, M.makeTranslation(-h + 0.5 + i, -h + 0.5 + j, r));
  g.add(cells); rig.add(g);
  return { r, grid, cells };
});

// Energy dots on spherical shells. Each dot keeps its direction; only its radius changes.
const N = spec.params.particles;
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(5);
const dir = new Float32Array(N * 3), ph = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const u = rnd() - 0.5, v = rnd() - 0.5, len = Math.hypot(u, v, 1);
  dir[i * 3] = u / len; dir[i * 3 + 1] = v / len; dir[i * 3 + 2] = 1 / len;
  ph[i] = Math.floor(rnd() * 8) * SPACING + rnd() * 0.035;
}
const dg = new THREE.BufferGeometry();
dg.setAttribute('position', new THREE.BufferAttribute(dir, 3)); dg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
dg.boundingSphere = new THREE.Sphere(V3(0, 0, 2.5), 10);
const dots = new THREE.Points(dg, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uT: { value: 0 }, uL: { value: L }, uSpeed: { value: SPEED }, uSpan: { value: 8 * SPACING }, uBrass: { value: new THREE.Color(C.brass) }, uIvory: { value: new THREE.Color(C.ivory) } },
  vertexShader: `
    uniform float uT, uL, uSpeed, uSpan; attribute float aPh; varying float vA;
    void main() {
      float travelled = uSpeed * uT;
      float rho = mod(travelled - aPh, uSpan) + 0.32;          // radius of this dot's shell
      float emitted = step(aPh, travelled);                       // shell has left the speaker
      vec3 p = position * rho;
      vA = emitted * smoothstep(0.32, 0.5, rho) * (1.0 - smoothstep(uL - 0.5, uL, p.z));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = 4.2 * (16.0 / -mv.z);
    }`,
  fragmentShader: `
    uniform vec3 uBrass, uIvory; varying float vA;
    void main() { float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
      gl_FragColor = vec4(mix(uBrass, uIvory, 0.45) * vA * smoothstep(0.5, 0.15, r), 1.0); }`,
}));
rig.add(dots);

// Listener: a ring on the axis that walks out from 1 m to 4 m.
const ear = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.17, 40), new THREE.MeshBasicMaterial({ color: C.ivory, side: THREE.DoubleSide, transparent: true }));
rig.add(ear);

// ---- Labels --------------------------------------------------------------
const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagD"><span class="va-label">Distance</span><span class="val">1 m</span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagL"><span class="va-label">Level</span><span class="val">0 dB</span><div class="bar"><i></i></div></div>
  ${R.map((r, i) => `<div class="va-note va-label" id="f${i}"><b>${r} m</b><br>${r * r} ${r === 1 ? 'square' : 'squares'}<br>${dB(r) === 0 ? '0' : '−' + Math.abs(Math.round(dB(r)))} dB</div>`).join('')}`);
const frame = new Frame(ui, post);
const tagD = ui.querySelector('#tagD'), tagL = ui.querySelector('#tagL'), fl = R.map((_, i) => ui.querySelector('#f' + i));
const pv = new THREE.Vector3();
const place = (el, p, dx = 0, dy = 0) => { pv.copy(p); rig.updateMatrixWorld(); rig.localToWorld(pv); pv.project(camera); el.style.left = (pv.x * 0.5 + 0.5) * W + dx + 'px'; el.style.top = (-pv.y * 0.5 + 0.5) * H + dy + 'px'; };

function renderFrame(t) {
  const drift = t / post.timeline.duration;
  camera.position.set(lerp(-2.4, -1.4, drift), lerp(2.2, 1.8, drift), lerp(18.6, 17.8, drift));
  camera.lookAt(0, 0.75, 0.6); camera.updateMatrixWorld();

  dots.material.uniforms.uT.value = Math.max(0, t - t0);
  edgeMat.opacity = 0.5 * ramp(t, beats.spread.start, beats.spread.start + 1);
  const end = 1 - ramp(t, beats.outro.start - 0.3, beats.outro.start + 0.2);
  frames.forEach((f, i) => {
    const a = ramp(t, tF[i] - 0.2, tF[i] + 0.4) * end;
    f.grid.material.opacity = 0.75 * a;
    f.cells.material.opacity = (0.08 + 0.62 / (f.r * f.r)) * a;
    fl[i].style.opacity = a;
    const big = i === R.length - 1;   // the largest frame is labelled above its left end, to stay on screen
    if (big) { place(fl[i], V3(-f.r / 2 + 0.15, f.r / 2, f.r), -34, -16); fl[i].style.transform = 'translate(0, -100%)'; }
    else { place(fl[i], V3(f.r / 2, 0, f.r), 34, 0); fl[i].style.transform = 'translate(0, -50%)'; }
  });

  // Listener position and the readouts follow it.
  const d = lerp(lerp(1, 2, ramp(t, tMove2, tMove2 + 1.4)), 4, ramp(t, tMove4, tMove4 + 2.2));
  ear.position.set(0, 0, d); ear.quaternion.copy(rig.quaternion).invert().multiply(camera.quaternion); ear.material.opacity = ramp(t, tF[0], tF[0] + 0.4) * end;
  const show = ramp(t, tF[0] - 0.2, tF[0] + 0.4) * end;
  tagD.style.opacity = show; tagL.style.opacity = show;
  tagD.querySelector('.val').textContent = d.toFixed(1) + ' m'; tagD.querySelector('i').style.width = d / 4 * 100 + '%';
  const lv = dB(d);
  tagL.querySelector('.val').textContent = (Math.round(lv) === 0 ? '' : '−') + Math.abs(Math.round(lv)) + ' dB';
  tagL.querySelector('i').style.width = clamp((lv + 18) / 18) * 100 + '%';

  renderer.render(scene, camera);
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
