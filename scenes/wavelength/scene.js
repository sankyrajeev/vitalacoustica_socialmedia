// Wavelength against the size of a person. A speaker on the left sends a pressure
// wave across the frame while the frequency sweeps from high to low. Wavelength is
// computed as c / f; the bands, the curve and the bracket all use that one number.
// Time is slowed so every frequency is drawn moving at the same visible pace.
import * as THREE from 'three';
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const W = 1080, H = 1920;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const { f_start_hz: F0, f_end_hz: F1, speed_of_sound: CS, person_m: PH } = spec.params;

// Sweep from the word "lower" to the word "fifty", on a log scale like a real sweep.
const tS0 = wordAt(beats.sweep, /^lower/), tS1 = wordAt(beats.sweep, /^fifty/);
const freqAt = t => F0 * Math.pow(F1 / F0, ramp(t, tS0, tS1));
const VIS_HZ = 0.55;                    // every wave crest moves at this visible rate

// World units are metres. 1080 px = 9 m.
const MW = 9, MH = MW * H / W, PX = W / MW;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1); renderer.setClearColor(C.obsidian);
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-MW / 2, MW / 2, MH / 2, -MH / 2, -10, 10);
// Screen y in px -> world y: y = MH/2 - px/PX
const Y = px => MH / 2 - px / PX;
const FLOOR = Y(1250), TOP = Y(560), SPK_X = -4.05, X0 = -3.7, X1 = 4.5;

// Pressure field: vertical bands, brightness = pressure.
const field = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, TOP - FLOOR), new THREE.ShaderMaterial({
  transparent: true,
  uniforms: { uK: { value: 1 }, uPh: { value: 0 }, uX0: { value: X0 }, uW: { value: X1 - X0 }, uAmp: { value: 0 }, uFront: { value: 0 },
    uBrass: { value: new THREE.Color(C.brass) }, uIvory: { value: new THREE.Color(C.ivory) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uK, uPh, uX0, uW, uAmp, uFront; uniform vec3 uBrass, uIvory; varying vec2 vUv;
    void main(){
      float x = uX0 + vUv.x * uW, d = x - uX0;
      float p = sin(uK * d - uPh) * step(d, uFront);
      float lit = max(p, 0.0);
      vec3 col = mix(uBrass * 0.85, uIvory, smoothstep(0.7, 1.0, lit) * 0.5);
      float edge = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.86, vUv.y) * smoothstep(1.0, 0.94, vUv.x);
      gl_FragColor = vec4(col, (0.05 + 0.4 * lit) * uAmp * edge);
    }`,
}));
field.position.set((X0 + X1) / 2, (TOP + FLOOR) / 2, 0); scene.add(field);

// Pressure curve above the field.
const CURVE_Y = Y(500), CURVE_A = 0.42, NC = 2400;
const curve = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(NC * 3), 3)),
  new THREE.LineBasicMaterial({ color: C.ivory, transparent: true }));
scene.add(curve);

// Floor line, speaker, person.
const lm = (c, o = 1) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o });
const seg = (pts, m) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts.map(([x, y]) => new THREE.Vector3(x, y, 0.1))), m);
scene.add(seg([[X0 - 0.6, FLOOR], [X1, FLOOR]], lm(C.grey, 0.6)));
const spk = new THREE.Group();
const sh = 1.3;
spk.add(new THREE.Mesh(new THREE.PlaneGeometry(0.62, sh), new THREE.MeshBasicMaterial({ color: C.charcoal })));
spk.add(seg([[-0.31, -sh / 2], [0.31, -sh / 2], [0.31, -sh / 2], [0.31, sh / 2], [0.31, sh / 2], [-0.31, sh / 2], [-0.31, sh / 2], [-0.31, -sh / 2]], lm(C.brass)));
const cone = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.22, 40), new THREE.MeshBasicMaterial({ color: C.brass }));
cone.position.y = -0.25; spk.add(cone);
const tw = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.09, 30), new THREE.MeshBasicMaterial({ color: C.brass }));
tw.position.y = 0.35; spk.add(tw);
spk.position.set(SPK_X, FLOOR + sh / 2, 0.2); scene.add(spk);

// A person, drawn from simple shapes, 1.7 m tall.
const person = new THREE.Group();
const fill = new THREE.MeshBasicMaterial({ color: C.charcoal }), edge = lm(C.ivory);
const headR = 0.12, headY = PH - headR;
const head = new THREE.Mesh(new THREE.CircleGeometry(headR, 40), fill); head.position.y = headY; person.add(head);
const headO = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, i) => new THREE.Vector3(headR * Math.cos(i / 48 * 6.283), headY + headR * Math.sin(i / 48 * 6.283), 0.01))), edge);
person.add(headO);
const bodyPts = [[-0.08, PH - 0.28], [-0.22, PH - 0.36], [-0.25, PH - 0.95], [-0.19, PH - 0.95], [-0.17, PH - 0.55], [-0.15, PH - 0.98], [-0.13, 0], [-0.02, 0], [0, PH - 0.95],
  [0.02, 0], [0.13, 0], [0.15, PH - 0.98], [0.17, PH - 0.55], [0.19, PH - 0.95], [0.25, PH - 0.95], [0.22, PH - 0.36], [0.08, PH - 0.28]];
const shape = new THREE.Shape(bodyPts.map(([x, y]) => new THREE.Vector2(x, y)));
person.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), fill));
person.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(bodyPts.map(([x, y]) => new THREE.Vector3(x, y, 0.01))), edge));
const PX_X = 1.6;
person.position.set(PX_X, FLOOR, 0.3); scene.add(person);
// Height bracket beside the person.
scene.add(seg([[PX_X + 0.42, FLOOR], [PX_X + 0.42, FLOOR + PH], [PX_X + 0.36, FLOOR], [PX_X + 0.48, FLOOR], [PX_X + 0.36, FLOOR + PH], [PX_X + 0.48, FLOOR + PH]], lm(C.grey, 0.8)));

// Wavelength bracket: from one crest to the next, under the curve.
const brk = seg([[0, 0], [1, 0], [0, -0.1], [0, 0.1], [1, -0.1], [1, 0.1]], lm(C.brass)); scene.add(brk);
const BRK_Y = Y(640);

// ---- Labels --------------------------------------------------------------
const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagF"><span class="va-label">Frequency</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagL"><span class="va-label">Wavelength</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nL"></div>
  <div class="va-note va-label" id="nP"><b>You</b><br>About ${PH} m</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const toPx = (x, y) => [(x + MW / 2) * PX, (MH / 2 - y) * PX];
const fmtLen = l => l < 1 ? Math.round(l * 100) + ' cm' : l.toFixed(1) + ' m';

// Integrate phase so crests keep moving smoothly while the frequency changes.
function phaseAt(t) { return 2 * Math.PI * VIS_HZ * Math.max(0, t - 0.4); }

function renderFrame(t) {
  const f = freqAt(t), lam = CS / f, k = 2 * Math.PI / lam, ph = phaseAt(t);
  const front = (X1 - X0) * ramp(t, 0.4, 2.6) + (t > 2.6 ? 99 : 0);
  const feel = ramp(t, beats.feel.start, beats.feel.start + 0.8);
  const amp = ramp(t, 0.4, 1.0) * (0.75 + 0.25 * feel);
  field.material.uniforms.uK.value = k; field.material.uniforms.uPh.value = ph;
  field.material.uniforms.uAmp.value = amp; field.material.uniforms.uFront.value = front;

  // Curve: same pressure along x. At very short wavelengths it is drawn as a band.
  const pos = curve.geometry.attributes.position.array;
  for (let i = 0; i < NC; i++) {
    const x = lerp(X0, X1, i / (NC - 1)), d = x - X0;
    const p = d < front ? Math.sin(k * d - ph) : 0;
    pos[i * 3] = x; pos[i * 3 + 1] = CURVE_Y + CURVE_A * p; pos[i * 3 + 2] = 0.2;
  }
  curve.geometry.attributes.position.needsUpdate = true;
  curve.material.opacity = 0.9 * ramp(t, 0.4, 1.0);

  // Bracket: any two points one wavelength apart are in step, so it starts at a fixed place
  // and always fits on screen, even at 50 Hz.
  const xa = X0 + 0.35;
  const showB = ramp(t, beats.size.start + 2.0, beats.size.start + 2.6) * (1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2));
  brk.position.set(xa, BRK_Y, 0.2); brk.scale.set(lam, 1, 1); brk.material.opacity = showB;

  // The person sways very slightly with the pressure where they stand.
  const pHere = Math.sin(k * (PX_X - X0) - ph);
  person.scale.set(1 + 0.025 * pHere * feel, 1, 1);
  edge.color.set(feel > 0 ? new THREE.Color(C.ivory).lerp(new THREE.Color(C.brass), 0.5 * feel * Math.max(pHere, 0)) : C.ivory);

  renderer.render(scene, camera);

  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const show = ramp(t, beats.size.start + 0.2, beats.size.start + 0.8) * end;
  $('tagF').style.opacity = show; $('tagL').style.opacity = show;
  $('tagF').querySelector('.val').textContent = (f >= 1000 ? Math.round(f).toLocaleString('en') : Math.round(f)) + ' Hz';
  $('tagF').querySelector('i').style.width = clamp(Math.log(f / 20) / Math.log(20000 / 20)) * 100 + '%';
  $('tagL').querySelector('.val').textContent = fmtLen(lam);
  $('tagL').querySelector('i').style.width = clamp(lam / 7) * 100 + '%';

  $('nL').innerHTML = `<b>One wave</b><br>${fmtLen(lam)}`;
  const [bx, by] = toPx(xa + lam / 2, BRK_Y);
  $('nL').style.opacity = showB; $('nL').style.left = clamp(bx, 120, 860) + 'px'; $('nL').style.top = by + 52 + 'px';
  $('nL').style.transform = 'translate(-50%, 0)';
  const [px, py] = toPx(PX_X + 0.6, FLOOR + PH * 0.6);
  $('nP').style.opacity = show; $('nP').style.left = px + 'px'; $('nP').style.top = py + 'px';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
