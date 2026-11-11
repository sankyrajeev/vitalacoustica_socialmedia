// Beam angle and throw. One fixture with a fixed beam angle; a surface moves from
// 5 m to 10 m away. Spot width = 2·d·tan(θ/2); brightness relative to the start is
// (d0·tan(θ0/2) / (d·tan(θ/2)))², the same light spread over the spot's area.
import * as THREE from 'three';
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const W = 1080, H = 1920;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const DEG = Math.PI / 180;

const [D0, D1] = spec.params.throw_m;
const HALF0 = spec.params.beam_angle_deg / 2 * DEG;
const HALF_N = Math.atan(Math.tan(HALF0) / 2);           // the angle that keeps the spot the same size at twice the throw
const tMove = wordAt(beats.double, /^twice/), tNarrow = wordAt(beats.takeaway, /^narrow/);
const throwAt = t => lerp(D0, D1, ramp(t, tMove, tMove + 2.0));
const halfAt = t => lerp(HALF0, HALF_N, ramp(t, tNarrow, tNarrow + 1.4));
const spotR = (d, h) => d * Math.tan(h);
const bright = (d, h) => (spotR(D0, HALF0) / spotR(d, h)) ** 2;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1); renderer.setClearColor(C.obsidian);
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Fixture, hanging from a short truss, pointing straight down.
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });
const fix = new THREE.Group();
const truss = new THREE.BoxGeometry(3.2, 0.32, 0.32);
fix.add(new THREE.LineSegments(new THREE.EdgesGeometry(truss), lineMat(C.grey, 0.8)).translateY(0.95));
const yoke = new THREE.BoxGeometry(0.62, 0.42, 0.36);
fix.add(new THREE.Mesh(yoke, new THREE.MeshBasicMaterial({ color: C.charcoal })).translateY(0.58));
fix.add(new THREE.LineSegments(new THREE.EdgesGeometry(yoke), lineMat(C.grey, 1)).translateY(0.58));
const body = new THREE.CylinderGeometry(0.22, 0.27, 0.62, 24);
fix.add(new THREE.Mesh(body, new THREE.MeshBasicMaterial({ color: C.charcoal })).translateY(0.05));
fix.add(new THREE.LineSegments(new THREE.EdgesGeometry(body, 30), lineMat(C.brass, 1)).translateY(0.05));
const lens = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicMaterial({ color: C.ivory, side: THREE.DoubleSide }));
lens.rotation.x = Math.PI / 2; lens.position.y = -0.27; fix.add(lens);
scene.add(fix);
const LENS_Y = -0.27;

// The surface the light lands on, with a 1 m grid.
const SLAB = 8, DEPTH = 5;
const slab = new THREE.Group();
const top = new THREE.Mesh(new THREE.PlaneGeometry(SLAB, DEPTH), new THREE.MeshBasicMaterial({ color: C.charcoal, side: THREE.DoubleSide }));
top.rotation.x = -Math.PI / 2; slab.add(top);
const gp = [];
for (let k = 0; k <= SLAB; k++) { const x = -SLAB / 2 + k; gp.push(V3(x, 0.002, -DEPTH / 2), V3(x, 0.002, DEPTH / 2)); }
for (let k = 0; k <= DEPTH; k++) { const z = -DEPTH / 2 + k; gp.push(V3(-SLAB / 2, 0.002, z), V3(SLAB / 2, 0.002, z)); }
slab.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gp), lineMat(C.grey, 0.35)));
scene.add(slab);

// The spot: brightness falls with its area.
const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 72), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uB: { value: 1 }, uIvory: { value: new THREE.Color(C.ivory) }, uBrass: { value: new THREE.Color(C.brass) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uB; uniform vec3 uIvory, uBrass; varying vec2 vUv;
    void main(){ float r = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.93, r);
      vec3 col = mix(uBrass, uIvory, 0.6); gl_FragColor = vec4(col, a * (0.06 + 0.94 * uB)); }`,
}));
spot.rotation.x = -Math.PI / 2; scene.add(spot);

// Ghost of the first spot, for comparison.
const ringPts = n => Array.from({ length: n + 1 }, (_, i) => V3(Math.cos(i / n * 2 * Math.PI), 0, Math.sin(i / n * 2 * Math.PI)));
const ghost = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts(96)), new THREE.LineDashedMaterial({ color: C.ivory, dashSize: 0.045, gapSize: 0.04, transparent: true, opacity: 0 }));
scene.add(ghost);

// Cone outline: dashed generators from the lens to the spot's rim (a diagram, not a visible beam).
const GEN = 10;
const cone = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: C.grey, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0 }));
scene.add(cone);

// ---- Labels --------------------------------------------------------------
const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagT"><span class="va-label">Throw</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagB"><span class="va-label">Brightness</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nSpot"></div>
  <div class="va-note va-label" id="nAngle"></div>
  <div class="va-note va-label" id="nGhost"><b>Spot at ${D0} m</b><br>¼ of the area</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const pv = new THREE.Vector3();
const place = (el, p, dx = 0, dy = 0) => { pv.copy(p).project(camera); el.style.left = (pv.x * 0.5 + 0.5) * W + dx + 'px'; el.style.top = (-pv.y * 0.5 + 0.5) * H + dy + 'px'; };

function renderFrame(t) {
  const drift = t / post.timeline.duration;
  camera.position.set(lerp(-2.5, 2.5, drift), lerp(7.5, 7.0, drift), lerp(44, 42.5, drift));
  camera.lookAt(0, -6.1, 0); camera.updateMatrixWorld();

  const d = throwAt(t), h = halfAt(t), r = spotR(d, h), b = bright(d, h);
  const y = LENS_Y - d;
  slab.position.y = y - 0.01;
  spot.position.set(0, y + 0.01, 0); spot.scale.set(r, r, 1);
  spot.material.uniforms.uB.value = clamp(b) * ramp(t, 0.3, 0.9);
  lens.material.color.set(C.ivory);

  const coneA = ramp(t, beats.cone.start + 0.4, beats.cone.start + 1.2);
  const pts = [];
  for (let i = 0; i < GEN; i++) { const a = i / GEN * 2 * Math.PI; pts.push(V3(0, LENS_Y, 0), V3(r * Math.cos(a), y + 0.02, r * Math.sin(a))); }
  cone.geometry.setFromPoints(pts); cone.computeLineDistances(); cone.material.opacity = 0.55 * coneA;

  const r0 = spotR(D0, HALF0), ghostA = ramp(t, tMove + 0.8, tMove + 1.6) * (1 - ramp(t, tNarrow, tNarrow + 0.8));
  ghost.position.set(0, y + 0.03, 0); ghost.scale.set(r0, 1, r0); ghost.computeLineDistances(); ghost.material.opacity = 0.9 * ghostA;

  renderer.render(scene, camera);

  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const show = ramp(t, beats.cone.start + 0.3, beats.cone.start + 0.9) * end;
  $('tagT').style.opacity = show; $('tagB').style.opacity = show;
  $('tagT').querySelector('.val').textContent = d.toFixed(1) + ' m'; $('tagT').querySelector('i').style.width = d / D1 * 100 + '%';
  $('tagB').querySelector('.val').textContent = Math.round(b * 100) + '%'; $('tagB').querySelector('i').style.width = clamp(b) * 100 + '%';

  $('nSpot').innerHTML = `<b>Spot</b><br>${(2 * r).toFixed(1)} m wide`;
  $('nSpot').style.opacity = show; place($('nSpot'), V3(r, y, 0), 30, 0);
  $('nAngle').innerHTML = `<b>Beam angle</b><br>${Math.round(2 * h / DEG)}°`;
  $('nAngle').style.opacity = show; place($('nAngle'), V3(0.3, 0.05, 0), 44, 0);
  $('nGhost').style.opacity = ghostA; place($('nGhost'), V3(-r, y, 0), -30, 0);
  $('nGhost').style.transform = 'translate(-100%, -50%)';
  $('nGhost').style.borderLeft = 'none'; $('nGhost').style.borderRight = '2px solid var(--va-brass)'; $('nGhost').style.textAlign = 'right';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
