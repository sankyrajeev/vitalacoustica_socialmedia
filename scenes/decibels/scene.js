// Decibels. Power is shown as lit squares (1 W each) on a 10 × 10 grid. Level gain is
// 10·log10(P / 1 W); perceived loudness uses the rule of thumb "+10 dB ≈ twice as loud",
// i.e. 2^(dB/10). Both are computed from the same power value.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

// Power steps, tied to the words that announce them.
const t2 = wordAt(beats.double, /^double/), t10 = wordAt(beats.twice, /^ten/), t100 = wordAt(beats.takeaway, /^hundred/);
const step = (t, a, b, ts, dur) => lerp(a, b, ramp(t, ts, ts + dur));
const powerAt = t => step(t, 1, 2, t2, 0.4) + (step(t, 2, 10, t10, 1.0) - 2) + (step(t, 10, 100, t100, 1.8) - 10);

const N = 10, CELL = 56, GAP = 7, GW = N * CELL + (N - 1) * GAP, GX = 540 - GW / 2, GY = 560;
const stage = document.getElementById('stage');
let cells = '';
for (let k = 0; k < N * N; k++) {
  const x = GX + (k % N) * (CELL + GAP), y = GY + Math.floor(k / N) * (CELL + GAP);
  cells += `<rect class="c" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="6" fill="${C.charcoal}" stroke="${C.grey}" stroke-opacity="0.35" stroke-width="1.5"/>`;
}
const BY = GY + GW + 120, BX0 = 140, BX1 = 940, LMAX = 4.4, bx = l => BX0 + (BX1 - BX0) * (l - 1) / (LMAX - 1);
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <g id="grid" opacity="0">${cells}</g>
  <g id="loud" opacity="0">
    <text x="${BX0}" y="${BY - 34}" fill="${C.grey}" font-family="Manrope" font-weight="600" font-size="20" letter-spacing="3.6">HOW LOUD IT SOUNDS</text>
    <text id="ltxt" x="${BX1}" y="${BY - 30}" fill="${C.ivory}" font-family="Instrument Serif" font-size="46" text-anchor="end"></text>
    <rect x="${BX0}" y="${BY - 10}" width="${BX1 - BX0}" height="20" rx="10" fill="${C.charcoal}" stroke="${C.grey}" stroke-opacity="0.4" stroke-width="1.5"/>
    <rect id="lbar" x="${BX0}" y="${BY - 10}" width="0" height="20" rx="10" fill="${C.brass}"/>
    ${[1, 2, 4].map(l => `<line x1="${bx(l)}" y1="${BY + 16}" x2="${bx(l)}" y2="${BY + 30}" stroke="${C.grey}" stroke-width="2"/><text x="${bx(l)}" y="${BY + 58}" fill="${C.grey}" font-family="Manrope" font-weight="600" font-size="20" letter-spacing="2" text-anchor="middle">×${l}</text>`).join('')}
  </g>
</svg>`;
const cellEls = [...stage.querySelectorAll('.c')];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagP"><span class="va-label">Amplifier power</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagL"><span class="va-label">Level</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nKey">Each square = 1 W</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const show = ramp(t, beats.scale.start, beats.scale.start + 0.6) * end;
  const P = powerAt(t), dB = 10 * Math.log10(P), loud = Math.pow(2, dB / 10);
  stage.querySelector('#grid').setAttribute('opacity', show);
  stage.querySelector('#loud').setAttribute('opacity', ramp(t, beats.double.start, beats.double.start + 0.6) * end);
  cellEls.forEach((c, k) => {
    const on = clamp(P - k);                                  // fills square by square
    c.setAttribute('fill', on > 0 ? C.brass : C.charcoal); c.setAttribute('fill-opacity', on > 0 ? 0.25 + 0.75 * on : 1);
  });
  stage.querySelector('#lbar').setAttribute('width', Math.max(20, bx(loud) - BX0));
  stage.querySelector('#ltxt').textContent = 'About ×' + (loud < 1.95 ? loud.toFixed(1) : Math.round(loud)) + ' as loud';
  $('tagP').style.opacity = show; $('tagL').style.opacity = show;
  $('tagP').querySelector('.val').textContent = Math.round(P) + ' W'; $('tagP').querySelector('i').style.width = P + '%';
  $('tagL').querySelector('.val').textContent = '+' + Math.round(dB) + ' dB'; $('tagL').querySelector('i').style.width = dB / 20 * 100 + '%';
  $('nKey').style.opacity = show; $('nKey').style.left = '540px'; $('nKey').style.top = (GY - 50) + 'px'; $('nKey').style.transform = 'translate(-50%, -50%)';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
