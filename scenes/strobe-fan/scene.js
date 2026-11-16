// Stroboscopic effect. A three-blade fan turns at a fixed rate. Under steady light it
// blurs; under a strobe, each flash shows the fan where it is at that instant, and the
// picture fades until the next flash. Flash rates stay under 3 per second throughout,
// and only the fan area lights, to keep the video safe for photosensitive viewers.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const TURNS = spec.params.turns_per_s;
const theta = t => 360 * TURNS * t;                                 // degrees

// Modes: steady light, then strobe at three rates.
const tStrobe = beats.flash.start + 0.4;
const tMatch = wordAt(beats.match, /^flash/), tRev = wordAt(beats.takeaway, /^flash/);
const MODES = [
  { t: tStrobe, f: 1.92 },                                         // not matched: a string of different stills
  { t: tMatch, f: spec.params.flashes_per_s_freeze },              // matched: frozen
  { t: tRev, f: spec.params.flashes_per_s_reverse },               // slightly faster: creeps backwards
];
function lastFlash(t) {
  let m = null; for (const x of MODES) if (t >= x.t) m = x;
  if (!m) return null;
  const k = Math.floor((t - m.t) * m.f);
  return { tf: m.t + k / m.f, f: m.f };
}

const CX = 540, CY = 910, R = 290;
const blade = `M 0 -36 C 70 -60 150 -140 250 -120 C 300 -110 300 -40 250 -20 C 160 10 70 10 0 36 Z`;
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <defs><radialGradient id="pool"><stop offset="0" stop-color="${C.ivory}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.ivory}" stop-opacity="0"/></radialGradient></defs>
  <!-- Strobe fixture above the fan -->
  <g transform="translate(540 500)"><rect x="-120" y="-30" width="240" height="60" rx="10" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="3"/>
    <rect id="lamp" x="-100" y="-16" width="200" height="32" rx="6" fill="${C.ivory}" opacity="0.08"/></g>
  <circle id="poolC" cx="${CX}" cy="${CY}" r="${R + 80}" fill="url(#pool)" opacity="0"/>
  <circle cx="${CX}" cy="${CY}" r="${R + 20}" fill="none" stroke="${C.grey}" stroke-opacity="0.35" stroke-width="3"/>
  <g id="ghosts"></g>
  <g id="fan"></g>
  <circle cx="${CX}" cy="${CY}" r="42" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="3"/>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const fanSVG = (op) => [0, 120, 240].map((a, i) => `<path d="${blade}" transform="rotate(${a - 90})" fill="${i === 0 ? C.brass : C.ivory}" fill-opacity="${op}" stroke="${C.ivory}" stroke-opacity="${Math.min(1, op * 1.4)}" stroke-width="2"/>`).join('');
for (let k = 0; k < 7; k++) $s('ghosts').insertAdjacentHTML('beforeend', `<g class="gh">${fanSVG(1)}</g>`);
$s('fan').innerHTML = fanSVG(1);
const ghosts = [...stage.querySelectorAll('.gh')];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagF"><span class="va-label">Fan</span><span class="val">${TURNS} turns/s</span><div class="bar"><i style="width:${TURNS / 2 * 100}%"></i></div></div>
  <div class="va-tag right" id="tagS"><span class="va-label">Light</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nMode" style="text-align:center;border-left:none;padding:8px 16px"></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const lf = lastFlash(t);
  if (!lf) {
    // Steady light: the fan blurs. Ghost copies trail behind the current angle.
    const a = theta(t);
    $s('fan').setAttribute('transform', `translate(${CX} ${CY}) rotate(${a})`); $s('fan').setAttribute('opacity', 0.55);
    ghosts.forEach((g, k) => { g.setAttribute('transform', `translate(${CX} ${CY}) rotate(${a - (k + 1) * 6})`); g.setAttribute('opacity', 0.32 * (1 - k / 7)); });
    $s('lamp').setAttribute('opacity', 0.55); $s('poolC').setAttribute('opacity', 1);
  } else {
    // Strobe: the fan as it was at the last flash, fading until the next one.
    const b = Math.exp(-(t - lf.tf) / 0.11);
    $s('fan').setAttribute('transform', `translate(${CX} ${CY}) rotate(${theta(lf.tf)})`);
    $s('fan').setAttribute('opacity', (0.12 + 0.88 * b) * end + (1 - end) * 0.1);
    ghosts.forEach(g => g.setAttribute('opacity', 0));
    $s('lamp').setAttribute('opacity', 0.08 + 0.8 * b); $s('poolC').setAttribute('opacity', b * 0.9);
  }
  const show = ramp(t, beats.flash.start, beats.flash.start + 0.5) * end;
  $('tagF').style.opacity = show; $('tagS').style.opacity = show;
  $('tagS').querySelector('.val').textContent = lf ? lf.f.toFixed(lf.f % 1 === 0 ? 0 : (Math.round(lf.f * 10) === lf.f * 10 ? 1 : 2)) + ' flashes/s' : 'Steady';
  $('tagS').querySelector('i').style.width = (lf ? lf.f / 3 : 1) * 100 + '%';
  let txt = '';
  if (!lf) txt = 'Steady light: a blur';
  else if (lf.f === MODES[0].f) txt = 'Each flash, a different still';
  else if (lf.f === MODES[1].f) txt = 'One flash per turn: frozen';
  else txt = 'Slightly faster: turns backwards';
  $('nMode').innerHTML = `<b>${txt}</b>`;
  $('nMode').style.opacity = ramp(t, beats.flash.start, beats.flash.start + 0.5) * end;
  $('nMode').style.left = '540px'; $('nMode').style.top = (CY + R + 90) + 'px'; $('nMode').style.transform = 'translate(-50%, -50%)';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
