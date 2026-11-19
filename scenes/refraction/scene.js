// Sound bending with temperature. Rays are traced through air whose sound speed varies
// with height: c(h) = c0 + g·h. By day the ground heats the air (g < 0: faster near the
// ground) and rays curve upwards; at night an inversion (g > 0) bends them back down,
// and they bounce off the ground and carry further. The gradient is exaggerated so the
// bending is visible at this scale; that is labelled on screen.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

const GROUND = 1180, SX = 120, SH = 70, LX = 955, TOPH = GROUND - 470;   // px; rays end above TOPH height
const G_DAY = -0.0013, G_NIGHT = 0.0013;
const tNight = wordAt(beats.night, /^cools/);
const gAt = t => lerp(G_DAY, G_NIGHT, ramp(t, tNight - 0.3, tNight + 2.2));
const ANG = [-8, -4, 0, 4, 8, 12, 16, 20, 24].map(a => a * Math.PI / 180);

// Trace one ray; returns points (x, h) and the height where it crosses the listener's x, if any.
function trace(theta0, g) {
  let x = SX, h = SH, th = theta0; const pts = [[x, h]]; let atL = null;
  const ds = 3;
  for (let i = 0; i < 700; i++) {
    const c = 1 + g * h;
    th += -(g * Math.cos(th)) / c * ds;
    const nx = x + Math.cos(th) * ds, nh = h + Math.sin(th) * ds;
    if (atL === null && x < LX && nx >= LX) atL = h + (nh - h) * (LX - x) / (nx - x);
    x = nx; h = nh;
    if (h < 0) { h = -h; th = -th; }                     // reflect off the ground
    pts.push([x, h]);
    if (x > 1060 || h > GROUND - TOPH || x < 0) break;
  }
  return { pts, atL };
}

const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <defs>
    <linearGradient id="dayAir" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.brass}" stop-opacity="0.32"/><stop offset="0.55" stop-color="${C.brass}" stop-opacity="0.04"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0"/></linearGradient>
    <linearGradient id="nightAir" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.brass}" stop-opacity="0"/><stop offset="0.45" stop-color="${C.brass}" stop-opacity="0.2"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0.04"/></linearGradient>
    <clipPath id="sky"><rect x="0" y="${TOPH}" width="1080" height="${GROUND - TOPH}"/></clipPath>
  </defs>
  <rect id="airD" x="0" y="${TOPH}" width="1080" height="${GROUND - TOPH}" fill="url(#dayAir)"/>
  <rect id="airN" x="0" y="${TOPH}" width="1080" height="${GROUND - TOPH}" fill="url(#nightAir)" opacity="0"/>
  <g clip-path="url(#sky)"><g id="rays"></g><g id="dots"></g></g>
  <line x1="40" y1="${GROUND}" x2="1040" y2="${GROUND}" stroke="${C.grey}" stroke-width="3"/>
  <!-- Speaker on the ground -->
  <g transform="translate(${SX - 40} ${GROUND - 110})"><rect width="80" height="110" rx="6" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/><circle cx="40" cy="70" r="24" fill="none" stroke="${C.brass}" stroke-width="3"/><circle cx="40" cy="28" r="9" fill="none" stroke="${C.brass}" stroke-width="3"/></g>
  <!-- Listener, far away -->
  <g transform="translate(${LX} ${GROUND})"><circle cy="-112" r="16" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    <path d="M -10 -94 L -24 -84 L -26 -44 L -16 -44 L -14 -70 L -12 0 L -2 0 L 0 -54 L 2 0 L 12 0 L 14 -70 L 16 -44 L 26 -44 L 24 -84 L 10 -94 Z" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle id="hear" cy="-112" r="34" fill="none" stroke="${C.brass}" stroke-width="3" opacity="0"/></g>
  <!-- Sun and moon -->
  <g id="sun" transform="translate(960 ${TOPH + 50})"><circle r="30" fill="${C.brass}"/>${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="-42" x2="0" y2="-54" stroke="${C.brass}" stroke-width="4" transform="rotate(${i * 45})"/>`).join('')}</g>
  <g id="moon" transform="translate(960 ${TOPH + 50})" opacity="0"><circle r="30" fill="${C.ivory}"/><circle cx="13" cy="-8" r="26" fill="${C.obsidian}"/></g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const rayEls = ANG.map(() => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', C.ivory); p.setAttribute('stroke-width', '2'); $s('rays').appendChild(p); return p; });
const dotEls = ANG.map(() => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', '7'); c.setAttribute('fill', C.brass); $s('dots').appendChild(c); return c; });

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagA"><span class="va-label">Air near the ground</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagL"><span class="va-label">Far listener</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nEx" style="text-align:center;border-left:none;padding:6px 12px">Bending exaggerated for clarity</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const Y = h => GROUND - h;

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const g = gAt(t), night = ramp(t, tNight - 0.3, tNight + 2.2);
  const raysOn = ramp(t, beats.day.start + 0.8, beats.day.start + 1.6) * end;
  let hits = 0;
  ANG.forEach((a, i) => {
    const { pts, atL } = trace(a, g);
    rayEls[i].setAttribute('d', 'M ' + pts.map(([x, h]) => `${x.toFixed(1)} ${Y(h).toFixed(1)}`).join(' L '));
    rayEls[i].setAttribute('stroke-opacity', 0.45 * raysOn);
    if (atL !== null && atL > 0 && atL < 150) hits++;
    // A pulse travels along each ray.
    const k = Math.floor(((t * 120 + i * 37) % (pts.length * 3)) / 3);
    const [px, ph] = pts[Math.min(k, pts.length - 1)];
    dotEls[i].setAttribute('cx', px); dotEls[i].setAttribute('cy', Y(ph)); dotEls[i].setAttribute('opacity', raysOn);
  });
  $s('airD').setAttribute('opacity', 1 - night); $s('airN').setAttribute('opacity', night);
  $s('sun').setAttribute('opacity', (1 - night) * end); $s('moon').setAttribute('opacity', night * end);
  $s('hear').setAttribute('opacity', hits > 0 ? raysOn * (0.5 + 0.5 * Math.sin(t * 6)) : 0);

  const show = ramp(t, beats.day.start + 0.8, beats.day.start + 1.4) * end;
  $('tagA').style.opacity = show; $('tagL').style.opacity = show;
  $('tagA').querySelector('.val').textContent = night > 0.5 ? 'Cooler' : 'Warmer';
  $('tagA').querySelector('i').style.width = lerp(90, 20, night) + '%';
  $('tagL').querySelector('.val').textContent = hits > 0 ? 'Hears it' : 'Quiet';
  $('tagL').querySelector('i').style.width = clamp(hits / 4) * 100 + '%';
  $('nEx').style.opacity = show; $('nEx').style.left = '540px'; $('nEx').style.top = (GROUND + 60) + 'px'; $('nEx').style.transform = 'translate(-50%, -50%)';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
