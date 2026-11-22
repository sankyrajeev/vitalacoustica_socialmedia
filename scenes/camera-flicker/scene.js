// LED flicker on camera. The light is pulse-width modulated: on for `duty` of each period.
// The eye sees the average. A rolling-shutter camera exposes each row for E seconds, starting
// row by row across the readout time; each row's brightness is the exact on-time inside its
// window. Raising the pulse rate puts many whole pulses in every window and the bands vanish.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const P = spec.params, D = P.duty, E = P.exposure_s, RO = P.readout_s;
const srgb = Y => Y <= 0.0031308 ? 12.92 * Y : 1.055 * Y ** (1 / 2.4) - 0.055;
const hex = s => s.match(/\w\w/g).map(h => parseInt(h, 16));
const mix = (a, b, x) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * x)).join(',')})`; };

const tHigh = wordAt(beats.fix, /^higher/i);
const freq = t => P.pwm_low_hz * (P.pwm_high_hz / P.pwm_low_hz) ** ramp(t, tHigh, tHigh + 1.6);
// Cumulative on-time from 0 to x (seconds) for pulse rate f.
const onTime = (x, f) => { const n = Math.floor(x * f), r = x * f - n; return (n * D + Math.min(r, D)) / f; };
const rowLevel = (a, f) => (onTime(a + E, f) - onTime(a, f)) / E;   // fraction of the time on, 0..1
function contrast(f) {
  let mx = 0, mn = 1;
  for (let i = 0; i < 4000; i++) { const v = rowLevel(RO * i / 4000, f); mx = Math.max(mx, v); mn = Math.min(mn, v); }
  return mx > 0 ? (mx - mn) / mx : 0;
}

const WX0 = 120, WX1 = 960, WHI = 560, WLO = 650, WIN = 0.01;   // waveform strip shows 10 ms
const PX0 = 580, PX1 = 960, PY0 = 790, PY1 = 1210, NR = 84;      // camera picture
const EX = 310, EY = 1000;                                       // eye panel centre
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  <g id="wave"><line x1="${WX0}" y1="${WLO}" x2="${WX1}" y2="${WLO}" stroke="${C.grey}" stroke-width="2"/><path id="wp" fill="${C.brass}" fill-opacity="0.85"/></g>
  <g id="eye"><rect x="120" y="${PY0}" width="380" height="${PY1 - PY0}" rx="12" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="2"/>
    <circle id="glow" cx="${EX}" cy="${EY}" r="140"/></g>
  <g id="cam"><rect x="${PX0}" y="${PY0}" width="${PX1 - PX0}" height="${PY1 - PY0}" rx="12" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="2"/>
    <g id="rows"></g></g>
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const RH = (PY1 - PY0 - 24) / NR;
for (let i = 0; i < NR; i++) $s('rows').insertAdjacentHTML('beforeend', `<rect x="${PX0 + 12}" y="${(PY0 + 12 + i * RH).toFixed(2)}" width="${PX1 - PX0 - 24}" height="${(RH + 0.6).toFixed(2)}"/>`);
const rows = [...$s('rows').children];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagF"><span class="va-label">Pulse rate</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagC"><span class="va-label">Banding on camera</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nW" style="text-align:center;border-left:none;padding:6px 10px">Light on and off · 10 ms shown</div>
  <div class="va-note va-label" id="nE" style="text-align:center;border-left:none;padding:6px 10px"><b>Your eyes</b></div>
  <div class="va-note va-label" id="nC" style="text-align:center;border-left:none;padding:6px 10px"><b>Camera, fast shutter</b></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  const f = freq(t);
  // Waveform: on-pulses as filled blocks, drifting slowly so it reads as running.
  const off = (t * 0.0015) % (1 / f), per = 1 / f;
  let d = '';
  for (let s = -off; s < WIN; s += per) {
    const a = Math.max(0, s), b = Math.min(WIN, s + D * per);
    if (b > a) { const xa = WX0 + (a / WIN) * (WX1 - WX0), xb = WX0 + (b / WIN) * (WX1 - WX0); d += `M${xa.toFixed(1)} ${WLO}V${WHI}H${xb.toFixed(1)}V${WLO}Z`; }
  }
  $s('wp').setAttribute('d', d);
  $s('wave').setAttribute('opacity', ramp(t, beats.pwm.start, beats.pwm.start + 0.6));
  const lit = c => mix(C.obsidian, C.ivory, srgb(c * 0.85));
  $s('glow').setAttribute('fill', lit(D));
  $s('eye').setAttribute('opacity', ramp(t, beats.eye.start, beats.eye.start + 0.6));
  rows.forEach((r, i) => r.setAttribute('fill', lit(rowLevel(RO * i / NR, f))));
  const camOn = ramp(t, beats.camera.start, beats.camera.start + 0.6);
  $s('cam').setAttribute('opacity', camOn);

  const show = ramp(t, beats.pwm.start + 0.2, beats.pwm.start + 0.8) * end;
  $('tagF').style.opacity = show; $('tagC').style.opacity = camOn * end;
  const fr = f < 1000 ? Math.round(f / 10) * 10 : Math.round(f / 100) * 100;
  $('tagF').querySelector('.val').textContent = fr.toLocaleString('en-US') + ' Hz';
  $('tagF').querySelector('i').style.width = clamp(Math.log(f / 100) / Math.log(P.pwm_high_hz / 100)) * 100 + '%';
  const c = contrast(f);
  $('tagC').querySelector('.val').textContent = Math.round(c * 100) + '%';
  $('tagC').querySelector('i').style.width = c * 100 + '%';
  at($('nW'), 540, WLO + 32); $('nW').style.opacity = ramp(t, beats.pwm.start, beats.pwm.start + 0.6) * end;
  at($('nE'), (120 + 500) / 2, PY0 - 32); $('nE').style.opacity = ramp(t, beats.eye.start, beats.eye.start + 0.6) * end;
  at($('nC'), (PX0 + PX1) / 2, PY0 - 32); $('nC').style.opacity = camOn * end;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
