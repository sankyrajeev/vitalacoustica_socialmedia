// Tech rider, as a document that builds section by section while the narration names
// each part, then a timeline comparing a rider received at booking with one received
// on the day. An illustrative example, not any real artist's rider.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

const tCard = beats.what.start + 0.2;
const tSec = [wordAt(beats.inside, /^input/), wordAt(beats.inside, /^stands/), wordAt(beats.inside, /^monitors/), wordAt(beats.inside, /^gear/)];
const tWhy = beats.why.start + 0.2, tDay = wordAt(beats.why, /^day/);
const X0 = 150, X1 = 930, Y0 = 470, Y1 = 1330;
const txt = (x, y, s, size = 22, col = C.grey, w = 600, anchor = 'start', ls = 2) => `<text x="${x}" y="${y}" fill="${col}" font-family="Manrope" font-weight="${w}" font-size="${size}" letter-spacing="${ls}" text-anchor="${anchor}">${s}</text>`;
const SY = [600, 790, 990, 1140];
const sections = [
  `${txt(X0 + 40, SY[0], '1 · INPUT LIST', 24, C.brass, 600, 'start', 4)}
   ${['CH 1   KICK   ·   DYNAMIC MIC', 'CH 2   VOCAL   ·   DYNAMIC MIC', 'CH 3–4   DJ MIXER   ·   STEREO DI', 'CH 5   HOST MIC   ·   WIRELESS'].map((r, i) => txt(X0 + 40, SY[0] + 44 + i * 34, r, 21, C.ivory, 400, 'start', 1.5)).join('')}`,
  `${txt(X0 + 40, SY[1], '2 · STAGE PLOT', 24, C.brass, 600, 'start', 4)}
   <rect x="${X0 + 40}" y="${SY[1] + 22}" width="${X1 - X0 - 80}" height="140" rx="8" fill="none" stroke="${C.grey}" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="6 6"/>
   <rect x="${(X0 + X1) / 2 - 90}" y="${SY[1] + 50}" width="180" height="56" rx="6" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="2"/>${txt((X0 + X1) / 2, SY[1] + 86, 'DJ', 22, C.ivory, 600, 'middle')}
   <circle cx="${X0 + 170}" cy="${SY[1] + 80}" r="26" fill="none" stroke="${C.ivory}" stroke-width="2"/>${txt(X0 + 170, SY[1] + 87, 'VOX', 17, C.ivory, 600, 'middle', 1)}
   ${[X0 + 170, (X0 + X1) / 2].map(x => `<path d="M ${x - 34} ${SY[1] + 150} L ${x + 34} ${SY[1] + 150} L ${x + 24} ${SY[1] + 128} L ${x - 24} ${SY[1] + 128} Z" fill="none" stroke="${C.brass}" stroke-width="2"/>`).join('')}`,
  `${txt(X0 + 40, SY[2], '3 · MONITORS', 24, C.brass, 600, 'start', 4)}${txt(X0 + 40, SY[2] + 44, 'DJ: 2 WEDGES  ·  VOCAL: 1 WEDGE', 21, C.ivory, 400, 'start', 1.5)}${txt(X0 + 40, SY[2] + 78, 'SEPARATE MIX FOR EACH', 21, C.ivory, 400, 'start', 1.5)}`,
  `${txt(X0 + 40, SY[3], '4 · BACKLINE', 24, C.brass, 600, 'start', 4)}${txt(X0 + 40, SY[3] + 44, 'DJ PLAYERS, MIXER, TABLE AT 1 M', 21, C.ivory, 400, 'start', 1.5)}${txt(X0 + 40, SY[3] + 78, 'POWER AT THE BOOTH  ·  TECH CONTACT', 21, C.ivory, 400, 'start', 1.5)}`,
];
// Timeline panel for the "why" beat.
const TL = 1000, TX0 = 270, TX1 = 810;
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <g id="card" opacity="0">
    <rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" rx="16" fill="${C.charcoal}" stroke="${C.grey}" stroke-opacity="0.6" stroke-width="2"/>
    ${txt(X0 + 40, Y0 + 62, 'TECH RIDER', 30, C.ivory, 700, 'start', 6)}${txt(X1 - 40, Y0 + 62, 'EXAMPLE', 20, C.grey, 600, 'end', 4)}
    <line x1="${X0 + 40}" y1="${Y0 + 88}" x2="${X1 - 40}" y2="${Y0 + 88}" stroke="${C.brass}" stroke-width="2"/>
    ${sections.map((s, i) => `<g class="sec" opacity="0">${s}</g>`).join('')}
  </g>
  <g id="tl" opacity="0">
    <rect x="${X0}" y="${TL - 240}" width="${X1 - X0}" height="560" rx="16" fill="${C.obsidian}" stroke="${C.brass}" stroke-width="2"/>
    ${txt(540, TL - 180, 'WHEN THE RIDER ARRIVES', 22, C.grey, 600, 'middle', 4)}
    <line x1="${TX0}" y1="${TL - 60}" x2="${TX1}" y2="${TL - 60}" stroke="${C.grey}" stroke-width="2"/>
    ${[['BOOKING', TX0], ['PLANNING', (TX0 + TX1) / 2], ['SHOW DAY', TX1]].map(([s, x]) => `<line x1="${x}" y1="${TL - 72}" x2="${x}" y2="${TL - 48}" stroke="${C.grey}" stroke-width="2"/>${txt(x, TL - 90, s, 19, C.grey, 600, 'middle', 2)}`).join('')}
    <g id="early"><circle cx="${TX0}" cy="${TL - 60}" r="14" fill="${C.brass}"/><rect x="${TX0}" y="${TL - 4}" width="${TX1 - TX0}" height="26" rx="6" fill="${C.brass}" fill-opacity="0.35"/>${txt(540, TL + 60, 'AT BOOKING: SYSTEM, CREW AND STAGE PLANNED AROUND IT', 19, C.ivory, 600, 'middle', 1.5)}</g>
    <g id="late" opacity="0"><circle cx="${TX1}" cy="${TL - 60}" r="14" fill="none" stroke="${C.ivory}" stroke-width="4"/><rect x="${TX1 - 40}" y="${TL + 100}" width="40" height="26" rx="6" fill="${C.ivory}" fill-opacity="0.5"/>${txt(540, TL + 170, 'ON THE DAY: A FEW HOURS TO ADAPT', 19, C.ivory, 600, 'middle', 1.5)}</g>
  </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const secEls = [...stage.querySelectorAll('.sec')];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagS"><span class="va-label">Rider sections</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagP"><span class="va-label">Time to plan</span><span class="val"></span><div class="bar"><i></i></div></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const tlA = ramp(t, tWhy - 0.2, tWhy + 0.5) * (1 - ramp(t, beats.takeaway.start + 0.4, beats.takeaway.start + 1.0)) * end;
  $s('card').setAttribute('opacity', ramp(t, tCard - 0.2, tCard + 0.5) * end * (1 - 0.75 * tlA));
  let n = 0;
  secEls.forEach((g, i) => { const a = ramp(t, tSec[i] - 0.3, tSec[i] + 0.3); g.setAttribute('opacity', a); if (a > 0.5) n++; });
  $s('tl').setAttribute('opacity', tlA);
  const late = ramp(t, tDay - 0.6, tDay);
  $s('late').setAttribute('opacity', late);
  $('tagS').style.opacity = ramp(t, tSec[0] - 0.3, tSec[0] + 0.3) * end * (1 - tlA);
  $('tagS').querySelector('.val').textContent = n + ' of 4'; $('tagS').querySelector('i').style.width = n / 4 * 100 + '%';
  $('tagP').style.opacity = tlA;
  $('tagP').querySelector('.val').textContent = late > 0.5 ? 'Hours' : 'Weeks';
  $('tagP').querySelector('i').style.width = (late > 0.5 ? 6 : 100) + '%';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
