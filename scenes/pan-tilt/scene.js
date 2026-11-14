// Pan and tilt. A moving head hangs from a truss. Pan φ turns the yoke about the
// vertical; tilt θ swings the head away from straight down. The beam direction is
// (sinθ·sinφ, −cosθ, sinθ·cosφ) and it lands on the floor where that line meets it.
import * as THREE from 'three';
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const W = 1080, H = 1920, DEG = Math.PI / 180;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const HANG = spec.params.hang_m, HALF = spec.params.beam_half_deg * DEG;
const PIVOT_Y = HANG - 0.75;                         // tilt axis height

// Four floor targets for the "both together" beat, as (pan, tilt) pairs.
const TARGETS = [[-105, 30], [110, 26], [165, 34], [-150, 22]].map(([p, q]) => [p * DEG, q * DEG]);
const smooth = x => x * x * (3 - 2 * x);
function angles(t) {
  const tPan = beats.pan.start + 0.8, tTilt = beats.tilt.start + 0.6, tComb = wordAt(beats.combine, /^two$|^two/, beats.combine.start + 1.5);
  let pan = 60 * DEG, tilt = 22 * DEG;
  // Pan beat: sweep the yoke round while tilt holds.
  pan = lerp(60 * DEG, 180 * DEG, smooth(ramp(t, tPan, tPan + 3.2)));
  // Tilt beat: swing the head while pan holds.
  tilt = lerp(22 * DEG, 8 * DEG, smooth(ramp(t, tTilt, tTilt + 1.3)));
  tilt = lerp(tilt, 36 * DEG, smooth(ramp(t, tTilt + 1.4, tTilt + 3.0)));
  // Combine: visit the four targets.
  const c0 = beats.combine.start + 0.2, step = 1.6;
  let pp = pan, tt = tilt;
  TARGETS.forEach(([p, q], i) => { const a = smooth(ramp(t, c0 + i * step, c0 + i * step + 1.0)); pp = lerp(pp, p, a); tt = lerp(tt, q, a); });
  // Takeaway: move in time, a figure-of-eight driven by two slow sines.
  const m = ramp(t, beats.takeaway.start + 0.3, beats.takeaway.start + 1.3);
  const tk = t - beats.takeaway.start;
  pp = lerp(pp, -180 * DEG + 55 * DEG * Math.sin(1.9 * tk), m);
  tt = lerp(tt, 24 * DEG + 9 * DEG * Math.sin(3.8 * tk), m);
  return [pp, tt];
}
const dirOf = (p, q) => new THREE.Vector3(Math.sin(q) * Math.sin(p), -Math.cos(q), Math.sin(q) * Math.cos(p));

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1); renderer.setClearColor(C.obsidian);
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);
const lm = (c, o = 1) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o });
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const boxWire = (w, h, d, edge, fill = C.charcoal) => { const g = new THREE.Group(), geo = new THREE.BoxGeometry(w, h, d); g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: fill }))); g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lm(edge))); return g; };

// Floor with a 1 m grid.
const FW = 12, FD = 10;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD), new THREE.MeshBasicMaterial({ color: C.charcoal }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const gp = [];
for (let x = -FW / 2; x <= FW / 2; x++) gp.push(V3(x, 0.003, -FD / 2), V3(x, 0.003, FD / 2));
for (let z = -FD / 2; z <= FD / 2; z++) gp.push(V3(-FW / 2, 0.003, z), V3(FW / 2, 0.003, z));
scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gp), lm(C.grey, 0.28)));

// Truss and fixture.
const truss = boxWire(6, 0.34, 0.34, C.grey); truss.position.set(0, HANG + 0.2, 0); scene.add(truss);
const base = boxWire(0.7, 0.26, 0.5, C.grey); base.position.set(0, HANG - 0.13, 0); scene.add(base);
const panG = new THREE.Group(); panG.position.set(0, HANG - 0.26, 0); scene.add(panG);
const yokeTop = boxWire(1.0, 0.1, 0.32, C.brass); yokeTop.position.y = -0.05; panG.add(yokeTop);
for (const x of [-0.47, 0.47]) { const arm = boxWire(0.1, 0.72, 0.32, C.brass); arm.position.set(x, -0.42, 0); panG.add(arm); }
const tiltG = new THREE.Group(); tiltG.position.y = PIVOT_Y - (HANG - 0.26); panG.add(tiltG);
const headGeo = new THREE.CylinderGeometry(0.3, 0.36, 0.78, 28);
tiltG.add(new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: C.charcoal })));
tiltG.add(new THREE.LineSegments(new THREE.EdgesGeometry(headGeo, 30), lm(C.ivory)));
const lens = new THREE.Mesh(new THREE.CircleGeometry(0.28, 32), new THREE.MeshBasicMaterial({ color: C.ivory, side: THREE.DoubleSide }));
lens.rotation.x = Math.PI / 2; lens.position.y = -0.4; tiltG.add(lens);

// Beam: a soft additive cone, and the spot where it lands.
const BL = 12, beamGeo = new THREE.CylinderGeometry(0.26, 0.26 + BL * Math.tan(HALF), BL, 32, 1, true); beamGeo.translate(0, -BL / 2 - 0.4, 0);
const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uA: { value: 0 }, uCol: { value: new THREE.Color(C.ivory).lerp(new THREE.Color(C.brass), 0.35) } },
  vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float uA; uniform vec3 uCol; varying vec3 vN; varying vec3 vW;
    void main(){ if (vW.y < 0.0) discard; float f = abs(dot(normalize(vN), normalize(cameraPosition - vW))); gl_FragColor = vec4(uCol * uA * pow(f, 1.5) * 0.42, 1.0); }`,
}));
tiltG.add(beam);
const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uA: { value: 0 }, uCol: { value: new THREE.Color(C.ivory) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform float uA; uniform vec3 uCol; varying vec2 vUv; void main(){ float r = length(vUv-0.5)*2.0; gl_FragColor = vec4(uCol * uA * smoothstep(1.0, 0.6, r), 1.0); }`,
}));
spot.rotation.x = -Math.PI / 2; scene.add(spot);

// Target marks on the floor.
const marks = TARGETS.map(([p, q]) => {
  const d = dirOf(p, q), s = (PIVOT_Y) / -d.y, x = d.x * s, z = d.z * s;
  const g = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 40 }, (_, i) => V3(x + 0.42 * Math.cos(i / 40 * 6.283), 0.01, z + 0.42 * Math.sin(i / 40 * 6.283)))), lm(C.brass, 0));
  scene.add(g); return g;
});

// Pan ring around the yoke, with a marker; tilt arc in the yoke's plane.
const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => V3(0.95 * Math.cos(i / 64 * 6.283), HANG - 0.3, 0.95 * Math.sin(i / 64 * 6.283)))), lm(C.brass, 0));
scene.add(ring);
const panDot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: C.brass, transparent: true })); scene.add(panDot);
const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 41 }, (_, i) => { const a = (-60 + i * 3) * DEG; return V3(0, -1.15 * Math.cos(a), 1.15 * Math.sin(a)); })), lm(C.ivory, 0));
arc.position.y = tiltG.position.y; panG.add(arc);
const tiltDot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), new THREE.MeshBasicMaterial({ color: C.ivory, transparent: true })); panG.add(tiltDot);

// ---- Labels --------------------------------------------------------------
const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagP"><span class="va-label">Pan</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagT"><span class="va-label">Tilt</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nPan"><b>Pan</b><br>Turns the yoke</div>
  <div class="va-note va-label" id="nTilt"><b>Tilt</b><br>Swings the head</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const pv = new THREE.Vector3();
const place = (el, p, dx = 0, dy = 0) => { pv.copy(p).project(camera); el.style.left = (pv.x * 0.5 + 0.5) * W + dx + 'px'; el.style.top = (-pv.y * 0.5 + 0.5) * H + dy + 'px'; };

function renderFrame(t) {
  const drift = t / post.timeline.duration;
  camera.position.set(lerp(-2.0, 2.0, drift), lerp(14.5, 14.0, drift), lerp(18.5, 17.8, drift));
  camera.lookAt(0, 2.3, -0.6); camera.updateMatrixWorld();

  const [p, q] = angles(t), d = dirOf(p, q);
  panG.rotation.y = p; tiltG.rotation.x = -q;                  // rotation about local x by −θ swings the head towards local +z
  const on = ramp(t, 0.4, 0.9);
  beam.material.uniforms.uA.value = on;
  const s = PIVOT_Y / -d.y, hit = V3(d.x * s, 0.012, d.z * s), r = (0.26 + s * Math.tan(HALF));
  spot.position.copy(hit); spot.rotation.z = -p; spot.scale.set(r, r / Math.cos(q), 1);
  spot.material.uniforms.uA.value = 0.9 * on;

  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const panA = ramp(t, beats.pan.start + 0.3, beats.pan.start + 0.9) * end, tiltA = ramp(t, beats.tilt.start + 0.2, beats.tilt.start + 0.8) * end;
  ring.material.opacity = 0.8 * panA; panDot.material.opacity = panA;
  panDot.position.set(0.95 * Math.sin(p), HANG - 0.3, 0.95 * Math.cos(p));
  arc.material.opacity = 0.7 * tiltA; tiltDot.material.opacity = tiltA;
  tiltDot.position.set(0, tiltG.position.y - 1.15 * Math.cos(q), 1.15 * Math.sin(q));
  const markA = ramp(t, beats.combine.start, beats.combine.start + 0.6) * (1 - ramp(t, beats.takeaway.start + 0.5, beats.takeaway.start + 1.2)) * end;
  marks.forEach(m => m.material.opacity = 0.9 * markA);

  renderer.render(scene, camera);

  $('tagP').style.opacity = panA; $('tagT').style.opacity = tiltA;
  const pd = Math.round(p / DEG), td = Math.round(q / DEG);
  $('tagP').querySelector('.val').textContent = pd + '°'; $('tagP').querySelector('i').style.width = clamp((pd + 180) / 360) * 100 + '%';
  $('tagT').querySelector('.val').textContent = td + '°'; $('tagT').querySelector('i').style.width = clamp(td / 60) * 100 + '%';
  const noteEnd = 1 - ramp(t, beats.combine.start + 0.5, beats.combine.start + 1.2);
  $('nPan').style.opacity = panA * noteEnd; place($('nPan'), V3(1.1, HANG - 0.2, 0), 30, 0);
  $('nTilt').style.opacity = tiltA * noteEnd; place($('nTilt'), V3(-1.2, PIVOT_Y - 0.4, 0), -30, 0);
  $('nTilt').style.transform = 'translate(-100%, -50%)'; $('nTilt').style.borderLeft = 'none'; $('nTilt').style.borderRight = '2px solid var(--va-brass)'; $('nTilt').style.textAlign = 'right';
  $('nPan').style.transform = 'translate(0, -50%)';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
