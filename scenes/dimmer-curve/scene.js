// Dimmer curves. A fader drives a light; the pool of light is drawn at the true output
// (encoded for the screen), and the "Looks" value is CIE lightness L* of that output, the
// standard model of perceived lightness. Linear: fader = output. Square law: output = fader².
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const Lstar = Y => (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y) / 100;
const Yof = L => { const f = (L * 100 + 16) / 116; return f ** 3; };      // inverse of L*
const srgb = Y => Y <= 0.0031308 ? 12.92 * Y : 1.055 * Y ** (1 / 2.4) - 0.055;
const hex = s => s.match(/\w\w/g).map(h => parseInt(h, 16));
const mix = (a, b, x) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * x)).join(',')})`; };

const FIFTH = Yof(0.5);                                    // output that looks half: ~0.184
const tHalf = wordAt(beats.half, /^half/i), tDrop = wordAt(beats.fifth, /^drop/i);
const tBack = beats.curve.start + 0.1, tSq = wordAt(beats.curve, /^square/i), tHalf2 = wordAt(beats.curve, /^half/i);
const mv = (t, a) => ramp(t, a, a + 1.2);
function fader(t) {
  let f = 1;
  f = lerp(f, 0.5, mv(t, tHalf)); f = lerp(f, FIFTH, mv(t, tDrop));
  f = lerp(f, 1, mv(t, tBack)); f = lerp(f, 0.5, mv(t, tHalf2));
  return f;
}
const sq = t => t >= tSq ? 1 : 0;
const output = t => { const f = fader(t); return sq(t) ? f * f : f; };

const FX = 170, FT = 600, FB = 1000;                       // fader track
const LX = 640, LY0 = 600, PY = 880, PR = 190;             // lamp and its pool
const GX0 = 200, GX1 = 940, GY0 = 1330, GY1 = 1080;        // chart: x output 0..1, y looks 0..1
const gx = v => lerp(GX0, GX1, v), gy = v => lerp(GY0, GY1, v);
let curveD = ''; for (let i = 0; i <= 100; i++) curveD += (i ? 'L' : 'M') + gx(i / 100).toFixed(1) + ' ' + gy(Lstar(i / 100)).toFixed(1) + ' ';

const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  <line x1="${FX}" y1="${FT}" x2="${FX}" y2="${FB}" stroke="${C.grey}" stroke-width="6" stroke-linecap="round"/>
  ${[0, 0.25, 0.5, 0.75, 1].map(v => `<line x1="${FX - 30}" x2="${FX - 18}" y1="${lerp(FB, FT, v)}" y2="${lerp(FB, FT, v)}" stroke="${C.grey}" stroke-width="2"/>`).join('')}
  <rect id="knob" x="${FX - 36}" width="72" height="34" rx="6" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
  <ellipse id="pool" cx="${LX}" cy="${PY}" rx="${PR}" ry="${PR * 0.38}"/>
  <polygon id="cone" points="${LX - 40},${LY0 + 40} ${LX + 40},${LY0 + 40} ${LX + PR},${PY} ${LX - PR},${PY}" opacity="0.18"/>
  <g transform="translate(${LX} ${LY0})"><rect x="-70" y="-50" width="140" height="80" rx="14" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/><rect id="lens" x="-45" y="28" width="90" height="14" rx="5"/></g>
  <line x1="${GX0}" y1="${GY0}" x2="${GX1}" y2="${GY0}" stroke="${C.grey}" stroke-width="2"/>
  <line x1="${GX0}" y1="${GY0}" x2="${GX0}" y2="${GY1}" stroke="${C.grey}" stroke-width="2"/>
  <line x1="${GX0}" y1="${GY0}" x2="${GX1}" y2="${GY1}" stroke="${C.grey}" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="6 8"/>
  <path d="${curveD}" fill="none" stroke="${C.brass}" stroke-width="4"/>
  <line id="gv" stroke="${C.ivory}" stroke-opacity="0.5" stroke-width="2" stroke-dasharray="4 6"/>
  <line id="gh" stroke="${C.ivory}" stroke-opacity="0.5" stroke-width="2" stroke-dasharray="4 6"/>
  <circle id="dot" r="12" fill="${C.ivory}"/>
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagF"><span class="va-label">Fader</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagL"><span class="va-label">Looks</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nCurve" style="text-align:center;border-left:none;padding:6px 10px"></div>
  <div class="va-note va-label" id="nOut" style="text-align:center;border-left:none;padding:6px 10px"></div>
  <div class="va-note va-label" id="nX" style="text-align:center;border-left:none;padding:6px 10px">Light out</div>
  <div class="va-note va-label" id="nY" style="text-align:center;border-left:none;padding:6px 10px">Looks</div>
  <div class="va-note va-label" id="nLin" style="text-align:center;border-left:none;padding:6px 10px">If eyes were linear</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const base = ramp(t, beats.hook.end - 0.6, beats.hook.end) * end;
  $s('all').setAttribute('opacity', base);
  const f = fader(t), Y = output(t), L = Lstar(Y);
  $s('knob').setAttribute('y', lerp(FB, FT, f) - 17);
  const col = mix(C.obsidian, C.ivory, srgb(Y));
  $s('pool').setAttribute('fill', col); $s('lens').setAttribute('fill', col); $s('cone').setAttribute('fill', col);
  $s('dot').setAttribute('cx', gx(Y)); $s('dot').setAttribute('cy', gy(L));
  $s('gv').setAttribute('x1', gx(Y)); $s('gv').setAttribute('x2', gx(Y)); $s('gv').setAttribute('y1', GY0); $s('gv').setAttribute('y2', gy(L));
  $s('gh').setAttribute('x1', GX0); $s('gh').setAttribute('x2', gx(Y)); $s('gh').setAttribute('y1', gy(L)); $s('gh').setAttribute('y2', gy(L));

  const show = ramp(t, beats.eye.start + 0.2, beats.eye.start + 0.8) * end;
  $('tagF').style.opacity = show; $('tagL').style.opacity = show;
  $('tagF').querySelector('.val').textContent = Math.round(f * 100) + '%'; $('tagF').querySelector('i').style.width = f * 100 + '%';
  $('tagL').querySelector('.val').textContent = Math.round(L * 100) + '%'; $('tagL').querySelector('i').style.width = L * 100 + '%';
  $('nCurve').innerHTML = 'Curve: <b>' + (sq(t) ? 'Square law' : 'Linear') + '</b>'; at($('nCurve'), FX + 30, FT - 50);
  $('nOut').innerHTML = 'Light out <b>' + Math.round(Y * 100) + '%</b>'; at($('nOut'), LX, PY + PR * 0.38 + 40);
  at($('nX'), (GX0 + GX1) / 2, GY0 + 30); at($('nY'), GX0 - 10, GY1 - 28, 'translate(0, -50%)'); at($('nLin'), gx(0.8) + 30, gy(0.8) + 40);
  for (const id of ['nCurve', 'nOut', 'nX', 'nY', 'nLin']) $(id).style.opacity = show;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
