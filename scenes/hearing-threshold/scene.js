// Music against the threshold of hearing. Octave-band levels of an example music spectrum are
// drawn as bars; the threshold curve is the standard free-field hearing threshold (ISO 389-7).
// The part of each bar above the curve is what you hear. Turning the volume down shifts every
// band by the same number of decibels, and the bass bands fall below the curve first.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

const TH = [[20, 78.5], [25, 68.7], [31.5, 59.5], [40, 51.1], [50, 44.0], [63, 37.5], [80, 31.5], [100, 26.5], [125, 22.1], [160, 17.9], [200, 14.4], [250, 11.4], [315, 8.6], [400, 6.2], [500, 4.4], [630, 3.0], [800, 2.2], [1000, 2.4], [1250, 3.5], [1600, 1.7], [2000, -1.3], [2500, -4.2], [3150, -6.0], [4000, -5.4], [5000, -1.5], [6300, 6.0], [8000, 12.6], [10000, 13.9]];
const thr = f => { const l = Math.log(f); for (let i = 1; i < TH.length; i++) if (f <= TH[i][0]) { const a = Math.log(TH[i - 1][0]), b = Math.log(TH[i][0]); return lerp(TH[i - 1][1], TH[i][1], (l - a) / (b - a)); } return TH[TH.length - 1][1]; };
const BANDS = [[31.5, 80], [63, 85], [125, 83], [250, 80], [500, 77], [1000, 74], [2000, 71], [4000, 70], [8000, 68]];
const BASS = 3;
const boostAt = f => 12 / (1 + (f / 80) ** 2);             // low shelf, about +12 dB at the bottom

const tDown = wordAt(beats.quiet, /^down/i), tBoost = wordAt(beats.takeaway, /^extra/i);
const shift = t => spec.params.quiet_db * ramp(t, tDown, tDown + 1.6);
const boost = t => ramp(t, tBoost, tBoost + 1.2);

const X0 = 150, X1 = 950, Y0 = 1330, Y1 = 640, F0 = 20, F1 = 11000, D0 = -12, D1 = 95;
const xf = f => lerp(X0, X1, Math.log(f / F0) / Math.log(F1 / F0)), yd = d => lerp(Y0, Y1, (d - D0) / (D1 - D0));
let thD = '', fillD = `M ${X0} ${Y0} `;
for (let i = 0; i <= 160; i++) { const f = F0 * (10000 / F0) ** (i / 160); const p = `${xf(f).toFixed(1)} ${yd(thr(f)).toFixed(1)} `; thD += (i ? 'L' : 'M') + p; fillD += 'L' + p; }
fillD += `L ${xf(10000)} ${Y0} Z`;

const BW = 62;
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  <path id="thFill" d="${fillD}" fill="${C.charcoal}"/>
  <g id="bars">${BANDS.map(() => `<g><rect class="lo" width="${BW}" fill="${C.grey}" fill-opacity="0.22"/><rect class="hi" width="${BW}" fill="${C.brass}"/></g>`).join('')}</g>
  <path id="th" d="${thD}" fill="none" stroke="${C.ivory}" stroke-width="4"/>
  <line x1="${X0}" y1="${Y0}" x2="${X1}" y2="${Y0}" stroke="${C.grey}" stroke-width="2"/>
  <line x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y1}" stroke="${C.grey}" stroke-width="2"/>
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const groups = [...$s('bars').children];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagV"><span class="va-label">Volume</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagB"><span class="va-label">Bass you can hear</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nTh" style="text-align:center;border-left:none;padding:6px 10px"><b>Line: threshold of hearing</b> · shaded: too quiet to hear</div>
  <div class="va-note va-label" id="nBass" style="text-align:center;border-left:none;padding:6px 10px">Bass</div>
  <div class="va-note va-label" id="nMid" style="text-align:center;border-left:none;padding:6px 10px">Mids</div>
  <div class="va-note va-label" id="nHi" style="text-align:center;border-left:none;padding:6px 10px">Highs</div>
  <div class="va-note va-label" id="nLvl" style="text-align:center;border-left:none;padding:6px 10px">Level</div>
  <div class="va-note va-label" id="nBoost" style="text-align:center;border-left:none;padding:6px 10px"><b>Bass lifted</b></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  const thOn = ramp(t, wordAt(beats.ears, /^bass/i) - 0.3, wordAt(beats.ears, /^bass/i) + 0.6);
  $s('th').setAttribute('opacity', thOn); $s('thFill').setAttribute('opacity', thOn);
  const barOn = ramp(t, beats.loud.start, beats.loud.start + 0.8);
  const sh = shift(t), bo = boost(t);
  let heard = 0;
  BANDS.forEach(([f, L0], k) => {
    const L = L0 + sh + bo * boostAt(f), T = thr(f), x = xf(f) - BW / 2;
    const grow = clamp((barOn * 1.6) - k * 0.07);
    const top = lerp(D0, L, clamp(grow)), cut = Math.min(top, T);
    const [lo, hi] = groups[k].children;
    lo.setAttribute('x', x); lo.setAttribute('y', yd(cut)); lo.setAttribute('height', Math.max(0, yd(D0) - yd(cut)));
    hi.setAttribute('x', x); hi.setAttribute('y', yd(top)); hi.setAttribute('height', Math.max(0, yd(cut) - yd(top)));
    if (k < BASS && L > T) heard++;
  });
  $s('bars').setAttribute('opacity', barOn);

  const show = ramp(t, beats.loud.start, beats.loud.start + 0.6) * end;
  $('tagV').style.opacity = show; $('tagB').style.opacity = show;
  $('tagV').querySelector('.val').textContent = (sh > -0.05 ? '0' : '−' + Math.abs(sh).toFixed(0)) + ' dB';
  $('tagV').querySelector('i').style.width = (1 + sh / 60) * 100 + '%';
  $('tagB').querySelector('.val').textContent = `${heard} of ${BASS} bands`;
  $('tagB').querySelector('i').style.width = heard / BASS * 100 + '%';
  at($('nTh'), 540, Y1 - 75); $('nTh').style.opacity = thOn * end;
  at($('nBass'), xf(63), Y0 + 32); at($('nMid'), xf(700), Y0 + 32); at($('nHi'), xf(5600), Y0 + 32);
  at($('nLvl'), X0 - 14, Y1 - 30, 'translate(0, -50%)');
  for (const id of ['nBass', 'nMid', 'nHi', 'nLvl']) $(id).style.opacity = ramp(t, beats.ears.start, beats.ears.start + 0.6) * end;
  at($('nBoost'), xf(63), yd(85 - 52 + 12) - 60); $('nBoost').style.opacity = bo * end;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
