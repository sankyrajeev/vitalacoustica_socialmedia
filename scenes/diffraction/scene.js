// Diffraction through a doorway, seen from above. A plane wave arrives from the left; beyond
// the wall the field is the Huygens–Fresnel sum of wavelets from points across the opening
// (2D: e^{ikr}/√r with an obliquity factor). Fields for both frequencies are computed once;
// each frame shows the real part at the current phase. The listener's level is compared with
// a point straight ahead at the same distance.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const hex = s => s.match(/\w\w/g).map(h => parseInt(h, 16));
const P = spec.params, c0 = P.speed_of_sound, D = P.door_m;

const S = 95, X0 = 112, Y0 = 640, WM = 9, HM = 7.6, WALL = 2.4;   // metres → px; region top-left
const CELL = 3, NX = Math.round(WM * S / CELL), NY = Math.round(HM * S / CELL), CYM = HM / 2;
const NSRC = 80;
function field(f) {
  const k = 2 * Math.PI * f / c0, re = new Float32Array(NX * NY), im = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = (i + 0.5) * CELL / S, y = (j + 0.5) * CELL / S - CYM, o = j * NX + i;
    if (x < WALL) { re[o] = Math.cos(k * (x - WALL)); im[o] = Math.sin(k * (x - WALL)); continue; }
    let a = 0, b = 0;
    for (let s = 0; s < NSRC; s++) {
      const ys = (s + 0.5) / NSRC * D - D / 2, dx = x - WALL, dy = y - ys, r = Math.hypot(dx, dy) + 1e-6;
      const w = (1 + dx / r) / 2 / Math.sqrt(r);
      a += w * Math.cos(k * r); b += w * Math.sin(k * r);
    }
    re[o] = a; im[o] = b;
  }
  return { re, im, k };
}
const FH = field(P.f_high_hz), FL = field(P.f_low_hz);
// Normalise each field by its amplitude straight ahead, 1.5 m past the door.
const ampAt = (F, x, y) => { const i = clamp(Math.floor(x * S / CELL), 0, NX - 1), j = clamp(Math.floor((y + CYM) * S / CELL), 0, NY - 1), o = j * NX + i; return Math.hypot(F.re[o], F.im[o]); };
for (const F of [FH, FL]) { const n = ampAt(F, WALL + 1.5, 0); for (let o = 0; o < NX * NY; o++) if (o % NX >= WALL * S / CELL) { F.re[o] /= n; F.im[o] /= n; } }
const R = P.listener_r_m, th = P.listener_deg * Math.PI / 180;
const LX = WALL + R * Math.cos(th), LY = -R * Math.sin(th);
const dBside = F => 20 * Math.log10(ampAt(F, LX, LY) / ampAt(F, WALL + R, 0));
const DBH = dBside(FH), DBL = dBside(FL);

const tLow = wordAt(beats.low, /^low/i);
const mixLow = t => ramp(t, tLow - 0.3, tLow + 0.5);

const stage = document.getElementById('stage');
stage.innerHTML = `<canvas id="cv" width="${NX}" height="${NY}" style="position:absolute;left:${X0}px;top:${Y0}px;width:${NX * CELL}px;height:${NY * CELL}px;image-rendering:auto"></canvas>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  <rect x="${X0 + WALL * S - 8}" y="${Y0}" width="16" height="${(CYM - D / 2) * S}" fill="${C.ivory}"/>
  <rect x="${X0 + WALL * S - 8}" y="${Y0 + (CYM + D / 2) * S}" width="16" height="${(CYM - D / 2) * S}" fill="${C.ivory}"/>
  <g id="you" transform="translate(${X0 + LX * S} ${Y0 + (LY + CYM) * S})"><circle r="22" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/><circle r="5" fill="${C.ivory}"/></g>
 </g>
</svg>`;
const cv = stage.querySelector('#cv'), ctx = cv.getContext('2d'), img = ctx.createImageData(NX, NY);
const $s = id => stage.querySelector('#' + id);
const OB = hex(C.obsidian), BR = hex(C.brass), IV = hex(C.ivory), CH = hex(C.charcoal);

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagF"><span class="va-label">Note</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagS"><span class="va-label">Level at the side</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nWall" style="text-align:center;border-left:none;padding:6px 10px">Wall with a 1.2 m doorway</div>
  <div class="va-note va-label" id="nYou" style="text-align:center;border-left:none;padding:6px 10px">You, round the side</div>
  <div class="va-note va-label" id="nWave" style="text-align:center;border-left:none;padding:6px 10px"></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const base = ramp(t, beats.hook.end - 0.6, beats.hook.end) * end;
  $s('all').setAttribute('opacity', base); cv.style.opacity = base;
  const m = mixLow(t), F = m < 0.5 ? FH : FL, fade = Math.abs(m - 0.5) * 2;   // dip through dark while switching
  const ph = 2 * Math.PI * 0.9 * t, cp = Math.cos(ph), sp = Math.sin(ph);
  const d = img.data;
  for (let o = 0; o < NX * NY; o++) {
    const x = (o % NX) * CELL / S, r = x > WALL ? Math.sqrt(Math.max(0.3, x - WALL)) : 1;   // offset 2D spreading loss for display
    let v = (F.re[o] * cp + F.im[o] * sp) * r * fade;
    v = clamp(v, -1.2, 1.2) / 1.2;
    const col = v >= 0 ? BR.map((c, i) => OB[i] + (c - OB[i]) * v) : CH.map((c, i) => OB[i] + (c - OB[i]) * -v * 1.6);
    d[o * 4] = col[0]; d[o * 4 + 1] = col[1]; d[o * 4 + 2] = col[2]; d[o * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const show = ramp(t, beats.door.start, beats.door.start + 0.6) * end;
  const hi = m < 0.5;
  $('tagF').style.opacity = show; $('tagS').style.opacity = ramp(t, beats.high.start, beats.high.start + 0.6) * end;
  const f = hi ? P.f_high_hz : P.f_low_hz;
  $('tagF').querySelector('.val').textContent = `${f.toLocaleString('en-US')} Hz`;
  $('tagF').querySelector('i').style.width = (hi ? 100 : 25) + '%';
  const db = hi ? DBH : DBL;
  $('tagS').querySelector('.val').textContent = `${db.toFixed(0).replace('-', '−')} dB`;
  $('tagS').querySelector('i').style.width = clamp(1 + db / 30) * 100 + '%';
  const lam = c0 / f;
  $('nWave').innerHTML = `One wave: <b>${lam >= 1 ? lam.toFixed(1) + ' m' : Math.round(lam * 100) + ' cm'}</b>`;
  at($('nWave'), X0 + WALL * S / 2, Y0 + 40); $('nWave').style.opacity = show;
  at($('nWall'), X0 + WALL * S, Y0 + HM * S + 30); $('nWall').style.opacity = show;
  at($('nYou'), X0 + LX * S, Y0 + (LY + CYM) * S - 46); $('nYou').style.opacity = ramp(t, beats.high.start, beats.high.start + 0.6) * end;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
