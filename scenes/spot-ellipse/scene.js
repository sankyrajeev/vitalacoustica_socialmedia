// A spotlight's cone meeting the floor. Side view on top; the floor seen from above below.
// For each floor point: inside the beam if its angle from the fixture's axis is within the
// half-angle; illuminance E = I·cos(incidence)/d² with cos(incidence) = h/d. The pool's length,
// width and near/far brightness are measured from that.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const hex = s => s.match(/\w\w/g).map(h => parseInt(h, 16));
const H = spec.params.height_m, AL = spec.params.half_angle_deg * Math.PI / 180, TMAX = spec.params.tilt_deg * Math.PI / 180;
const srgb = Y => Y <= 0.0031308 ? 12.92 * Y : 1.055 * Y ** (1 / 2.4) - 0.055;

const tTilt = wordAt(beats.tilt, /^tilt/i);
const tilt = t => TMAX * ramp(t, tTilt, tTilt + 1.6);
const E0 = 1 / (H * H);                                   // straight below, normal incidence
const Eat = (x, y) => { const d2 = x * x + y * y + H * H, d = Math.sqrt(d2); return (H / d) / d2; };
const inBeam = (x, y, th) => { const d = Math.hypot(x, y, H); return (x * Math.sin(th) + H * Math.cos(th)) / d >= Math.cos(AL); };
// Pool extent along x (exact) and its width at the beam's centre line.
function pool(th) {
  const xn = H * Math.tan(th - AL), xf = H * Math.tan(th + AL), xc = H * Math.tan(th);
  let w = 0; while (inBeam(xc, w + 0.001, th)) w += 0.001;
  // width at its widest point
  let wmax = 0; for (let i = 0; i <= 200; i++) { const x = lerp(xn, xf, i / 200); let y = 0; while (inBeam(x, y + 0.002, th)) y += 0.002; wmax = Math.max(wmax, y); }
  return { xn, xf, xc, w: 2 * wmax };
}

const S = 50, FX = 230, FLOOR = 940, PY = 1190;           // px per metre, fixture x, floor line, plan centre
const sx = x => FX + x * S;
const CELL = 2, PW = 840, PH = 260, PX0 = 120;
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  <line x1="${PX0}" y1="${FLOOR}" x2="${PX0 + PW}" y2="${FLOOR}" stroke="${C.grey}" stroke-width="3"/>
  <line x1="${FX}" y1="${FLOOR - H * S - 30}" x2="${FX}" y2="${FLOOR - H * S + 8}" stroke="${C.grey}" stroke-width="4"/>
  <polygon id="cone" fill="${C.ivory}" fill-opacity="0.14"/>
  <line id="axis" stroke="${C.brass}" stroke-width="2" stroke-dasharray="6 8"/>
  <g id="fix"><rect x="-26" y="-20" width="52" height="40" rx="8" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/><rect x="-18" y="16" width="36" height="8" rx="3" fill="${C.ivory}"/></g>
  <rect x="${PX0}" y="${PY - PH / 2}" width="${PW}" height="${PH}" rx="12" fill="none" stroke="${C.grey}" stroke-width="2"/>
  <circle cx="${FX}" cy="${PY}" r="6" fill="${C.grey}"/>
 </g>
</svg>
<canvas id="cv" width="${PW / CELL}" height="${PH / CELL}" style="position:absolute;left:${PX0}px;top:${PY - PH / 2}px;width:${PW}px;height:${PH}px"></canvas>`;
const $s = id => stage.querySelector('#' + id);
const cv = stage.querySelector('#cv'), ctx = cv.getContext('2d'), img = ctx.createImageData(cv.width, cv.height);
const OB = hex(C.obsidian), IV = hex(C.ivory), BR = hex(C.brass);

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagT"><span class="va-label">Tilt from straight down</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagL"><span class="va-label">Pool length ÷ width</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nSide" style="text-align:center;border-left:none;padding:6px 10px">Side view · fixture 6 m up · 24° beam</div>
  <div class="va-note va-label" id="nPlan" style="text-align:center;border-left:none;padding:6px 10px">The floor, seen from above</div>
  <div class="va-note va-label" id="nFar" style="text-align:center;border-left:none;padding:6px 10px"></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const base = ramp(t, beats.hook.end - 0.6, beats.hook.end) * end;
  $s('all').setAttribute('opacity', base); cv.style.opacity = base;
  const th = tilt(t), p = pool(th);
  const fy = FLOOR - H * S;
  $s('fix').setAttribute('transform', `translate(${FX} ${fy}) rotate(${-th * 180 / Math.PI})`);
  $s('cone').setAttribute('points', `${FX},${fy} ${sx(p.xn)},${FLOOR} ${sx(p.xf)},${FLOOR}`);
  $s('axis').setAttribute('x1', FX); $s('axis').setAttribute('y1', fy); $s('axis').setAttribute('x2', sx(p.xc)); $s('axis').setAttribute('y2', FLOOR);
  // Plan view: illuminance on the floor, relative to straight below.
  const d = img.data, W = cv.width, Hh = cv.height;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const x = (PX0 + (i + 0.5) * CELL - FX) / S, y = ((j + 0.5) * CELL - PH / 2) / S, o = (j * W + i) * 4;
    let v = 0;
    if (inBeam(x, y, th)) v = srgb(clamp(Eat(x, y) / E0)) ;
    const col = v < 0.6 ? OB.map((c, k) => c + (BR[k] - c) * v / 0.6) : BR.map((c, k) => c + (IV[k] - c) * (v - 0.6) / 0.4);
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const show = ramp(t, beats.straight.start, beats.straight.start + 0.6) * end;
  $('tagT').style.opacity = show; $('tagL').style.opacity = show;
  const deg = Math.round(th * 180 / Math.PI);
  $('tagT').querySelector('.val').textContent = deg + '°'; $('tagT').querySelector('i').style.width = deg / 90 * 100 + '%';
  const ratio = (p.xf - p.xn) / p.w;
  $('tagL').querySelector('.val').textContent = ratio.toFixed(2) + '×'; $('tagL').querySelector('i').style.width = clamp(ratio / 2) * 100 + '%';
  const eN = Eat(lerp(p.xn, p.xc, 0.1), 0), eF = Eat(lerp(p.xf, p.xc, 0.1), 0);
  $('nFar').innerHTML = `Far end: <b>${Math.round(100 * eF / eN)}%</b> as bright as the near end`;
  const dimOn = ramp(t, beats.dim.start, beats.dim.start + 0.6) * end;
  $('nFar').style.opacity = dimOn; at($('nFar'), 540, PY + PH / 2 + 34);
  at($('nSide'), 540, FLOOR - H * S - 60); at($('nPlan'), 540, PY - PH / 2 - 26);
  $('nSide').style.opacity = show; $('nPlan').style.opacity = show;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
