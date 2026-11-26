// Backlight, on a figure in profile against a dark background. Two parallel-ray lights: front
// (from the right, 45° up) and back (from the left, 55° up). Every point on the outline is lit
// by a light if a ray towards it leaves the figure without crossing the outline (2D ray cast),
// with Lambert (cosine) shading. "Outline lit" is the share of the outline's length lit.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const hex = s => s.match(/\w\w/g).map(h => parseInt(h, 16));
const tone = v => { const a = hex(C.charcoal), x = v < 0.6 ? v / 0.6 : (v - 0.6) / 0.4, s = v < 0.6 ? a : hex(C.brass), b = v < 0.6 ? hex(C.brass) : hex(C.ivory); return `rgb(${s.map((c, i) => Math.round(c + (b[i] - c) * x)).join(',')})`; };

const SC = 1.1, HX = 540, HY = 1010;
const raw = [[-20, -255], [35, -248], [78, -222], [100, -180], [110, -140], [124, -104], [120, -90], [110, -78], [160, -10], [118, 8], [126, 30], [118, 44], [124, 58], [108, 76], [120, 110], [95, 140], [40, 150], [30, 215], [130, 262], [165, 330], [165, 345], [-255, 345], [-255, 330], [-215, 262], [-75, 215], [-110, 120], [-140, 0], [-130, -140], [-80, -230]];
const P = raw.map(([x, y]) => [HX + x * SC, HY + y * SC]);
const BOTTOM = new Set([20, 21]);                       // the cut-off edge at the bottom is not part of the outline
const rad = d => d * Math.PI / 180;
const LF = [Math.cos(rad(spec.params.front_elev_deg)), -Math.sin(rad(spec.params.front_elev_deg))];
const LB = [-Math.cos(rad(spec.params.back_elev_deg)), -Math.sin(rad(spec.params.back_elev_deg))];
const tBack = wordAt(beats.back, /^add/i);
const kB = t => ramp(t, tBack, tBack + 1);

function blocked(o, d) {
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], ex = b[0] - a[0], ey = b[1] - a[1];
    const den = d[0] * ey - d[1] * ex; if (Math.abs(den) < 1e-9) continue;
    const s = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den, u = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
    if (s > 0.5 && u >= 0 && u <= 1) return true;
  }
  return false;
}
const samples = [];
for (let i = 0; i < P.length; i++) {
  if (BOTTOM.has(i)) continue;
  const a = P[i], b = P[(i + 1) % P.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
  const k = Math.max(1, Math.round(len / 5));
  for (let j = 0; j < k; j++) {
    const s0 = { a: [lerp(a[0], b[0], j / k), lerp(a[1], b[1], j / k)], b: [lerp(a[0], b[0], (j + 1) / k), lerp(a[1], b[1], (j + 1) / k)], n, len: len / k };
    const m = [(s0.a[0] + s0.b[0]) / 2 + n[0] * 1.5, (s0.a[1] + s0.b[1]) / 2 + n[1] * 1.5];
    s0.f = blocked(m, LF) ? 0 : Math.max(0, n[0] * LF[0] + n[1] * LF[1]);
    s0.bk = blocked(m, LB) ? 0 : Math.max(0, n[0] * LB[0] + n[1] * LB[1]);
    samples.push(s0);
  }
}
const TOTAL = samples.reduce((s, x) => s + x.len, 0);

const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  <rect x="80" y="620" width="920" height="${HY + 345 * SC - 620}" fill="${C.charcoal}"/>
  <g id="raysF"></g><g id="raysB"></g>
  <path d="M ${P.map(p => p.join(' ')).join(' L ')} Z" fill="${C.charcoal}"/>
  <g id="skin">${samples.map(s => `<line x1="${s.a[0].toFixed(1)}" y1="${s.a[1].toFixed(1)}" x2="${s.b[0].toFixed(1)}" y2="${s.b[1].toFixed(1)}" stroke-width="10" stroke-linecap="round"/>`).join('')}</g>
  <g id="fixF"><rect x="-30" y="-22" width="60" height="44" rx="8" fill="${C.obsidian}" stroke="${C.ivory}" stroke-width="3"/></g>
  <g id="fixB"><rect x="-30" y="-22" width="60" height="44" rx="8" fill="${C.obsidian}" stroke="${C.ivory}" stroke-width="3"/></g>
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const skin = [...$s('skin').children];
const mkRays = (g, L, targets) => targets.forEach(([x, y]) => {
  const p = [HX + x * SC, HY + y * SC], far = [p[0] + L[0] * 310, p[1] + L[1] * 310];
  $s(g).insertAdjacentHTML('beforeend', `<line x1="${far[0]}" y1="${far[1]}" x2="${p[0]}" y2="${p[1]}" stroke="${C.brass}" stroke-width="3" stroke-opacity="0.45"/>`);
});
mkRays('raysF', LF, [[100, -175], [124, -104], [158, -12], [125, 32], [140, 290]]);
mkRays('raysB', LB, [[-80, -230], [-130, -140], [-140, -20], [-215, 262], [-20, -255]]);
const fpos = (L, x, y) => [HX + x * SC + L[0] * 330, HY + y * SC + L[1] * 330];
const [ffx, ffy] = fpos(LF, 124, -104), [fbx, fby] = fpos(LB, -100, -180);
$s('fixF').setAttribute('transform', `translate(${ffx} ${ffy}) rotate(${Math.atan2(-LF[1], -LF[0]) * 180 / Math.PI - 90})`);
$s('fixB').setAttribute('transform', `translate(${fbx} ${fby}) rotate(${Math.atan2(-LB[1], -LB[0]) * 180 / Math.PI - 90})`);

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagB"><span class="va-label">Backlight</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagO"><span class="va-label">Outline lit</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nF" style="text-align:center;border-left:none;padding:6px 10px">Front light</div>
  <div class="va-note va-label" id="nB" style="text-align:center;border-left:none;padding:6px 10px">Backlight</div>
  <div class="va-note va-label" id="nBg" style="text-align:center;border-left:none;padding:6px 10px">Dark stage behind</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  const kf = ramp(t, beats.front.start, beats.front.start + 0.6), kb = kB(t);
  let lit = 0;
  samples.forEach((s, i) => { const v = clamp(kf * s.f + kb * s.bk); skin[i].setAttribute('stroke', tone(v)); if (v > 0.15) lit += s.len; });
  $s('raysF').setAttribute('opacity', kf); $s('fixF').setAttribute('opacity', kf);
  $s('raysB').setAttribute('opacity', kb); $s('fixB').setAttribute('opacity', kb);
  const show = ramp(t, beats.front.start, beats.front.start + 0.6) * end;
  $('tagB').style.opacity = show; $('tagO').style.opacity = show;
  $('tagB').querySelector('.val').textContent = kb > 0.5 ? 'On' : 'Off'; $('tagB').querySelector('i').style.width = kb * 100 + '%';
  const pc = Math.round(100 * lit / TOTAL);
  $('tagO').querySelector('.val').textContent = pc + '%'; $('tagO').querySelector('i').style.width = pc + '%';
  at($('nF'), ffx, ffy - 46); at($('nB'), fbx, fby - 46); at($('nBg'), 200, 650);
  $('nF').style.opacity = kf * end; $('nB').style.opacity = kb * end; $('nBg').style.opacity = show;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
