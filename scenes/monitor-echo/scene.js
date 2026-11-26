// Why stages need monitors, seen from above. The main speaker at the stage front fires into
// the room; the first strong sound to come back to a singer behind it is the reflection off
// the back wall (drawn with the image-source method). Arrival times are path length ÷ c. A
// wedge 1.5 m in front of the singer is compared. Sound is shown 40× slower than real.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const P = spec.params, c = P.speed_of_sound;
const PA = 4, SING = PA - P.performer_behind_pa_m, WALL = PA + P.room_m, WEDGE = SING + P.wedge_m;
const ECHO = (WALL - PA + WALL - SING) / c, WDG = P.wedge_m / c;   // seconds
const SLOW = 40;

const S = 25, X0 = 115, YC = 780, HW = 7;                          // 1 m = 25 px; room ±7 m
const sx = x => X0 + x * S, sy = y => YC + y * S;
const tPulse = wordAt(beats.echo, /^late/i) - ECHO * SLOW;   // the echo lands on "late"
const tWedge = wordAt(beats.wedge, /^sends/i);

const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <defs><clipPath id="room"><rect x="${sx(0)}" y="${sy(-HW)}" width="${WALL * S}" height="${2 * HW * S}"/></clipPath></defs>
 <g id="all">
  <rect x="${sx(0)}" y="${sy(-HW)}" width="${WALL * S}" height="${2 * HW * S}" fill="none" stroke="${C.grey}" stroke-width="2"/>
  <rect x="${sx(0)}" y="${sy(-HW)}" width="${PA * S}" height="${2 * HW * S}" fill="${C.charcoal}"/>
  <line x1="${sx(WALL)}" y1="${sy(-HW)}" x2="${sx(WALL)}" y2="${sy(HW)}" stroke="${C.ivory}" stroke-width="6"/>
  <g clip-path="url(#room)">
   <path id="fwd" fill="none" stroke="${C.brass}" stroke-width="5"/>
   <path id="back" fill="none" stroke="${C.brass}" stroke-width="2" stroke-opacity="0.35"/>
   <path id="refl" fill="none" stroke="${C.ivory}" stroke-width="4" stroke-dasharray="12 8"/>
   <path id="wdg" fill="none" stroke="${C.ivory}" stroke-width="4"/>
  </g>
  <g transform="translate(${sx(PA)} ${sy(0)})"><rect x="-12" y="-34" width="24" height="68" rx="4" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/></g>
  <g id="wedgeG" transform="translate(${sx(WEDGE)} ${sy(0)})"><path d="M 12 -16 L -8 -12 L -8 12 L 12 16 Z" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/></g>
  <g transform="translate(${sx(SING)} ${sy(0)})"><circle id="ring" r="26" fill="none" stroke="${C.ivory}" stroke-width="3"/><circle r="15" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/></g>
  <!-- arrival timeline at the singer -->
  <line x1="140" y1="1250" x2="940" y2="1250" stroke="${C.grey}" stroke-width="2"/>
  ${[0, 50, 100, 150, 200].map(ms => `<line x1="${140 + ms * 3.6}" y1="1242" x2="${140 + ms * 3.6}" y2="1258" stroke="${C.grey}" stroke-width="2"/>`).join('')}
  <circle id="mW" cx="${140 + WDG * 1000 * 3.6}" cy="1250" r="11" fill="${C.ivory}"/>
  <circle id="mE" cx="${140 + ECHO * 1000 * 3.6}" cy="1250" r="11" fill="${C.brass}"/>
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const arc = (cx, r, a0, a1) => { r = Math.max(0.01, r); const p = a => `${sx(cx + r * Math.cos(a)).toFixed(1)} ${sy(r * Math.sin(a)).toFixed(1)}`; return `M ${p(a0)} A ${r * S} ${r * S} 0 0 1 ${p(a1)}`; };

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagE"><span class="va-label">Main speakers reach you</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagW"><span class="va-label">Monitor reaches you</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nStage" style="text-align:center;border-left:none;padding:6px 10px">Stage</div>
  <div class="va-note va-label" id="nWall" style="text-align:center;border-left:none;padding:6px 10px">Back wall, 30 m</div>
  <div class="va-note va-label" id="nYou" style="text-align:center;border-left:none;padding:6px 10px">Singer</div>
  <div class="va-note va-label" id="nPA" style="text-align:center;border-left:none;padding:6px 10px">Main speaker</div>
  <div class="va-note va-label" id="nT" style="text-align:center;border-left:none;padding:6px 10px">When each sound reaches the singer · 0 to 200 ms</div>
  <div class="va-note va-label" id="nSlow" style="text-align:center;border-left:none;padding:6px 10px">Sound shown 40 times slower</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  // One pulse from the main speaker, in slow motion.
  const tp = (t - tPulse) / SLOW, r = tp * c;                  // real seconds, metres travelled
  const on = tp > 0 ? 1 : 0;
  $s('fwd').setAttribute('d', on ? arc(PA, r, -Math.PI / 2.2, Math.PI / 2.2) : '');
  $s('back').setAttribute('d', on ? arc(PA, r, Math.PI / 2.2, Math.PI * 2 - Math.PI / 2.2) : '');
  const rr = r - (WALL - PA);                                  // reflected front, from the image source beyond the wall
  $s('refl').setAttribute('d', rr > 0 ? arc(2 * WALL - PA, r, Math.PI - 0.9, Math.PI + 0.9).replace(/A ([\d.]+) ([\d.]+) 0 0 1/, 'A $1 $2 0 0 1') : '');
  $s('fwd').setAttribute('opacity', on && rr < 0 ? 1 : 0.25); $s('back').setAttribute('opacity', rr < 0 ? 1 : 0.3);
  const echoHit = clamp(1 - Math.abs(tp - ECHO) * SLOW * 2);
  // Wedge pulse.
  const tw = (t - tWedge) / SLOW, rw = tw * c;
  $s('wdg').setAttribute('d', tw > 0 && rw < 4 ? arc(WEDGE, rw, Math.PI / 2 + 0.5, Math.PI * 1.5 - 0.5) : '');
  $s('wedgeG').setAttribute('opacity', ramp(t, beats.wedge.start, beats.wedge.start + 0.5));
  const wHit = tw > WDG ? clamp(1 - (tw - WDG) * SLOW * 0.8) : 0;
  $s('ring').setAttribute('stroke', echoHit > wHit ? C.brass : C.ivory); $s('ring').setAttribute('r', 26 + 10 * Math.max(echoHit, wHit));
  $s('ring').setAttribute('opacity', Math.max(echoHit, wHit));
  const eOn = ramp(t, beats.echo.start, beats.echo.start + 0.5), wOn = ramp(t, beats.wedge.start, beats.wedge.start + 0.5);
  $s('mE').setAttribute('opacity', eOn); $s('mW').setAttribute('opacity', wOn);

  const show = ramp(t, beats.away.start, beats.away.start + 0.6) * end;
  $('tagE').style.opacity = eOn * end; $('tagW').style.opacity = wOn * end;
  $('tagE').querySelector('.val').textContent = `${Math.round(ECHO * 1000)} ms late`; $('tagE').querySelector('i').style.width = clamp(ECHO / 0.2) * 100 + '%';
  $('tagW').querySelector('.val').textContent = `${Math.round(WDG * 1000)} ms`; $('tagW').querySelector('i').style.width = clamp(WDG / 0.2) * 100 + '%';
  at($('nStage'), sx(PA / 2), sy(-HW) - 24); at($('nWall'), sx(WALL) - 60, sy(-HW) - 24); at($('nYou'), sx(SING) + 6, sy(0) + 52);
  at($('nPA'), sx(PA) + 20, sy(0) - 58); at($('nT'), 540, 1210); at($('nSlow'), 540, sy(HW) + 28);
  for (const id of ['nStage', 'nWall', 'nYou', 'nPA', 'nSlow']) $(id).style.opacity = show;
  $('nT').style.opacity = eOn * end;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
