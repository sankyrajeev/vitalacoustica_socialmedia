// Blinders and the eye. A two-cell blinder above, an eye below drawn to scale
// (iris 12 mm). The room darkens, the pupil opens to 8 mm, the blinders hit, and
// the pupil closes. "Light let in" is pupil area relative to a 2 mm pupil: (d / 2)².
// Drawn in SVG; every frame is a pure function of time.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const { pupil_bright_mm: PB, pupil_start_mm: PS, pupil_dark_mm: PD, iris_mm: IR } = spec.params;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

// Cue times, tied to the narration.
const tDark = wordAt(beats.dark, /^dark/), tHit = wordAt(beats.hit, /^hit/), tAgain = beats.takeaway.start + 0.4, tHit2 = wordAt(beats.takeaway, /^hit/);
const roomAt = t => {                                   // ambient light in the room, 0..1
  const a = lerp(0.55, 0, ramp(t, tDark - 0.2, tDark + 1.2));
  return lerp(a, 0, ramp(t, tAgain, tAgain + 1.0));
};
const blinderAt = t => {                                // blinder output, 0..1: a hit and a decay
  const hit = (t0, len) => t < t0 ? 0 : t < t0 + 0.08 ? (t - t0) / 0.08 : Math.exp(-(t - t0 - 0.08) / len);
  return clamp(hit(tHit, 1.6) + hit(tHit2, 1.2));
};
// The pupil follows the light it sees, with a short lag: opens slowly, closes fast.
function pupilAt(t) {
  let d = PS; const dt = 1 / 60;
  for (let s = 0; s <= t; s += dt) {
    const L = roomAt(s - 0.7) + 2.2 * blinderAt(s - 0.7);   // the pupil reacts after a short delay
    const target = lerp(PD, PB, clamp(L / 1.4) ** 0.6);
    const rate = target < d ? 2.0 : 1.3;              // per second
    d += (target - d) * (1 - Math.exp(-rate * dt));
  }
  return d;
}

// ---- Drawing ---------------------------------------------------------------
const stage = document.getElementById('stage');
const S = 36;                                           // px per mm for the eye
const EX = 540, EY = 1030, BX = 540, BY = 600;
const ns = 'http://www.w3.org/2000/svg';
stage.innerHTML = `
<div id="wash" style="position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 31%, ${C.ivory} 0%, ${C.brass} 35%, rgba(16,16,16,0) 75%);opacity:0;mix-blend-mode:screen"></div>
<div id="amb" style="position:absolute;inset:0;background:radial-gradient(90% 60% at 50% 45%, rgba(184,164,123,0.22), rgba(16,16,16,0) 70%);"></div>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <defs>
    <radialGradient id="lamp"><stop offset="0" stop-color="${C.ivory}"/><stop offset="0.55" stop-color="${C.brass}"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0"/></radialGradient>
    <clipPath id="eyeClip"><path id="lidPath" d=""/></clipPath>
  </defs>
  <!-- Blinder: a two-cell fixture on a yoke -->
  <g id="blinder" transform="translate(${BX} ${BY})">
    <path d="M -230 -150 L -230 -175 L 230 -175 L 230 -150" fill="none" stroke="${C.grey}" stroke-width="3"/>
    <rect x="-250" y="-120" width="500" height="240" rx="18" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/>
    <g id="cells"></g>
  </g>
  <!-- Eye -->
  <g transform="translate(${EX} ${EY})">
    <path id="white" d="" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    <g clip-path="url(#eyeClip)">
      <circle r="${IR / 2 * S}" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/>
      <g id="fibres"></g>
      <circle id="pupil" r="10" fill="${C.obsidian}" stroke="${C.ivory}" stroke-width="2"/>
      <circle id="glint" r="18" fill="${C.ivory}" opacity="0.85" cx="70" cy="-70"/>
    </g>
  </g>
  <g id="dims"></g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
// Two lamp cells with honeycomb rings.
const cells = $s('cells');
for (const cx of [-118, 118]) cells.insertAdjacentHTML('beforeend', `
  <circle cx="${cx}" cy="0" r="98" fill="${C.obsidian}" stroke="${C.grey}" stroke-width="2"/>
  <circle class="glow" cx="${cx}" cy="0" r="170" fill="url(#lamp)" opacity="0"/>
  <circle class="lamp" cx="${cx}" cy="0" r="80" fill="${C.ivory}" opacity="0.08"/>
  ${[30, 55, 78].map(r => `<circle cx="${cx}" cy="0" r="${r}" fill="none" stroke="${C.grey}" stroke-width="1.5" opacity="0.6"/>`).join('')}`);
// Eye outline (almond) and iris fibres.
const EW = 300, EH = 175;
const lid = `M ${-EW} 0 Q 0 ${-EH * 1.55} ${EW} 0 Q 0 ${EH * 1.55} ${-EW} 0 Z`;
$s('white').setAttribute('d', lid); $s('lidPath').setAttribute('d', lid);
const fib = $s('fibres');
for (let i = 0; i < 72; i++) {
  const a = i / 72 * Math.PI * 2, r0 = 1.4 * S, r1 = (IR / 2 - 0.3) * S;
  fib.insertAdjacentHTML('beforeend', `<line x1="${Math.cos(a) * r0}" y1="${Math.sin(a) * r0}" x2="${Math.cos(a) * r1}" y2="${Math.sin(a) * r1}" stroke="${C.brass}" stroke-width="1.4" opacity="${0.35 + 0.3 * ((i * 7) % 3) / 2}"/>`);
}

// ---- Labels --------------------------------------------------------------
const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagP"><span class="va-label">Pupil</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagL"><span class="va-label">Light let in</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nRoom"></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);

// Pupil sizes are expensive to integrate per frame from zero; cache by frame.
const cache = new Map();
const pupil = t => { const k = Math.round(t * 60); if (!cache.has(k)) cache.set(k, pupilAt(k / 60)); return cache.get(k); };

function renderFrame(t) {
  const room = roomAt(t), bl = blinderAt(t), d = pupil(t);
  $s('amb').style.opacity = clamp(room / 0.55);
  $s('wash').style.opacity = 0.85 * bl;
  stage.querySelectorAll('.glow').forEach(g => g.setAttribute('opacity', bl));
  stage.querySelectorAll('.lamp').forEach(g => g.setAttribute('opacity', 0.08 + 0.92 * bl));
  $s('pupil').setAttribute('r', d / 2 * S);
  $s('glint').setAttribute('opacity', 0.25 + 0.6 * clamp(room / 0.55 + bl));

  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const show = ramp(t, beats.dark.start + 0.2, beats.dark.start + 0.8) * end;
  $('tagP').style.opacity = show; $('tagL').style.opacity = show;
  $('tagP').querySelector('.val').textContent = d.toFixed(1) + ' mm';
  $('tagP').querySelector('i').style.width = clamp(d / PD) * 100 + '%';
  const area = (d / PB) ** 2;
  $('tagL').querySelector('.val').textContent = '×' + (area < 9.95 ? area.toFixed(1) : Math.round(area));
  $('tagL').querySelector('i').style.width = clamp(area / 16) * 100 + '%';
  $('nRoom').innerHTML = `<b>Room</b><br>${bl > 0.15 ? 'Blinders hit' : room > 0.3 ? 'Lit' : 'Dark'}`;
  $('nRoom').style.opacity = show; $('nRoom').style.left = '84px'; $('nRoom').style.top = '1290px';
  frame.update(t);
}

await frame.ready();
for (let k = 0; k <= Math.ceil(post.timeline.duration * 60); k += 1) { /* warm cache lazily */ }
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
