// Cardioid pickup, seen from above. Pickup at angle θ from the front is the ideal
// cardioid 0.5·(1 + cos θ); the pattern, the marker and the readout all use it.
// A sound moves round the mic; then the monitor wedge takes its place behind.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const pick = th => 0.5 * (1 + Math.cos(th));
const DEG = Math.PI / 180;

const CX = 540, CY = 925, R = 290, RS = 375;      // centre, pattern size, source orbit (px)
const tSide = wordAt(beats.sweep, /^side/), tBack = wordAt(beats.sweep, /^back/);
const angleAt = t => lerp(lerp(0, 90, ramp(t, tSide - 1.0, tSide + 0.2)), 180, ramp(t, tBack - 0.8, tBack + 0.4)) * DEG;
const P = (r, th) => [CX + r * Math.sin(th), CY - r * Math.cos(th)];

const pts = Array.from({ length: 361 }, (_, i) => P(R * pick(i * DEG), i * DEG));
const patternD = 'M ' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L ') + ' Z';

const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <g id="grid" opacity="0">
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${C.grey}" stroke-opacity="0.35" stroke-width="2"/>
    <circle cx="${CX}" cy="${CY}" r="${R / 2}" fill="none" stroke="${C.grey}" stroke-opacity="0.25" stroke-width="2" stroke-dasharray="6 8"/>
    <line x1="${CX}" y1="${CY - R - 30}" x2="${CX}" y2="${CY + R + 30}" stroke="${C.grey}" stroke-opacity="0.25" stroke-width="2"/>
    <line x1="${CX - R - 30}" y1="${CY}" x2="${CX + R + 30}" y2="${CY}" stroke="${C.grey}" stroke-opacity="0.25" stroke-width="2"/>
  </g>
  <path id="pattern" d="${patternD}" fill="${C.brass}" fill-opacity="0.13" stroke="${C.brass}" stroke-width="4" opacity="0"/>
  <clipPath id="area"><rect x="0" y="440" width="1080" height="940"/></clipPath>
  <g id="waves" clip-path="url(#area)"></g>
  <line id="ray" x1="0" y1="0" x2="${CX}" y2="${CY}" stroke="${C.ivory}" stroke-opacity="0.5" stroke-width="2" stroke-dasharray="4 8"/>
  <!-- Microphone from above: grille at the centre, handle pointing away from the front -->
  <g id="mic">
    <rect x="${CX - 17}" y="${CY + 26}" width="34" height="150" rx="12" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="3"/>
    <circle cx="${CX}" cy="${CY}" r="40" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    ${[-24, -12, 0, 12, 24].map(o => `<line x1="${CX + o}" y1="${CY - Math.sqrt(1600 - o * o) + 4}" x2="${CX + o}" y2="${CY + Math.sqrt(1600 - o * o) - 4}" stroke="${C.grey}" stroke-width="1.5"/>`).join('')}
  </g>
  <circle id="mark" r="13" fill="${C.ivory}" stroke="${C.obsidian}" stroke-width="3"/>
  <!-- The moving sound -->
  <g id="src"><circle r="34" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    <path d="M -12 -10 L -4 -10 L 6 -19 L 6 19 L -4 10 L -12 10 Z" fill="${C.ivory}"/></g>
  <!-- Monitor wedge, seen from above, behind the mic -->
  <g id="wedge" opacity="0" transform="translate(${CX} ${CY + RS})">
    <path d="M -110 -46 L 110 -46 L 90 46 L -90 46 Z" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/>
    <circle cx="-40" cy="-6" r="24" fill="none" stroke="${C.brass}" stroke-width="2.5"/><circle cx="40" cy="-6" r="12" fill="none" stroke="${C.brass}" stroke-width="2.5"/>
  </g>
  <!-- Singer, in front -->
  <g id="singer" opacity="0" transform="translate(${CX} ${CY - RS})">
    <ellipse rx="70" ry="36" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    <circle r="28" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
  </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const waves = $s('waves');
for (let i = 0; i < 5; i++) waves.insertAdjacentHTML('beforeend', `<circle class="w" r="10" fill="none" stroke="${C.ivory}" stroke-width="3"/>`);
const wEls = [...waves.children];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagA"><span class="va-label">Direction</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagP"><span class="va-label">Picked up</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nFront"><b>Front</b><br>Hears best</div>
  <div class="va-note va-label" id="nPat"><b>Cardioid</b><br>Ideal pattern</div>
  <div class="va-note va-label" id="nWedge"><b>Monitor wedge</b><br>In the quiet spot</div>
  <div class="va-note va-label" id="nSinger"><b>Singer</b></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(0, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const patA = ramp(t, wordAt(beats.pattern, /^cardioid/) - 0.3, wordAt(beats.pattern, /^cardioid/) + 0.5) * end;
  $s('pattern').setAttribute('opacity', patA); $s('grid').setAttribute('opacity', patA);

  const wedgeIn = ramp(t, beats.wedge.start, beats.wedge.start + 0.8);
  const th = angleAt(t);
  const [sx, sy] = P(RS, th);
  const srcA = ramp(t, beats.pattern.start, beats.pattern.start + 0.6) * (1 - wedgeIn) * end;
  $s('src').setAttribute('transform', `translate(${sx} ${sy})`); $s('src').setAttribute('opacity', srcA);
  $s('wedge').setAttribute('opacity', wedgeIn * end);
  $s('singer').setAttribute('opacity', ramp(t, beats.wedge.start + 1.5, beats.wedge.start + 2.2) * end);

  // Waves travel from the sound towards the mic, every 0.7 s.
  const live = Math.max(srcA, wedgeIn * end);
  wEls.forEach((w, i) => {
    const ph = ((t * 1.4 + i / wEls.length) % 1), r = 20 + ph * (RS - 60);
    w.setAttribute('cx', sx); w.setAttribute('cy', sy); w.setAttribute('r', r);
    w.setAttribute('stroke-opacity', (1 - ph) * 0.5 * live);
  });
  $s('ray').setAttribute('x1', sx); $s('ray').setAttribute('y1', sy); $s('ray').setAttribute('stroke-opacity', 0.45 * live);
  const [mx, my] = P(R * pick(th), th);
  $s('mark').setAttribute('cx', mx); $s('mark').setAttribute('cy', my); $s('mark').setAttribute('opacity', patA * live);

  const show = ramp(t, beats.pattern.start + 0.4, beats.pattern.start + 1.0) * end;
  $('tagA').style.opacity = show; $('tagP').style.opacity = show;
  const deg = Math.round(th / DEG);
  $('tagA').querySelector('.val').textContent = deg + '°';
  $('tagA').querySelector('i').style.width = deg / 180 * 100 + '%';
  const p = pick(th), db = 20 * Math.log10(Math.max(p, 1e-6));
  $('tagP').querySelector('.val').textContent = deg >= 170 ? 'Least' : (Math.round(db) === 0 ? '0 dB' : '−' + Math.abs(Math.round(db)) + ' dB');
  $('tagP').querySelector('i').style.width = p * 100 + '%';

  $('nFront').style.opacity = patA * (1 - ramp(t, tSide - 1.0, tSide - 0.4)); at($('nFront'), CX + 70, CY - R - 10);
  $('nPat').style.opacity = patA; at($('nPat'), CX + R * 0.62, CY - R * 0.62 - 30);
  $('nWedge').style.opacity = wedgeIn * end; at($('nWedge'), CX + 140, CY + RS);
  $('nSinger').style.opacity = ramp(t, beats.wedge.start + 1.5, beats.wedge.start + 2.2) * end; at($('nSinger'), CX + 100, CY - RS);
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
