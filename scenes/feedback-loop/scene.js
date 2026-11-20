// Feedback as a loop. A pulse goes mic → desk → speaker → through the air → mic, once per
// lap. Each lap its level is multiplied by the loop gain G: above 1 it builds into a howl
// (shown capped, as a real system clips), below 1 it dies away. Moving and turning the mic
// lowers G. The bars show the level on each lap.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const G1 = spec.params.gain_close, G2 = spec.params.gain_far, CAP = 6, LAP = 1.1;

const t0 = beats.loop.start + 0.6, tFix = wordAt(beats.fix, /^move/), tReset = beats.takeaway.start + 0.3;
const moveA = t => ramp(t, tFix, tFix + 1.6);
const gainAt = t => lerp(G1, G2, moveA(t));
// Level per lap, iterated from the start (deterministic for any t).
function lapLevels(t) {
  const out = []; let A = 1;
  for (let k = 0; t0 + k * LAP <= t; k++) {
    const ts = t0 + k * LAP;
    if (k > 0) A = Math.min(CAP, A * gainAt(ts));
    if (ts >= tReset && t0 + (k - 1) * LAP < tReset) A = 1;          // a fresh sound after the fix
    out.push({ ts, A });
  }
  return out;
}

const MIC0 = [250, 900], MIC1 = [140, 900], DESK = [540, 640], SPK = [860, 880];
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <path id="wire1" fill="none" stroke="${C.grey}" stroke-width="4"/>
  <path id="wire2" d="M ${DESK[0]} ${DESK[1]} L ${SPK[0]} ${SPK[1] - 70}" fill="none" stroke="${C.grey}" stroke-width="4"/>
  <path id="air" fill="none" stroke="${C.brass}" stroke-width="3" stroke-dasharray="10 12"/>
  <!-- Desk -->
  <g transform="translate(${DESK[0] - 90} ${DESK[1] - 55})"><rect width="180" height="110" rx="12" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    ${[0, 1, 2, 3].map(i => `<line x1="${40 + i * 33}" y1="22" x2="${40 + i * 33}" y2="88" stroke="${C.grey}" stroke-width="3"/><rect x="${30 + i * 33}" y="${34 + (i * 17) % 40}" width="20" height="10" rx="2" fill="${C.ivory}"/>`).join('')}</g>
  <!-- Speaker -->
  <g transform="translate(${SPK[0] - 60} ${SPK[1] - 90})"><rect width="120" height="180" rx="10" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/><circle cx="60" cy="115" r="40" fill="none" stroke="${C.brass}" stroke-width="3"/><circle cx="60" cy="45" r="16" fill="none" stroke="${C.brass}" stroke-width="3"/></g>
  <!-- Mic on a stand -->
  <g id="mic"><line x1="0" y1="20" x2="0" y2="150" stroke="${C.grey}" stroke-width="5"/><g id="micHead"><rect x="-14" y="-6" width="28" height="70" rx="10" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3" transform="rotate(-70)"/><circle r="24" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/></g></g>
  <circle id="pulse" r="12" fill="${C.ivory}"/>
  <circle id="glow" r="40" fill="${C.brass}" opacity="0"/>
  <!-- Level per lap -->
  <g id="chart" opacity="0"><line x1="120" y1="1300" x2="960" y2="1300" stroke="${C.grey}" stroke-width="2"/><line x1="120" y1="${1300 - 170 / CAP}" x2="960" y2="${1300 - 170 / CAP}" stroke="${C.grey}" stroke-opacity="0.5" stroke-dasharray="6 8" stroke-width="2"/><g id="bars"></g></g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const NB = 16;
for (let i = 0; i < NB; i++) $s('bars').insertAdjacentHTML('beforeend', `<rect class="b" width="34" rx="4" fill="${C.brass}"/>`);
const bars = [...stage.querySelectorAll('.b')];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagG"><span class="va-label">Comes back each trip</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagL"><span class="va-label">Level</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nMic"><b>Mic</b></div><div class="va-note va-label" id="nDesk"><b>Desk</b></div><div class="va-note va-label" id="nSpk"><b>Speaker</b></div>
  <div class="va-note va-label" id="nAir" style="text-align:center;border-left:none;padding:6px 10px">Back through the air</div>
  <div class="va-note va-label" id="nChart">Level on each trip round · dashed line = where it started</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const m = moveA(t), mx = lerp(MIC0[0], MIC1[0], m), my = MIC0[1];
  $s('mic').setAttribute('transform', `translate(${mx} ${my})`);
  $s('micHead').setAttribute('transform', `rotate(${lerp(0, 180, m)})`);
  $s('wire1').setAttribute('d', `M ${mx} ${my + 150} C ${mx} ${DESK[1] + 300} ${DESK[0] - 200} ${DESK[1]} ${DESK[0] - 90} ${DESK[1]}`);
  const airD = `M ${SPK[0] - 60} ${SPK[1] + 30} Q ${(SPK[0] + mx) / 2} ${SPK[1] + 220} ${mx + 24} ${my + 10}`;
  $s('air').setAttribute('d', airD);
  // Pulse position around the loop.
  const levels = lapLevels(t), cur = levels[levels.length - 1];
  const on = t >= t0 ? ramp(t, t0, t0 + 0.3) * end : 0;
  const ph = cur ? (t - cur.ts) / LAP : 0;
  const pathPts = [[mx, my], [DESK[0] - 90, DESK[1]], [DESK[0], DESK[1]], [SPK[0], SPK[1] - 70], [SPK[0] - 60, SPK[1] + 30], [(SPK[0] + mx) / 2, SPK[1] + 140], [mx + 24, my + 10]];
  const seg = ph * (pathPts.length - 1), i = Math.min(pathPts.length - 2, Math.floor(seg)), f = seg - i;
  const px = lerp(pathPts[i][0], pathPts[i + 1][0], f), py = lerp(pathPts[i][1], pathPts[i + 1][1], f);
  const A = cur ? cur.A : 0;
  $s('pulse').setAttribute('cx', px); $s('pulse').setAttribute('cy', py); $s('pulse').setAttribute('r', 8 + 5 * A); $s('pulse').setAttribute('opacity', on * clamp(0.25 + A));
  $s('glow').setAttribute('cx', SPK[0]); $s('glow').setAttribute('cy', SPK[1]); $s('glow').setAttribute('r', 40 + 30 * A); $s('glow').setAttribute('opacity', on * clamp((A - 2.5) / 3.5) * 0.6);

  $s('chart').setAttribute('opacity', ramp(t, beats.loop.start + 2, beats.loop.start + 2.6) * end);
  const shown = levels.slice(-NB);
  bars.forEach((b, k) => {
    const L = shown[k]; const h = L ? 170 * L.A / CAP : 0;
    b.setAttribute('x', 130 + k * 52); b.setAttribute('y', 1300 - h); b.setAttribute('height', h); b.setAttribute('opacity', L ? 1 : 0);
  });

  const show = ramp(t, beats.loop.start + 0.3, beats.loop.start + 0.9) * end;
  $('tagG').style.opacity = show; $('tagL').style.opacity = show;
  const G = gainAt(t);
  $('tagG').querySelector('.val').textContent = '×' + G.toFixed(2); $('tagG').querySelector('i').style.width = clamp(G / 1.5) * 100 + '%';
  const prev = levels.length > 1 ? levels[levels.length - 2].A : 1;
  $('tagL').querySelector('.val').textContent = A >= CAP - 0.01 ? 'Howl' : A < 0.15 ? 'Gone' : (A > prev ? 'Building' : A < prev ? 'Dying away' : 'Steady');
  $('tagL').querySelector('i').style.width = clamp(A / CAP) * 100 + '%';
  at($('nMic'), mx, my - 75); at($('nDesk'), DESK[0], DESK[1] - 100); at($('nSpk'), SPK[0], SPK[1] + 135);
  at($('nAir'), (SPK[0] + mx) / 2, SPK[1] + 95);
  for (const id of ['nMic', 'nDesk', 'nSpk', 'nAir']) $(id).style.opacity = show;
  $('nChart').style.opacity = Number($s('chart').getAttribute('opacity')); at($('nChart'), 540, 1340);
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
