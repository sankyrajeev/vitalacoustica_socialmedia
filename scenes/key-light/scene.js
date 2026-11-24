// Front light vs top light, on a face in profile. Light is treated as parallel rays from the
// fixture's elevation angle. A point on the face is lit if a ray towards the light leaves the
// head without crossing its outline (2D ray cast); brightness is Lambert (cosine) shading.
// The eye is tested against the brow only (the nose sits beside it, not in front of it).
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const hex = s => s.match(/\w\w/g).map(h => parseInt(h, 16));
const tone = v => { const a = hex(C.charcoal), b = v < 0.6 ? hex(C.brass) : hex(C.ivory), x = v < 0.6 ? v / 0.6 : (v - 0.6) / 0.4, s = v < 0.6 ? a : hex(C.brass); return `rgb(${s.map((c, i) => Math.round(c + (b[i] - c) * x)).join(',')})`; };

const SC = 1.5, HX = 400, HY = 1060;
const raw = [[-20, -255], [35, -248], [78, -222], [100, -180], [110, -140], [124, -104], [120, -90], [110, -78], [160, -10], [118, 8], [126, 30], [118, 44], [124, 58], [108, 76], [120, 110], [95, 140], [40, 150], [30, 230], [-60, 230], [-110, 120], [-140, 0], [-130, -140], [-80, -230]];
const P = raw.map(([x, y]) => [HX + x * SC, HY + y * SC]);
const NOSE = new Set([7, 8]);                         // edges nasion→tip→base: beside the eye, not in front
const EYE = [HX + 104 * SC, HY - 62 * SC];
const FRONT = [2, 15];                                // contour indices from forehead to under the chin

const tFront = wordAt(beats.front, /^front/i);
const elev = t => lerp(spec.params.elev_top_deg, spec.params.elev_front_deg, ramp(t, tFront, tFront + 1.6)) * Math.PI / 180;

function hit(o, d, skip) {                           // first crossing of ray o + s·d with the outline
  let best = Infinity;
  for (let i = 0; i < P.length; i++) {
    if (skip && skip.has(i)) continue;
    const a = P[i], b = P[(i + 1) % P.length], ex = b[0] - a[0], ey = b[1] - a[1];
    const den = d[0] * ey - d[1] * ex; if (Math.abs(den) < 1e-9) continue;
    const s = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den, u = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
    if (s > 0.5 && u >= 0 && u <= 1) best = Math.min(best, s);
  }
  return best;
}
// Sample the front of the face.
const samples = [];
for (let i = FRONT[0]; i < FRONT[1]; i++) {
  const a = P[i], b = P[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
  const k = Math.max(1, Math.round(len / 5));
  for (let j = 0; j < k; j++) { const u0 = j / k, u1 = (j + 1) / k; samples.push({ a: [lerp(a[0], b[0], u0), lerp(a[1], b[1], u0)], b: [lerp(a[0], b[0], u1), lerp(a[1], b[1], u1)], n }); }
}

const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  <g id="rays"></g>
  <path d="M ${P.map(p => p.join(' ')).join(' L ')} Z" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="2"/>
  <g id="skin">${samples.map(() => '<line stroke-width="12" stroke-linecap="round"/>').join('')}</g>
  <g id="eye" transform="translate(${EYE[0]} ${EYE[1]})"><path id="eyeShape" d="M -16 0 Q -4 -11 10 -2 Q -2 8 -16 0 Z"/><circle id="glint" cx="2" cy="-1" r="3.5" fill="${C.ivory}"/></g>
  <g id="fix"><rect x="-34" y="-24" width="68" height="48" rx="8" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/><rect id="lens" x="-28" y="18" width="56" height="10" rx="4" fill="${C.ivory}"/></g>
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const skin = [...$s('skin').children];
const TARGETS = [[100, -175], [124, -104], 'eye', [158, -12], [125, 32], [120, 108]];
for (let i = 0; i < TARGETS.length; i++) $s('rays').insertAdjacentHTML('beforeend', `<line stroke="${C.brass}" stroke-width="3" stroke-opacity="0.55"/>`);
const rays = [...$s('rays').children];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagA"><span class="va-label">Light from</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagE"><span class="va-label">Eyes</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nBrow"><b>Brow</b></div>
  <div class="va-note va-label" id="nEye"><b>Eye</b></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  const e = elev(t), L = [Math.cos(e), -Math.sin(e)];
  // Face shading.
  samples.forEach((s, i) => {
    const m = [(s.a[0] + s.b[0]) / 2 + s.n[0] * 1.5, (s.a[1] + s.b[1]) / 2 + s.n[1] * 1.5];
    const lam = Math.max(0, s.n[0] * L[0] + s.n[1] * L[1]), vis = hit(m, L) === Infinity ? 1 : 0;
    const el = skin[i]; el.setAttribute('x1', s.a[0]); el.setAttribute('y1', s.a[1]); el.setAttribute('x2', s.b[0]); el.setAttribute('y2', s.b[1]);
    el.setAttribute('stroke', tone(0.08 + 0.92 * lam * vis));
  });
  const eyeLit = hit(EYE, L, NOSE) === Infinity;
  const eyeK = eyeLit ? 1 : 0;
  $s('eyeShape').setAttribute('fill', eyeLit ? C.ivory : C.obsidian); $s('eyeShape').setAttribute('stroke', eyeLit ? C.brass : C.grey); $s('eyeShape').setAttribute('stroke-width', 2);
  $s('glint').setAttribute('opacity', eyeK); $s('glint').setAttribute('fill', C.brass);
  // Fixture and rays.
  const FD = 400, fx = EYE[0] + L[0] * FD, fy = EYE[1] + L[1] * FD;
  $s('fix').setAttribute('transform', `translate(${fx} ${fy}) rotate(${(Math.atan2(-L[1], -L[0]) * 180 / Math.PI) - 90})`);
  TARGETS.forEach((tg, i) => {
    const p = tg === 'eye' ? EYE : [HX + tg[0] * SC, HY + tg[1] * SC];
    const far = [p[0] + L[0] * 2000, p[1] + L[1] * 2000], d = [-L[0], -L[1]];
    const s = hit(far, d, tg === 'eye' ? NOSE : null);
    const len = Math.min(s, 2000);
    const sx0 = p[0] + L[0] * (FD - 40), sy0 = p[1] + L[1] * (FD - 40);
    const ex = far[0] + d[0] * len, ey = far[1] + d[1] * len;
    rays[i].setAttribute('x1', sx0); rays[i].setAttribute('y1', sy0); rays[i].setAttribute('x2', ex); rays[i].setAttribute('y2', ey);
    rays[i].setAttribute('stroke-opacity', tg === 'eye' ? 0.95 : 0.4); rays[i].setAttribute('stroke-width', tg === 'eye' ? 4 : 3);
  });
  const show = ramp(t, beats.top.start, beats.top.start + 0.6) * end;
  $('tagA').style.opacity = show; $('tagE').style.opacity = show;
  const deg = Math.round(e * 180 / Math.PI);
  $('tagA').querySelector('.val').textContent = `${deg}° up`; $('tagA').querySelector('i').style.width = deg / 90 * 100 + '%';
  $('tagE').querySelector('.val').textContent = eyeLit ? 'Lit' : 'In shadow'; $('tagE').querySelector('i').style.width = eyeK * 100 + '%';
  at($('nBrow'), HX + 30 * SC, HY - 150 * SC, 'translate(-100%, -50%)'); at($('nEye'), HX + 40 * SC, HY - 62 * SC, 'translate(-100%, -50%)');
  $('nBrow').style.opacity = show; $('nEye').style.opacity = show;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
