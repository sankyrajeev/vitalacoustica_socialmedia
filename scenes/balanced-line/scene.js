// Balanced line. The signal s and the hum h are simple functions; wire 1 carries
// s + h, wire 2 carries −s + h, and the desk takes (wire 1 − wire 2) / 2 = s.
// Before the DI box there is one wire, and the desk gets s + h.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

const s = u => 0.62 * Math.sin(2 * Math.PI * 1.1 * u) + 0.28 * Math.sin(2 * Math.PI * 2.7 * u + 1.0);
const h = u => 0.30 * Math.sin(2 * Math.PI * 11 * u);

const tNoise = wordAt(beats.problem, /^noise/), tTwo = wordAt(beats.balanced, /^two/), tFlipped = wordAt(beats.balanced, /^flipped/);
const tLands = wordAt(beats.flip, /^lands/), tDesk = wordAt(beats.flip, /^desk/), tCancel = wordAt(beats.flip, /^cancels/);

// Layout.
const PX = 270, PW = 740, PH = 190, PY = [610, 860, 1110];
const WX1 = 118, WX2 = 158, WTOP = 600, WBOT = 1250, MAINS_Y = 770;
const stage = document.getElementById('stage');
const panel = (i, title) => `
  <g id="panel${i}" opacity="0">
    <rect x="${PX}" y="${PY[i]}" width="${PW}" height="${PH}" rx="12" fill="${C.charcoal}" stroke="${C.grey}" stroke-opacity="0.5" stroke-width="2"/>
    <line x1="${PX + 20}" y1="${PY[i] + PH / 2 + 12}" x2="${PX + PW - 20}" y2="${PY[i] + PH / 2 + 12}" stroke="${C.grey}" stroke-opacity="0.3" stroke-width="1.5"/>
    <text id="title${i}" x="${PX + 22}" y="${PY[i] + 34}" fill="${C.grey}" font-family="Manrope" font-weight="600" font-size="20" letter-spacing="3.6">${title}</text>
    <path id="wave${i}" fill="none" stroke-width="3.5" stroke-linejoin="round"/>
  </g>`;
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <!-- Laptop on the right feeds the DI box above the cable -->
  <g transform="translate(800 470)">
    <rect x="0" y="0" width="150" height="92" rx="8" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    <path d="M -14 104 L 164 104 L 150 92 L 0 92 Z" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3" stroke-linejoin="round"/>
  </g>
  <path d="M 800 520 L ${WX1} 520 L ${WX1} 566" stroke="${C.ivory}" stroke-width="4" fill="none"/>
  <g id="di" opacity="0"><rect x="40" y="470" width="196" height="96" rx="12" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/>
    <circle cx="82" cy="518" r="14" fill="none" stroke="${C.brass}" stroke-width="3"/><circle cx="194" cy="518" r="14" fill="none" stroke="${C.brass}" stroke-width="3"/></g>
  <!-- Cable: one wire, then two -->
  <path id="w1" d="M ${WX1} 566 L ${WX1} ${WBOT}" stroke="${C.brass}" stroke-width="5" fill="none"/>
  <path id="w2" d="M ${WX2} 566 L ${WX2} ${WBOT}" stroke="${C.ivory}" stroke-width="5" fill="none" stroke-dasharray="14 9" opacity="0"/>
  <!-- Mains cable crossing, radiating hum -->
  <g id="mains" opacity="0">
    <path d="M 20 ${MAINS_Y} L 250 ${MAINS_Y}" stroke="${C.grey}" stroke-width="9" stroke-linecap="round"/>
    <g id="zaps"></g>
  </g>
  <!-- Desk -->
  <g transform="translate(46 ${WBOT})">
    <rect x="0" y="0" width="190" height="96" rx="10" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    ${[0, 1, 2, 3, 4].map(i => `<line x1="${30 + i * 32}" y1="20" x2="${30 + i * 32}" y2="74" stroke="${C.grey}" stroke-width="3"/><rect x="${20 + i * 32}" y="${30 + (i * 13) % 30}" width="20" height="10" rx="2" fill="${C.ivory}"/>`).join('')}
  </g>
  ${panel(0, 'WIRE 1')}${panel(1, 'WIRE 2 · FLIPPED')}${panel(2, 'AT THE DESK')}
</svg>`;
const $s = id => stage.querySelector('#' + id);
const zaps = $s('zaps');
for (let i = 0; i < 4; i++) zaps.insertAdjacentHTML('beforeend', `<path class="z" fill="none" stroke="${C.grey}" stroke-width="2.5"/>`);
const zEls = [...stage.querySelectorAll('.z')];

const wavePath = (i, fn, scale = 62) => {
  let d = '';
  for (let k = 0; k <= 320; k++) {
    const u = k / 320 * 2.4, x = PX + 24 + k / 320 * (PW - 48), y = PY[i] + PH / 2 + 12 - scale * fn(u);
    d += (k ? ' L ' : 'M ') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return d;
};

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagW"><span class="va-label">Wires</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagH"><span class="va-label">Hum at the desk</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nDI"><b>DI box</b><br>e.g. BSS AR-133</div>
  <div class="va-note va-label" id="nMains" style="padding:10px 14px">Mains hum</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(0, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const scroll = t * 0.55;
  const noise = ramp(t, tNoise - 0.2, tNoise + 0.6);               // hum appears on the cable
  const two = ramp(t, tTwo - 0.2, tTwo + 0.4);                      // DI box and second wire
  const flipped = ramp(t, tFlipped - 0.2, tFlipped + 0.4);
  const noise2 = ramp(t, tLands - 0.2, tLands + 0.5);               // hum shown on wire 2 too
  const result = ramp(t, tDesk - 0.2, tDesk + 0.5);                 // the desk combines them
  const cancel = ramp(t, tCancel - 0.6, tCancel + 0.4);

  $s('di').setAttribute('opacity', two * end);
  $s('w2').setAttribute('opacity', two * end);
  $s('mains').setAttribute('opacity', ramp(t, tNoise - 0.6, tNoise) * end);
  zEls.forEach((z, i) => {
    const ph = ((t * 1.2 + i / zEls.length) % 1), x0 = 60 + i * 52;
    const pts = Array.from({ length: 9 }, (_, k) => `${x0 + (k % 2 ? 9 : -9)} ${MAINS_Y - 18 - k * 12 * (0.4 + ph)}`);
    z.setAttribute('d', 'M ' + pts.join(' L ')); z.setAttribute('stroke-opacity', (1 - ph) * 0.8 * noise);
  });

  // Panel 1: wire 1 always carries the signal, plus hum once it is picked up.
  const p1 = ramp(t, beats.problem.start + 0.3, beats.problem.start + 0.9) * end;
  $s('panel0').setAttribute('opacity', p1);
  $s('wave0').setAttribute('d', wavePath(0, u => s(u + scroll) + noise * h(u + scroll))); $s('wave0').setAttribute('stroke', C.brass);
  // Panel 2: the flipped copy, and the same hum.
  $s('panel1').setAttribute('opacity', flipped * end);
  $s('wave1').setAttribute('d', wavePath(1, u => -s(u + scroll) + noise2 * h(u + scroll))); $s('wave1').setAttribute('stroke', C.ivory);
  // Panel 3: one wire → s + h. With two wires → (w1 − w2) / 2, blending to the clean signal.
  const single = u => s(u + scroll) + noise * h(u + scroll);
  const bal = u => (s(u + scroll) + h(u + scroll) - (-s(u + scroll) + h(u + scroll))) / 2;
  const p3 = Math.max(ramp(t, tNoise + 0.6, tNoise + 1.2) * (1 - ramp(t, tTwo - 0.3, tTwo + 0.2)), result) * end;
  $s('panel2').setAttribute('opacity', p3);
  $s('wave2').setAttribute('d', wavePath(2, u => lerp(single(u), result > 0 ? lerp(single(u), bal(u), cancel) : single(u), result)));
  $s('wave2').setAttribute('stroke', C.brass);
  $s('title2').textContent = result > 0.5 ? 'AT THE DESK · WIRE 1 − WIRE 2' : 'AT THE DESK';

  const show = ramp(t, beats.problem.start + 0.3, beats.problem.start + 0.9) * end;
  $('tagW').style.opacity = show; $('tagH').style.opacity = ramp(t, tNoise, tNoise + 0.6) * end;
  $('tagW').querySelector('.val').textContent = two > 0.5 ? '2' : '1'; $('tagW').querySelector('i').style.width = (two > 0.5 ? 100 : 50) + '%';
  const humLeft = result > 0 ? 1 - cancel : 1;
  $('tagH').querySelector('.val').textContent = humLeft < 0.05 ? 'Cancelled' : 'Loud';
  $('tagH').querySelector('i').style.width = humLeft * 100 + '%';
  $('nDI').style.opacity = two * end; at($('nDI'), 270, 462);
  $('nMains').style.opacity = ramp(t, tNoise - 0.6, tNoise) * end; at($('nMains'), 182, MAINS_Y + 26, 'translate(0, 0)');
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
