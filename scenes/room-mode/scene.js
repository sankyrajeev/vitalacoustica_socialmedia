// Room mode between two walls (one dimension, simplified). Mode n of a room L long
// sits at f = n·c / (2L); its pressure along the room is cos(nπx/L). The wave going
// right and its reflection going left are drawn first; their sum is the standing wave.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const { room_m: L, mode: N, speed_of_sound: CS } = spec.params;
const F = N * CS / (2 * L);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

const X0 = 110, X1 = 970, TOP = 560, FLOOR = 1190, MID = 860, PXM = (X1 - X0) / L;
const xpx = m => X0 + m * PXM;
const shape = m => Math.cos(N * Math.PI * m / L);          // pressure envelope along the room
const W = 2 * Math.PI * 0.55;                               // slowed visual oscillation
const AMP = 210;

const tLock = wordAt(beats.standing, /^standing/), tWalk = wordAt(beats.example, /^walk/);
const listenerAt = t => lerp(L / 2, L / 4, ramp(t, tWalk + 0.2, tWalk + 2.6));   // metres from the left wall

const stage = document.getElementById('stage');
const NC = 120;
let cols = '';
for (let i = 0; i < NC; i++) { const w = (X1 - X0) / NC; cols += `<rect class="col" x="${(X0 + i * w).toFixed(1)}" y="${TOP}" width="${(w + 0.6).toFixed(1)}" height="${FLOOR - TOP}" fill="${C.brass}" opacity="0"/>`; }
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <g id="cols">${cols}</g>
  <path id="env1" fill="none" stroke="${C.grey}" stroke-width="2" stroke-dasharray="6 8" opacity="0"/>
  <path id="env2" fill="none" stroke="${C.grey}" stroke-width="2" stroke-dasharray="6 8" opacity="0"/>
  <path id="wr" fill="none" stroke="${C.brass}" stroke-width="3" opacity="0"/>
  <path id="wl" fill="none" stroke="${C.grey}" stroke-width="3" opacity="0"/>
  <path id="sum" fill="none" stroke="${C.ivory}" stroke-width="4" opacity="0"/>
  <!-- Room: two walls, ceiling, floor -->
  <path d="M ${X0} ${TOP - 20} L ${X0} ${FLOOR} L ${X1} ${FLOOR} L ${X1} ${TOP - 20}" fill="none" stroke="${C.ivory}" stroke-width="5"/>
  <line x1="${X0 - 30}" y1="${TOP - 20}" x2="${X1 + 30}" y2="${TOP - 20}" stroke="${C.grey}" stroke-width="2" stroke-dasharray="4 8"/>
  <!-- Sub against the left wall -->
  <g transform="translate(${X0 + 6} ${FLOOR - 120})">
    <rect width="110" height="120" rx="6" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/>
    <circle cx="55" cy="60" r="38" fill="none" stroke="${C.brass}" stroke-width="3"/>
  </g>
  <!-- Distance scale -->
  <g id="scale" opacity="0">
    ${Array.from({ length: L + 1 }, (_, m) => `<line x1="${xpx(m)}" y1="${FLOOR + 14}" x2="${xpx(m)}" y2="${FLOOR + 30}" stroke="${C.grey}" stroke-width="2"/>`).join('')}
    <text x="${X0}" y="${FLOOR + 62}" fill="${C.grey}" font-family="Manrope" font-weight="600" font-size="22" letter-spacing="3">0 M</text>
    <text x="${X1}" y="${FLOOR + 62}" fill="${C.grey}" font-family="Manrope" font-weight="600" font-size="22" letter-spacing="3" text-anchor="end">${L} M</text>
  </g>
  <!-- Listener -->
  <g id="person" opacity="0">
    <circle cx="0" cy="-196" r="20" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    <path d="M -14 -172 L -36 -160 L -40 -96 L -30 -96 L -27 -140 L -24 -90 L -22 0 L -4 0 L 0 -90 L 4 0 L 22 0 L 24 -90 L 27 -140 L 30 -96 L 40 -96 L 36 -160 L 14 -172 Z" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3" stroke-linejoin="round"/>
  </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const colEls = [...stage.querySelectorAll('.col')];
const pathOf = fn => { let d = ''; for (let i = 0; i <= 220; i++) { const m = i / 220 * L; d += (i ? ' L ' : 'M ') + xpx(m).toFixed(1) + ' ' + (MID - fn(m)).toFixed(1); } return d; };
$s('env1').setAttribute('d', pathOf(m => AMP * Math.abs(shape(m))));
$s('env2').setAttribute('d', pathOf(m => -AMP * Math.abs(shape(m))));

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagF"><span class="va-label">Note</span><span class="val">${Math.round(F)} Hz</span><div class="bar"><i style="width:30%"></i></div></div>
  <div class="va-tag right" id="tagL"><span class="va-label">Bass where you stand</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nR"><b>Going out</b></div>
  <div class="va-note va-label" id="nL"><b>Coming back</b></div>
  ${[0, L / 2, L].map((m, i) => `<div class="va-note va-label pk" id="p${i}" style="text-align:center;border-left:none;border-top:2px solid var(--va-brass);padding:8px 10px"><b>Peak</b></div>`).join('')}
  ${[L / 4, 3 * L / 4].map((m, i) => `<div class="va-note va-label" id="h${i}" style="text-align:center;border-left:none;border-top:2px solid var(--va-grey);padding:8px 10px">Hole</div>`).join('')}
  <div class="va-note va-label" id="nSimp">Simplified: one direction only</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, 0)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const ph = W * t;
  const trav = ramp(t, beats.bounce.start + 0.3, beats.bounce.start + 1.0) * (1 - ramp(t, tLock - 0.2, tLock + 0.8)) * end;
  const lock = ramp(t, tLock - 0.4, tLock + 0.6) * end;
  const k = N * Math.PI / L;
  $s('wr').setAttribute('d', pathOf(m => 0.5 * AMP * Math.cos(k * m - ph))); $s('wr').setAttribute('opacity', trav);
  $s('wl').setAttribute('d', pathOf(m => 0.5 * AMP * Math.cos(k * m + ph))); $s('wl').setAttribute('opacity', trav);
  $s('sum').setAttribute('d', pathOf(m => AMP * Math.cos(k * m) * Math.cos(ph)));
  $s('sum').setAttribute('opacity', Math.max(lock, 0.35 * trav));
  $s('env1').setAttribute('opacity', 0.8 * lock); $s('env2').setAttribute('opacity', 0.8 * lock);
  colEls.forEach((c, i) => { const m = (i + 0.5) / NC * L; c.setAttribute('opacity', lock * (0.03 + 0.28 * Math.abs(shape(m)) * (0.55 + 0.45 * Math.abs(Math.cos(ph))))); });
  $s('scale').setAttribute('opacity', lock);

  const pIn = ramp(t, beats.example.start, beats.example.start + 0.6) * end;
  const xm = listenerAt(t);
  $s('person').setAttribute('transform', `translate(${xpx(xm)} ${FLOOR})`); $s('person').setAttribute('opacity', pIn);

  $('nR').style.opacity = trav; at($('nR'), 700, MID - 260, 'translate(0, -50%)');
  $('nL').style.opacity = trav; at($('nL'), 200, MID - 260, 'translate(0, -50%)');
  [0, L / 2, L].forEach((m, i) => { $('p' + i).style.opacity = lock; at($('p' + i), clamp(xpx(m), 150, 930), TOP - 92); });
  const holeA = ramp(t, wordAt(beats.example, /^hole/) - 0.3, wordAt(beats.example, /^hole/) + 0.3) * end;
  [L / 4, 3 * L / 4].forEach((m, i) => { $('h' + i).style.opacity = Math.max(holeA, 0.6 * lock * ramp(t, wordAt(beats.standing, /^silent/) - 0.3, wordAt(beats.standing, /^silent/) + 0.3)); at($('h' + i), xpx(m), TOP - 92); });
  $('nSimp').style.opacity = lock * 0.9; at($('nSimp'), 540, FLOOR + 90);

  const showF = ramp(t, wordAt(beats.example, /^forty/) - 0.3, wordAt(beats.example, /^forty/) + 0.3) * end;
  $('tagF').style.opacity = showF; $('tagL').style.opacity = pIn;
  const lv = Math.abs(shape(xm)), db = 20 * Math.log10(Math.max(lv, 1e-4));
  $('tagL').querySelector('.val').textContent = db < -24 ? 'Hole' : (Math.round(db) === 0 ? 'Peak' : '−' + Math.abs(Math.round(db)) + ' dB');
  $('tagL').querySelector('i').style.width = lv * 100 + '%';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
