// Reverberation, empty vs full. Reverberation time from Sabine: RT60 = 0.161·V / A, where A
// is the total absorption (surface area × absorption coefficient, plus about half a square
// metre per person). One sound ray bounces round the hall (exact mirror reflections); its
// trail fades at the rate set by RT60, and the decay graph plots level against time.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const P = spec.params, [RL, RW, RH] = P.room_m, V = RL * RW * RH;
const A0 = RL * RW * P.alpha_floor + RL * RW * P.alpha_ceiling + 2 * (RL + RW) * RH * P.alpha_walls;
const RT = n => 0.161 * V / (A0 + n * P.absorption_per_person_m2);
const RT0 = RT(0), RT1 = RT(P.people);

const tFill = wordAt(beats.fill, /^people/i);
const guests = t => Math.round(P.people * ramp(t, tFill - 0.4, tFill + 1.6));
const CLAP = 3.4, T0 = beats.empty.start + 0.3;
const tau = t => t < T0 ? -1 : (t - T0) % CLAP;

const S = 40, X0 = 140, Y0 = 560;                      // section: 20 m × 6 m
const sx = x => X0 + x * S, sy = y => Y0 + (RH - y) * S;
// Billiard path of one ray in the section, sampled every 0.01 s of travel.
const c = 343, DT = 0.01, PTS = [];
{ let x = 3, y = 2.2, vx = Math.cos(0.41), vy = Math.sin(0.41);
  for (let i = 0; i <= 300; i++) { PTS.push([x, y]); let s = c * DT;
    while (s > 0) { const tx = vx > 0 ? (RL - x) / vx : vx < 0 ? -x / vx : Infinity, ty = vy > 0 ? (RH - y) / vy : vy < 0 ? -y / vy : Infinity, m = Math.min(tx, ty, s);
      x += vx * m; y += vy * m; s -= m; if (m === tx) vx = -vx; if (m === ty) vy = -vy; } } }

const G = { x0: 160, x1: 940, y0: 1000, y1: 1330, T: 3, D: 70 };
const gx = t => lerp(G.x0, G.x1, t / G.T), gy = d => lerp(G.y0, G.y1, -d / G.D);
const NPPL = 60;
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  <rect x="${sx(0)}" y="${sy(RH)}" width="${RL * S}" height="${RH * S}" fill="none" stroke="${C.ivory}" stroke-width="4"/>
  <g id="ppl">${Array.from({ length: NPPL }, (_, i) => { const x = 1 + (i % 30) * (18 / 29) + (Math.floor(i / 30) ? 0.3 : 0); const h = i % 3 === 0 ? 1.75 : i % 3 === 1 ? 1.62 : 1.7; return `<g class="p" transform="translate(${sx(x)} ${sy(0)})"><rect x="-6" y="${-(h - 0.25) * S}" width="12" height="${(h - 0.25) * S}" rx="5" fill="${C.grey}" fill-opacity="0.75"/><circle cy="${-(h - 0.12) * S}" r="5.5" fill="${C.grey}"/></g>`; }).join('')}</g>
  <g id="ray"></g>
  <rect x="${sx(1.2) - 14}" y="${sy(2.2) - 22}" width="28" height="44" rx="5" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/>
  <line x1="${G.x0}" y1="${G.y0}" x2="${G.x0}" y2="${G.y1}" stroke="${C.grey}" stroke-width="2"/>
  <line x1="${G.x0}" y1="${G.y1}" x2="${G.x1}" y2="${G.y1}" stroke="${C.grey}" stroke-width="2"/>
  <line x1="${G.x0}" y1="${gy(-60)}" x2="${G.x1}" y2="${gy(-60)}" stroke="${C.grey}" stroke-width="2" stroke-dasharray="6 8" stroke-opacity="0.7"/>
  <line id="emptyL" x1="${gx(0)}" y1="${gy(0)}" x2="${gx(Math.min(G.T, RT0 * 70 / 60))}" y2="${gy(-Math.min(70, 60 * G.T / RT0))}" stroke="${C.grey}" stroke-width="3" stroke-dasharray="10 8"/>
  <line id="curL" stroke="${C.brass}" stroke-width="5" stroke-linecap="round"/>
  <circle id="dot" r="9" fill="${C.ivory}"/>
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const ppl = [...stage.querySelectorAll('.p')];
for (let i = 0; i < PTS.length - 1; i++) $s('ray').insertAdjacentHTML('beforeend', `<line x1="${sx(PTS[i][0]).toFixed(1)}" y1="${sy(PTS[i][1]).toFixed(1)}" x2="${sx(PTS[i + 1][0]).toFixed(1)}" y2="${sy(PTS[i + 1][1]).toFixed(1)}" stroke="${C.brass}" stroke-width="3" stroke-linecap="round"/>`);
const seg = [...$s('ray').children];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagG"><span class="va-label">Guests</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagR"><span class="va-label">Echo fades in</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nHall" style="text-align:center;border-left:none;padding:6px 10px">Example hall, 20 × 15 × 6 m, side view</div>
  <div class="va-note va-label" id="nG" style="text-align:center;border-left:none;padding:6px 10px">One sound, fading after it is made</div>
  <div class="va-note va-label" id="n60" style="text-align:center;border-left:none;padding:6px 10px">60 dB quieter</div>
  <div class="va-note va-label" id="nE" style="text-align:center;border-left:none;padding:6px 10px">Empty</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  const n = guests(t), rt = RT(n), tt = tau(t);
  const shown = Math.round(NPPL * n / P.people);
  ppl.forEach((p, i) => p.setAttribute('opacity', i < shown ? 1 : 0));
  seg.forEach((s, i) => {
    const ti = i * DT, lvl = -60 * ti / rt;                // dB below the start
    s.setAttribute('opacity', tt >= ti ? clamp(10 ** (lvl / 40)) * clamp((tt - ti) * 20) : 0);
  });
  const tc = clamp(tt, 0, G.T), dc = Math.max(-G.D, -60 * tc / rt);
  const te = Math.min(tc, rt * G.D / 60);
  $s('curL').setAttribute('x1', gx(0)); $s('curL').setAttribute('y1', gy(0)); $s('curL').setAttribute('x2', gx(te)); $s('curL').setAttribute('y2', gy(-60 * te / rt));
  $s('dot').setAttribute('cx', gx(te)); $s('dot').setAttribute('cy', gy(-60 * te / rt)); $s('dot').setAttribute('opacity', tt >= 0 ? 1 : 0);
  $s('curL').setAttribute('opacity', tt >= 0 ? 1 : 0);
  $s('emptyL').setAttribute('opacity', ramp(t, tFill, tFill + 0.6));
  const show = ramp(t, beats.empty.start, beats.empty.start + 0.6) * end;
  $('tagG').style.opacity = show; $('tagR').style.opacity = show;
  $('tagG').querySelector('.val').textContent = String(n); $('tagG').querySelector('i').style.width = n / P.people * 100 + '%';
  $('tagR').querySelector('.val').textContent = rt.toFixed(1) + ' s'; $('tagR').querySelector('i').style.width = clamp(rt / 3) * 100 + '%';
  at($('nHall'), 540, sy(RH) - 28); at($('nG'), 540, G.y0 - 34); at($('n60'), G.x0 + 100, gy(-60) + 22);
  at($('nE'), gx(RT0 * 0.55), gy(-33) - 30);
  for (const id of ['nHall', 'nG', 'n60']) $(id).style.opacity = show;
  $('nE').style.opacity = ramp(t, tFill, tFill + 0.6) * end;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
