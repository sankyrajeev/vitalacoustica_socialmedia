// Hard and soft shadows, in cross-section. A light source of width w shines past the edge of
// an opaque object onto the floor. Each floor point's brightness is the fraction of the source
// it can see (sampled across the source). The soft edge (penumbra) is the band between full
// light and full shadow; its width is w × (object-to-floor ÷ source-to-object).
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const hex = s => s.match(/\w\w/g).map(h => parseInt(h, 16));
const tone = v => { const a = hex(C.obsidian), x = v < 0.6 ? v / 0.6 : (v - 0.6) / 0.4, s = v < 0.6 ? a : hex(C.brass), b = v < 0.6 ? hex(C.brass) : hex(C.ivory); return `rgb(${s.map((c, i) => Math.round(c + (b[i] - c) * x)).join(',')})`; };
const P = spec.params, D1 = P.src_to_obj_m;

const tBig = wordAt(beats.big, /^bigger/i), tFar = wordAt(beats.why, /^further/i);
const width = t => lerp(P.src_small_m, P.src_large_m, ramp(t, tBig - 0.3, tBig + 1.3));
const d2 = t => lerp(P.obj_to_floor_m, P.obj_to_floor_m * 1.5, ramp(t, tFar, tFar + 1.4));

const S = 170, CX = 560, YS = 640, XS = -0.6, OEDGE = 0.0;         // object occupies x < OEDGE
const sx = x => CX + x * S;
function vis(X, w, dd) {
  const N = 160; let n = 0;
  for (let i = 0; i < N; i++) { const s = XS - w / 2 + w * (i + 0.5) / N; const xo = s + (X - s) * D1 / (D1 + dd); if (xo >= OEDGE) n++; }
  return n / N;
}
const NF = 220, FX0 = -2.0, FX1 = 2.0;
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  <polygon id="lit" fill="${C.ivory}" fill-opacity="0.08"/>
  <line id="r1" stroke="${C.brass}" stroke-width="2.5" stroke-dasharray="8 8"/>
  <line id="r2" stroke="${C.brass}" stroke-width="2.5" stroke-dasharray="8 8"/>
  <rect id="src" height="16" rx="6" fill="${C.ivory}"/>
  <rect x="${sx(FX0) - 20}" y="${YS + D1 * S - 12}" width="${sx(OEDGE) - sx(FX0) + 20}" height="24" rx="4" fill="${C.grey}"/>
  <g id="floor">${Array.from({ length: NF }, () => '<rect height="46"/>').join('')}</g>
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const fl = [...$s('floor').children];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagS"><span class="va-label">Light source width</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagP"><span class="va-label">Soft edge on the floor</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nL" style="text-align:center;border-left:none;padding:6px 10px">Light</div>
  <div class="va-note va-label" id="nO" style="text-align:center;border-left:none;padding:6px 10px">Object</div>
  <div class="va-note va-label" id="nF" style="text-align:center;border-left:none;padding:6px 10px">Floor</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };
const cm = m => m < 0.1 ? `${(m * 100).toFixed(1)} cm` : `${Math.round(m * 100)} cm`;

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  const w = width(t), dd = d2(t), YF = YS + (D1 + dd) * S;
  $s('src').setAttribute('x', sx(XS - w / 2)); $s('src').setAttribute('width', Math.max(8, w * S)); $s('src').setAttribute('y', YS - 8);
  const fw = (FX1 - FX0) / NF;
  fl.forEach((r, i) => { const X = FX0 + (i + 0.5) * fw; r.setAttribute('x', sx(FX0 + i * fw)); r.setAttribute('width', fw * S + 0.6); r.setAttribute('y', YF); r.setAttribute('fill', tone(0.06 + 0.94 * vis(X, w, dd))); });
  // Boundary rays through the object's edge from each end of the source.
  const hit = s => s + (OEDGE - s) * (D1 + dd) / D1;
  const a = XS - w / 2, b = XS + w / 2;
  $s('r1').setAttribute('x1', sx(a)); $s('r1').setAttribute('y1', YS); $s('r1').setAttribute('x2', sx(hit(a))); $s('r1').setAttribute('y2', YF);
  $s('r2').setAttribute('x1', sx(b)); $s('r2').setAttribute('y1', YS); $s('r2').setAttribute('x2', sx(hit(b))); $s('r2').setAttribute('y2', YF);
  $s('lit').setAttribute('points', `${sx(a)},${YS} ${sx(b)},${YS} ${sx(FX1)},${YF} ${sx(hit(a))},${YF}`);
  const pen = w * dd / D1;
  const show = ramp(t, beats.small.start, beats.small.start + 0.6) * end;
  $('tagS').style.opacity = show; $('tagP').style.opacity = show;
  $('tagS').querySelector('.val').textContent = cm(w); $('tagS').querySelector('i').style.width = w / 1.2 * 100 + '%';
  $('tagP').querySelector('.val').textContent = cm(pen); $('tagP').querySelector('i').style.width = clamp(pen / 0.9) * 100 + '%';
  at($('nL'), sx(XS), YS - 40); at($('nO'), sx(-1.2), YS + D1 * S + 42); at($("nF"), sx(1.2), YF + 74);
  for (const id of ['nL', 'nO', 'nF']) $(id).style.opacity = show;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
