// DMX in 30 seconds. A desk sends 512 channel values (0–255) down one cable; the grid
// shows the whole stream. Four fixtures, each with a start address, read their own
// block of 16 channels and set their brightness from the first one (the dimmer).
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const FX = spec.params.fixtures, N = spec.params.channels, PER = 16;

// Channel values over time: each fixture's 16 channels move in its own pattern;
// channel 1 of each block is its dimmer. Unused channels stay at 0.
function value(ch, t) {                                   // ch is 1-based
  const f = FX.findIndex(x => ch >= x.addr && ch < x.addr + PER);
  if (f < 0) return 0;
  const k = ch - FX[f].addr;
  if (k === 0) return Math.round(255 * (0.5 + 0.5 * Math.sin(1.7 * t + f * 1.6)) ** 1.4);
  return Math.round(255 * (0.5 + 0.5 * Math.sin(0.6 * t + k * 0.9 + f * 2.1)) * (k % 3 === 0 ? 0.3 : 1));
}

// Layout.
const COLS = 32, ROWS = 16, CELL = 22, GAP = 2, GX = 540 - (COLS * (CELL + GAP) - GAP) / 2, GY = 640;
const cellXY = ch => [GX + ((ch - 1) % COLS) * (CELL + GAP), GY + Math.floor((ch - 1) / COLS) * (CELL + GAP)];
const DESK = { x: 300, y: 470, w: 480, h: 110 };
const FY = 1180, FXS = [195, 425, 655, 885];
const tAddr = wordAt(beats.address, /^start/), tVal = wordAt(beats.values, /^zero/), tChain = wordAt(beats.takeaway, /^chained/);

const stage = document.getElementById('stage');
let cells = '';
for (let ch = 1; ch <= N; ch++) { const [x, y] = cellXY(ch); cells += `<rect class="c" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3"/>`; }
const cablePath = `M ${DESK.x + DESK.w / 2} ${DESK.y + DESK.h} L ${DESK.x + DESK.w / 2} 612 L 70 612 L 70 ${FY - 70} L ${FXS[0]} ${FY - 70} L ${FXS[3]} ${FY - 70}`;
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <defs><radialGradient id="glow"><stop offset="0" stop-color="${C.ivory}"/><stop offset="0.5" stop-color="${C.brass}"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0"/></radialGradient></defs>
  <path id="cable" d="${cablePath}" fill="none" stroke="${C.grey}" stroke-width="5" stroke-linejoin="round"/>
  <g id="packets"></g>
  <!-- Desk -->
  <g>
    <rect x="${DESK.x}" y="${DESK.y}" width="${DESK.w}" height="${DESK.h}" rx="12" fill="${C.charcoal}" stroke="${C.brass}" stroke-width="3"/>
    ${Array.from({ length: 10 }, (_, i) => `<line x1="${DESK.x + 40 + i * 44}" y1="${DESK.y + 22}" x2="${DESK.x + 40 + i * 44}" y2="${DESK.y + 88}" stroke="${C.grey}" stroke-width="3"/><rect class="fader" data-i="${i}" x="${DESK.x + 28 + i * 44}" y="${DESK.y + 50}" width="24" height="12" rx="2" fill="${C.ivory}"/>`).join('')}
  </g>
  <g id="grid" opacity="0">${cells}</g>
  <g id="ranges"></g>
  <rect id="scan" y="${GY - 3}" width="${CELL + 6}" height="${CELL + 6}" fill="none" stroke="${C.ivory}" stroke-width="2.5" opacity="0"/>
  <g id="fixtures"></g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const cellEls = [...stage.querySelectorAll('.c')];
const faders = [...stage.querySelectorAll('.fader')];
for (let i = 0; i < 8; i++) $s('packets').insertAdjacentHTML('beforeend', `<circle class="pk" r="7" fill="${C.brass}"/>`);
const pkEls = [...stage.querySelectorAll('.pk')];
const cable = $s('cable'), cableLen = cable.getTotalLength();
FX.forEach((f, i) => {
  const [x, y] = cellXY(f.addr), w = PER * (CELL + GAP) - GAP;
  $s('ranges').insertAdjacentHTML('beforeend', `<rect class="rg" x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${CELL + 8}" rx="5" fill="none" stroke="${C.brass}" stroke-width="3" opacity="0"/>`);
  $s('fixtures').insertAdjacentHTML('beforeend', `
    <g class="fx" transform="translate(${FXS[i]} ${FY})">
      <line x1="0" y1="-70" x2="0" y2="-46" stroke="${C.grey}" stroke-width="5"/>
      <circle class="halo" cx="0" cy="40" r="120" fill="url(#glow)" opacity="0"/>
      <rect x="-56" y="-46" width="112" height="80" rx="10" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="3"/>
      <circle class="lens" cx="0" cy="-6" r="28" fill="${C.ivory}" opacity="0.1" stroke="${C.grey}" stroke-width="2"/>
    </g>`);
});
const rgEls = [...stage.querySelectorAll('.rg')], fxEls = [...stage.querySelectorAll('.fx')];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagC"><span class="va-label">Channels</span><span class="val">512</span><div class="bar"><i style="width:100%"></i></div></div>
  <div class="va-tag right" id="tagV"><span class="va-label">Channel 1 · dimmer</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nDesk"><b>Desk</b></div>
  <div class="va-note va-label" id="nGrid"><b>512 channels</b><br>Each 0–255<br>These 4 lights use 64</div>
  ${FX.map((f, i) => `<div class="va-note va-label fl" id="f${i}" style="text-align:center;border-left:none;border-top:2px solid var(--va-brass);padding:10px 8px"><b>${f.name}</b><br>Address ${f.addr}</div>`).join('')}`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(0, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const gridA = ramp(t, wordAt(beats.cable, /^five/) - 0.3, wordAt(beats.cable, /^five/) + 0.6) * end;
  $s('grid').setAttribute('opacity', gridA);
  for (let ch = 1; ch <= N; ch++) {
    const v = value(ch, t) / 255;
    const el = cellEls[ch - 1];
    el.setAttribute('fill', v > 0 ? C.brass : C.charcoal);
    el.setAttribute('fill-opacity', v > 0 ? 0.15 + 0.85 * v : 1);
  }
  // The stream repeats: a cursor runs through all 512 channels, many times a second (slowed down here).
  const pos = Math.floor(((t * 140) % N)) + 1, [sx, sy] = cellXY(pos);
  $s('scan').setAttribute('x', sx - 3); $s('scan').setAttribute('y', sy - 3); $s('scan').setAttribute('opacity', gridA * 0.9);

  // Packets along the cable.
  const pkA = ramp(t, beats.cable.start + 0.5, beats.cable.start + 1.2) * end;
  pkEls.forEach((p, i) => {
    const pt = cable.getPointAtLength(((t * 0.22 + i / pkEls.length) % 1) * cableLen);
    p.setAttribute('cx', pt.x); p.setAttribute('cy', pt.y); p.setAttribute('opacity', pkA);
  });
  faders.forEach((f, i) => f.setAttribute('y', DESK.y + 22 + (1 - value(FX[i % 4].addr + (i > 3 ? i : 0), t) / 255) * 56));

  const addrA = ramp(t, tAddr - 0.2, tAddr + 0.5) * end;
  FX.forEach((f, i) => {
    const d = value(f.addr, t) / 255, lit = ramp(t, beats.cable.start + 1.0, beats.cable.start + 1.6) * end;
    fxEls[i].querySelector('.lens').setAttribute('opacity', 0.1 + 0.9 * d * lit);
    fxEls[i].querySelector('.halo').setAttribute('opacity', 0.75 * d * lit);
    rgEls[i].setAttribute('opacity', addrA * (0.55 + 0.45 * Math.sin(t * 3 + i)));
    $('f' + i).style.opacity = addrA; at($('f' + i), FXS[i], FY + 70, 'translate(-50%, 0)');
  });

  const show = ramp(t, beats.cable.start + 0.4, beats.cable.start + 1.0) * end;
  $('tagC').style.opacity = show; $('tagV').style.opacity = ramp(t, tVal - 0.4, tVal + 0.3) * end;
  const v1 = value(1, t);
  $('tagV').querySelector('.val').textContent = v1; $('tagV').querySelector('i').style.width = v1 / 255 * 100 + '%';
  $('nDesk').style.opacity = show; at($('nDesk'), DESK.x + DESK.w + 26, DESK.y + DESK.h / 2);
  $('nGrid').style.opacity = gridA * (1 - addrA); at($('nGrid'), 540, GY + ROWS * (CELL + GAP) * 0.6, 'translate(-50%, -50%)');
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
