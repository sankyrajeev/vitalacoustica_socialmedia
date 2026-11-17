// BPM chase. The video runs in real time at 128 BPM: a beat every 60/128 s = 469 ms.
// A beat counter pulses on every beat; a chase across 8 beams moves one step per beat,
// then every two beats, then twice per beat. One beam is lit at a time, so the frame
// never flashes as a whole.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const BPM = spec.params.bpm, NF = spec.params.fixtures, BEAT = 60 / BPM;

const t0 = beats.bpm.start + 0.2;                                 // the clock starts here, on a downbeat
const tChase = wordAt(beats.chase, /^chase/), tHalf = wordAt(beats.divide, /^halve/), tDouble = wordAt(beats.divide, /^double/), tBack = beats.takeaway.start;
const beatPos = t => (t - t0) / BEAT;
// Steps per beat for each part, and where each part starts (snapped to the next beat).
const snap = t => t0 + Math.ceil((t - t0) / BEAT) * BEAT;
const PARTS = [[snap(tChase), 1], [snap(tHalf), 0.5], [snap(tDouble), 2], [snap(tBack), 1]];
function chase(t) {
  let idx = -1, rate = 0, since = 0;
  let acc = 0;
  for (let i = 0; i < PARTS.length; i++) {
    const [ts, r] = PARTS[i], te = i + 1 < PARTS.length ? PARTS[i + 1][0] : Infinity;
    if (t < ts) break;
    const span = Math.min(t, te) - ts, n = span / BEAT * r;
    if (t < te) { const k = Math.floor(n); idx = acc + k; rate = r; since = (n - k) / r * BEAT; break; }
    acc += Math.round((te - ts) / BEAT * r);
  }
  return { idx, rate, since };
}
const pingpong = (k, n) => { const p = 2 * (n - 1), m = ((k % p) + p) % p; return m < n ? m : p - m; };

const FX = Array.from({ length: NF }, (_, i) => 120 + i * (840 / (NF - 1))), FY = 560, FLOOR = 1180;
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <defs><linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ivory}" stop-opacity="0.95"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0.15"/></linearGradient></defs>
  <line x1="70" y1="${FY - 42}" x2="1010" y2="${FY - 42}" stroke="${C.grey}" stroke-width="6"/>
  <line x1="70" y1="${FLOOR}" x2="1010" y2="${FLOOR}" stroke="${C.grey}" stroke-opacity="0.5" stroke-width="2"/>
  ${FX.map((x, i) => `<g><polygon class="bm" points="${x - 14},${FY + 22} ${x + 14},${FY + 22} ${x + 58},${FLOOR} ${x - 58},${FLOOR}" fill="url(#beam)" opacity="0"/>
    <ellipse class="sp" cx="${x}" cy="${FLOOR}" rx="62" ry="12" fill="${C.ivory}" opacity="0"/>
    <rect x="${x - 26}" y="${FY - 36}" width="52" height="56" rx="8" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="2.5"/>
    <circle class="ln" cx="${x}" cy="${FY + 6}" r="14" fill="${C.ivory}" opacity="0.1"/></g>`).join('')}
  <!-- Beat counter: four beats to a bar -->
  <g id="counter" opacity="0">${[0, 1, 2, 3].map(i => `<circle class="bt" cx="${360 + i * 120}" cy="${FLOOR + 110}" r="22" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/><text x="${360 + i * 120}" y="${FLOOR + 118}" fill="${C.grey}" font-family="Manrope" font-weight="600" font-size="22" text-anchor="middle">${i + 1}</text>`).join('')}</g>
</svg>`;
const $s = sel => [...stage.querySelectorAll(sel)];
const bm = $s('.bm'), sp = $s('.sp'), ln = $s('.ln'), bt = $s('.bt');

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagB"><span class="va-label">Tempo</span><span class="val">${BPM} BPM</span><div class="bar"><i style="width:${BPM / 180 * 100}%"></i></div></div>
  <div class="va-tag right" id="tagC"><span class="va-label">Chase</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nBeat"><b>One beat</b> = 60 ÷ ${BPM} = ${Math.round(BEAT * 1000)} ms</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const bp = beatPos(t), onBeat = t >= t0;
  const ago = onBeat ? (bp - Math.floor(bp)) * BEAT : 9;          // seconds since the last beat
  const counterA = ramp(t, t0 - 0.4, t0) * end;
  stage.querySelector('#counter').setAttribute('opacity', counterA);
  bt.forEach((c, i) => { const cur = onBeat && Math.floor(bp) % 4 === i; c.setAttribute('fill', cur ? C.brass : C.charcoal); c.setAttribute('fill-opacity', cur ? 0.35 + 0.65 * Math.exp(-ago / 0.18) : 1); });

  const { idx, rate, since } = chase(t);
  const pp = t >= PARTS[3][0];
  const lit = idx < 0 ? -1 : (pp ? pingpong(idx, NF) : idx % NF);
  const b = idx < 0 ? 0 : 0.35 + 0.65 * Math.exp(-since / 0.22);
  // A short fading trail of the previous two steps makes the direction readable.
  const posOf = k => k < 0 ? -1 : (pp ? pingpong(k, NF) : k % NF);
  const level = i => i === lit ? b : (idx >= 1 && i === posOf(idx - 1) ? 0.28 : (idx >= 2 && i === posOf(idx - 2) ? 0.1 : 0));
  bm.forEach((e, i) => e.setAttribute('opacity', level(i) * end));
  sp.forEach((e, i) => e.setAttribute('opacity', 0.6 * level(i) * end));
  ln.forEach((e, i) => e.setAttribute('opacity', 0.1 + 0.9 * level(i)));

  $('tagB').style.opacity = counterA;
  $('tagC').style.opacity = idx >= 0 ? end : 0;
  $('tagC').querySelector('.val').textContent = rate === 0.5 ? '1 step / 2 beats' : rate === 2 ? '2 steps / beat' : '1 step / beat';
  $('tagC').querySelector('i').style.width = rate / 2 * 100 + '%';
  $('nBeat').style.opacity = counterA; $('nBeat').style.left = '540px'; $('nBeat').style.top = (FLOOR + 190) + 'px'; $('nBeat').style.transform = 'translate(-50%, -50%)';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
