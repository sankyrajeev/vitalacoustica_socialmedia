// Delay speakers. Stage at 0 m, delay speaker at 40 m, listener at 45 m, all on one line.
// Wavefronts are drawn at radius c·(τ − emit time), in slow motion. Arrival times at the
// listener are computed from distance / c, and the delay is stage→tower distance / c.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const { speed_of_sound: CS, tower_m: DT, listener_m: DL } = spec.params;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

const S = [300, 505], Lp = [780, 1120];
const PXM = Math.hypot(Lp[0] - S[0], Lp[1] - S[1]) / DL;
const along = m => [S[0] + (Lp[0] - S[0]) * m / DL, S[1] + (Lp[1] - S[1]) * m / DL];
const T = along(DT);
const DELAY = DT / CS * 1000;                                     // ms
const arrStage = DL / CS * 1000, arrTowerRaw = (DL - DT) / CS * 1000;

const tTower = wordAt(beats.echo, /^delay/), tHold = wordAt(beats.fix, /^hold/), t0 = beats.slow.start + 0.3;
const CYCLE = 4.2, MS_PER_S = 40;                                 // 4.2 s of video = 168 ms of sound
const delayAt = t => DELAY * ramp(t, tHold - 0.2, tHold + 1.2);

const stage = document.getElementById('stage');
const SX0 = 120, SX1 = 960, SY = 1268, MSMAX = 175, sx = ms => SX0 + (SX1 - SX0) * ms / MSMAX;
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <defs><clipPath id="area"><rect x="0" y="430" width="1080" height="770"/></clipPath></defs>
  <g clip-path="url(#area)"><g id="ringsS"></g><g id="ringsT"></g></g>
  <line x1="${S[0]}" y1="${S[1]}" x2="${Lp[0]}" y2="${Lp[1]}" stroke="${C.grey}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="6 10"/>
  <g id="dim" opacity="0">
    <line x1="${S[0] - 60}" y1="${S[1] + 42}" x2="${T[0] - 60}" y2="${T[1] + 42}" stroke="${C.brass}" stroke-width="2"/>
    <line x1="${S[0] - 72}" y1="${S[1] + 51}" x2="${S[0] - 48}" y2="${S[1] + 33}" stroke="${C.brass}" stroke-width="2"/>
    <line x1="${T[0] - 72}" y1="${T[1] + 51}" x2="${T[0] - 48}" y2="${T[1] + 33}" stroke="${C.brass}" stroke-width="2"/>
  </g>
  <!-- Stage speaker -->
  <g transform="translate(${S[0]} ${S[1]})"><rect x="-50" y="-60" width="100" height="120" rx="8" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/>
    <circle cy="16" r="30" fill="none" stroke="${C.brass}" stroke-width="3"/><circle cy="-34" r="11" fill="none" stroke="${C.brass}" stroke-width="3"/></g>
  <!-- Delay tower -->
  <g id="tower" opacity="0" transform="translate(${T[0]} ${T[1]})"><line x1="0" y1="20" x2="0" y2="70" stroke="${C.grey}" stroke-width="5"/>
    <rect x="-34" y="-44" width="68" height="70" rx="6" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/><circle cy="-8" r="18" fill="none" stroke="${C.ivory}" stroke-width="3"/></g>
  <!-- Listener -->
  <g transform="translate(${Lp[0]} ${Lp[1]})"><circle cy="-50" r="15" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    <path d="M -10 -32 L -22 -24 L -24 14 L -14 14 L -12 -8 L -10 40 L 10 40 L 12 -8 L 14 14 L 24 14 L 22 -24 L 10 -32 Z" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="2.5" stroke-linejoin="round"/></g>
  <!-- Arrival strip at the listener -->
  <g id="strip" opacity="0">
    <line x1="${SX0}" y1="${SY}" x2="${SX1}" y2="${SY}" stroke="${C.grey}" stroke-width="2"/>
    ${[0, 50, 100, 150].map(m => `<line x1="${sx(m)}" y1="${SY - 8}" x2="${sx(m)}" y2="${SY + 8}" stroke="${C.grey}" stroke-width="2"/><text x="${sx(m)}" y="${SY + 36}" fill="${C.grey}" font-family="Manrope" font-weight="600" font-size="19" letter-spacing="2" text-anchor="middle">${m} MS</text>`).join('')}
    <line id="head" y1="${SY - 26}" y2="${SY + 14}" stroke="${C.ivory}" stroke-width="2" stroke-opacity="0.5"/>
    <circle id="aS" cy="${SY}" r="12" fill="${C.brass}"/>
    <circle id="aT" cy="${SY}" r="12" fill="${C.obsidian}" stroke="${C.ivory}" stroke-width="3.5"/>
  </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
for (const g of ['ringsS', 'ringsT']) for (let i = 0; i < 4; i++) $s(g).insertAdjacentHTML('beforeend', `<circle class="r" fill="none" stroke-width="${g === 'ringsS' ? 4 : 3}" stroke="${g === 'ringsS' ? C.brass : C.ivory}"/>`);
const rS = [...$s('ringsS').children], rT = [...$s('ringsT').children];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagD"><span class="va-label">Stage to delay speaker</span><span class="val">${DT} m</span><div class="bar"><i style="width:${DT / DL * 100}%"></i></div></div>
  <div class="va-tag right" id="tagT"><span class="va-label">Delay setting</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nDim"><b>${DT} m</b><br>${Math.round(DELAY)} ms for sound</div>
  <div class="va-note va-label" id="nStage"><b>Stage</b></div>
  <div class="va-note va-label" id="nTower"><b>Delay speaker</b></div>
  <div class="va-note va-label" id="nYou"><b>You</b> · ${DL} m</div>
  <div class="va-note va-label" id="nStrip" style="text-align:center;border-left:none;padding:8px 16px"></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(0, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const run = t >= t0;
  // Several pulses in flight: pulse k was emitted at cycle start k.
  const tau = run ? ((t - t0) % CYCLE) * MS_PER_S : -1;           // ms since this cycle's kick
  const towerOn = ramp(t, tTower - 0.3, tTower + 0.3) * end;
  const d = delayAt(t);
  const draw = (els, cx, cy, emit, maxR, on) => els.forEach((el, i) => {
    const age = tau - emit - i * 9;                                 // a short train of fronts per kick
    const r = age * CS / 1000 * PXM;
    el.setAttribute('cx', cx); el.setAttribute('cy', cy); el.setAttribute('r', Math.max(r, 0));
    el.setAttribute('stroke-opacity', age > 0 && r < maxR ? on * (1 - i * 0.22) * (1 - r / maxR) * 0.9 : 0);
  });
  draw(rS, S[0], S[1], 0, 1200, ramp(t, t0, t0 + 0.4) * end);
  draw(rT, T[0], T[1], d, 260, towerOn);

  $s('tower').setAttribute('opacity', towerOn);
  $s('dim').setAttribute('opacity', ramp(t, wordAt(beats.slow, /^forty/) - 0.3, wordAt(beats.slow, /^forty/) + 0.3) * end);
  const stripA = ramp(t, tTower + 0.6, tTower + 1.2) * end;
  $s('strip').setAttribute('opacity', stripA);
  const aT = d + arrTowerRaw;
  $s('aS').setAttribute('cx', sx(arrStage)); $s('aT').setAttribute('cx', sx(aT));
  $s('aS').setAttribute('opacity', tau >= arrStage ? 1 : 0.25); $s('aT').setAttribute('opacity', tau >= aT ? 1 : 0.25);
  $s('head').setAttribute('x1', sx(clamp(tau, 0, MSMAX))); $s('head').setAttribute('x2', sx(clamp(tau, 0, MSMAX)));

  const show = ramp(t, beats.slow.start + 0.3, beats.slow.start + 0.9) * end;
  $('tagD').style.opacity = show; $('tagT').style.opacity = towerOn;
  $('tagT').querySelector('.val').textContent = Math.round(d) + ' ms'; $('tagT').querySelector('i').style.width = d / DELAY * 100 + '%';
  $('nDim').style.opacity = Number($s('dim').getAttribute('opacity')) * (1 - towerOn * 0.0); at($('nDim'), (S[0] + T[0]) / 2 - 70, (S[1] + T[1]) / 2 + 42, 'translate(-100%, -50%)');
  $('nDim').style.borderLeft = 'none'; $('nDim').style.borderRight = '2px solid var(--va-brass)'; $('nDim').style.textAlign = 'right';
  $('nStage').style.opacity = show; at($('nStage'), S[0] + 70, S[1]);
  $('nTower').style.opacity = towerOn; at($('nTower'), T[0] + 56, T[1] - 14);
  $('nYou').style.opacity = show; at($('nYou'), Lp[0] + 46, Lp[1] - 4);
  const gap = Math.abs(aT - arrStage);
  $('nStrip').innerHTML = gap > 3 ? `<b>${Math.round(gap)} ms apart</b><br>Heard twice, like an echo` : `<b>Together</b><br>Both arrive at ${Math.round(arrStage)} ms`;
  $('nStrip').style.opacity = stripA; at($('nStrip'), 400, SY - 62, 'translate(-50%, -50%)');
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
