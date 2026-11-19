// Beam, spot, wash. Three fixtures on one truss, each drawn from its own beam angle and
// edge: beam = very narrow and hard, spot = medium with a hard edge and a pattern,
// wash = wide with a soft, blurred edge. Floor pools are sized from the angle and the
// height (radius = height · tan(half-angle)). Angles are illustrative, not product specs.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const DEG = Math.PI / 180;
const TY = 520, FLOOR = 1170, H = FLOOR - TY - 40;
const FX = [
  { id: 'beam', x: 200, half: 2.2, label: 'Beam', sub: 'Narrow · hard', t: wordAt(beats.beam, /^beam/) },
  { id: 'spot', x: 480, half: 10, label: 'Spot', sub: 'Sharp edge · shapeable', t: wordAt(beats.spot, /^spot/) },
  { id: 'wash', x: 800, half: 21, label: 'Wash', sub: 'Soft · even', t: wordAt(beats.wash, /^wash/) },
];
FX.forEach(f => { f.r = 14 + H * Math.tan(f.half * DEG); });

const stage = document.getElementById('stage');
const cone = f => `${f.x - 14},${TY + 40} ${f.x + 14},${TY + 40} ${f.x + f.r},${FLOOR} ${f.x - f.r},${FLOOR}`;
const gob = f => Array.from({ length: 7 }, (_, i) => { const a = i / 7 * 2 * Math.PI; return `<circle cx="${(f.x + f.r * 0.55 * Math.cos(a)).toFixed(1)}" cy="${(FLOOR + f.r * 0.55 * 0.22 * Math.sin(a)).toFixed(1)}" rx="0" r="${(f.r * 0.13).toFixed(1)}" fill="${C.obsidian}" fill-opacity="0.75"/>`; }).join('');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ivory}" stop-opacity="0.9"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0.25"/></linearGradient>
    <radialGradient id="soft"><stop offset="0" stop-color="${C.ivory}" stop-opacity="0.85"/><stop offset="0.6" stop-color="${C.brass}" stop-opacity="0.5"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0"/></radialGradient>
    <filter id="blur" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="22"/></filter>
  </defs>
  <line x1="60" y1="${FLOOR}" x2="1020" y2="${FLOOR}" stroke="${C.grey}" stroke-opacity="0.6" stroke-width="2"/>
  <!-- Wash -->
  <g id="wash" opacity="0"><polygon points="${cone(FX[2])}" fill="url(#g)" opacity="0.32" filter="url(#blur)"/>
    <ellipse cx="${FX[2].x}" cy="${FLOOR}" rx="${FX[2].r * 1.15}" ry="${FX[2].r * 0.26}" fill="url(#soft)"/></g>
  <!-- Spot -->
  <g id="spot" opacity="0"><polygon points="${cone(FX[1])}" fill="url(#g)" opacity="0.5"/>
    <ellipse cx="${FX[1].x}" cy="${FLOOR}" rx="${FX[1].r}" ry="${FX[1].r * 0.22}" fill="${C.ivory}" fill-opacity="0.9"/>
    <g transform="translate(${FX[1].x} ${FLOOR}) scale(1 1)">${Array.from({ length: 7 }, (_, i) => { const a = i / 7 * 2 * Math.PI; return `<ellipse cx="${(FX[1].r * 0.58 * Math.cos(a)).toFixed(1)}" cy="${(FX[1].r * 0.58 * 0.22 * Math.sin(a)).toFixed(1)}" rx="${(FX[1].r * 0.14).toFixed(1)}" ry="${(FX[1].r * 0.14 * 0.22).toFixed(1)}" fill="${C.obsidian}" fill-opacity="0.8"/>`; }).join('')}</g></g>
  <!-- Beam -->
  <g id="beam" opacity="0"><polygon points="${cone(FX[0])}" fill="url(#g)" opacity="0.95"/>
    <ellipse cx="${FX[0].x}" cy="${FLOOR}" rx="${FX[0].r * 1.4}" ry="${FX[0].r * 0.35}" fill="${C.ivory}"/></g>
  <!-- Truss and fixtures -->
  <rect x="60" y="${TY - 50}" width="960" height="26" fill="none" stroke="${C.grey}" stroke-width="3"/>
  ${FX.map(f => `<g><rect x="${f.x - 34}" y="${TY - 24}" width="68" height="64" rx="10" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="3"/><circle class="lens" id="l_${f.id}" cx="${f.x}" cy="${TY + 22}" r="${f.id === 'wash' ? 26 : f.id === 'spot' ? 18 : 12}" fill="${C.ivory}" opacity="0.1"/></g>`).join('')}
</svg>`;
const $s = id => stage.querySelector('#' + id);

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', FX.map(f => `<div class="va-note va-label" id="n_${f.id}" style="text-align:center;border-left:none;border-top:2px solid var(--va-brass);padding:8px 10px"><b>${f.label}</b><br>${f.sub}</div>`).join('') + `
  <div class="va-tag left" id="tagS"><span class="va-label">Showing</span><span class="val"></span><div class="bar"><i></i></div></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const all = ramp(t, beats.takeaway.start + 0.2, beats.takeaway.start + 0.8);
  let showing = '', n = 0;
  FX.forEach((f, i) => {
    const on = ramp(t, f.t - 0.2, f.t + 0.4);
    const next = FX[i + 1] ? ramp(t, FX[i + 1].t - 0.2, FX[i + 1].t + 0.4) : 0;
    const a = Math.max(on * (1 - 0.7 * next * (1 - all)), on * all) * end;   // earlier ones dim while the next is shown
    $s(f.id).setAttribute('opacity', a); $s('l_' + f.id).setAttribute('opacity', 0.1 + 0.9 * a);
    const nl = $('n_' + f.id); nl.style.opacity = on * end; nl.style.left = f.x + 'px'; nl.style.top = (FLOOR + 70) + 'px'; nl.style.transform = 'translate(-50%, 0)';
    if (on > 0.5) { showing = f.label; n = i + 1; }
  });
  $('tagS').style.opacity = ramp(t, FX[0].t - 0.2, FX[0].t + 0.4) * end;
  $('tagS').querySelector('.val').textContent = all > 0.5 ? 'All three' : showing;
  $('tagS').querySelector('i').style.width = (all > 0.5 ? 100 : n / 3 * 100) + '%';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
