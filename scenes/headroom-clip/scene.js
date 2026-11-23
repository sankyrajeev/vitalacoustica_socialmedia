// Headroom and clipping. A music-like signal (steady tones plus decaying drum hits) scrolls
// past. The amplifier can output at most ±1: anything the gain pushes beyond is cut flat.
// Headroom = 20·log10(limit / peak). The share of time clipped is measured in the window shown.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const G0 = spec.params.gain_clean, G1 = spec.params.gain_hot;

const BEAT = 0.5;
function sig(u) {
  let s = 0.16 * Math.sin(2 * Math.PI * 110 * u) + 0.1 * Math.sin(2 * Math.PI * 165 * u + 1.3) + 0.06 * Math.sin(2 * Math.PI * 330 * u + 0.4);
  const k = Math.floor(u / BEAT), d = u - k * BEAT;
  s += 1.05 * Math.exp(-d / 0.06) * Math.sin(2 * Math.PI * 58 * d);                       // kick
  const d2 = u - (k * BEAT + BEAT / 2);
  if (d2 >= 0 && k % 2 === 1) s += 0.5 * Math.exp(-d2 / 0.04) * Math.sin(2 * Math.PI * 190 * d2 + 0.7); // snare-like hit
  return s;
}
// Peak and RMS of the raw signal over one bar (deterministic, measured once).
let PK = 0, SS = 0; const NS = 20000;
for (let i = 0; i < NS; i++) { const v = sig(2 * BEAT * i / NS); PK = Math.max(PK, Math.abs(v)); SS += v * v; }
const RMS = Math.sqrt(SS / NS);

const tUp = wordAt(beats.clip, /^up/i), tBack = beats.takeaway.start + 0.2;
const gain = t => lerp(G0, G1, ramp(t, tUp, tUp + 1.2) - ramp(t, tBack, tBack + 1.2));

const X0 = 120, X1 = 960, CY = 870, A = 205, WIN = 2.0, SUB = 6;
const yv = v => CY - v * A;
const ZY0 = 1190, ZY1 = 1390, ZC = (ZY0 + ZY1) / 2, ZA = 68, zy = v => ZC - v * ZA, ZWIN = 0.045;
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  <path id="ghost" fill="${C.grey}" fill-opacity="0.22"/>
  <path id="wave" fill="${C.brass}"/>
  <path id="flat" fill="none" stroke="${C.ivory}" stroke-width="5"/>
  <line id="rmsT" x1="${X0}" x2="${X1}" stroke="${C.grey}" stroke-width="2" stroke-dasharray="6 8"/>
  <line id="rmsB" x1="${X0}" x2="${X1}" stroke="${C.grey}" stroke-width="2" stroke-dasharray="6 8"/>
  <line x1="${X0}" x2="${X1}" y1="${yv(1)}" y2="${yv(1)}" stroke="${C.ivory}" stroke-width="3"/>
  <line x1="${X0}" x2="${X1}" y1="${yv(-1)}" y2="${yv(-1)}" stroke="${C.ivory}" stroke-width="3"/>
  <g id="hr"><line id="hrL" stroke="${C.brass}" stroke-width="4"/></g>
  <g id="zoom"><rect x="${X0}" y="${ZY0}" width="${X1 - X0}" height="${ZY1 - ZY0}" rx="12" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="2"/>
    <line x1="${X0 + 20}" x2="${X1 - 20}" y1="${zy(1)}" y2="${zy(1)}" stroke="${C.ivory}" stroke-width="2"/>
    <line x1="${X0 + 20}" x2="${X1 - 20}" y1="${zy(-1)}" y2="${zy(-1)}" stroke="${C.ivory}" stroke-width="2"/>
    <path id="zg" fill="none" stroke="${C.grey}" stroke-width="2" stroke-dasharray="5 6"/>
    <path id="zw" fill="none" stroke="${C.brass}" stroke-width="4" stroke-linejoin="round"/></g>
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagH"><span class="va-label">Headroom</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagC"><span class="va-label">Time spent clipping</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nLim" style="text-align:center;border-left:none;padding:6px 10px"><b>Amplifier limit</b></div>
  <div class="va-note va-label" id="nLim2" style="text-align:center;border-left:none;padding:6px 10px"><b>Amplifier limit</b></div>
  <div class="va-note va-label" id="nAvg" style="text-align:center;border-left:none;padding:6px 10px">Average level</div>
  <div class="va-note va-label" id="nHr" style="text-align:center;border-left:none;padding:6px 10px"><b>Headroom</b></div>
  <div class="va-note va-label" id="nFlat" style="text-align:center;border-left:none;padding:6px 10px"><b>Tops cut flat</b></div>
  <div class="va-note va-label" id="nZoom" style="text-align:center;border-left:none;padding:6px 10px">One drum hit, close up</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  const G = gain(t), u0 = t * 0.55;                       // scroll through the music
  let top = '', bot = '', gTop = '', gBot = '', flat = '', clipN = 0, n = 0;
  for (let x = X0; x <= X1; x += 2) {
    let mx = -9, mn = 9;
    for (let k = 0; k < SUB; k++) { const v = G * sig(u0 + ((x - X0 + k * 2 / SUB) / (X1 - X0)) * WIN); mx = Math.max(mx, v); mn = Math.min(mn, v); n++; if (Math.abs(v) >= 1) clipN++; }
    gTop += `${x} ${yv(Math.max(mx, 0)).toFixed(1)} `; gBot = `${x} ${yv(Math.min(mn, 0)).toFixed(1)} ` + gBot;
    top += `${x} ${yv(clamp(mx, 0, 1)).toFixed(1)} `; bot = `${x} ${yv(clamp(mn, -1, 0)).toFixed(1)} ` + bot;
    if (mx >= 1) flat += `M${x - 1} ${yv(1)}H${x + 1}`;
    if (mn <= -1) flat += `M${x - 1} ${yv(-1)}H${x + 1}`;
  }
  $s('ghost').setAttribute('d', `M${gTop}L${gBot}Z`); $s('wave').setAttribute('d', `M${top}L${bot}Z`); $s('flat').setAttribute('d', flat);
  const rms = Math.min(1, G * RMS);
  $s('rmsT').setAttribute('y1', yv(rms)); $s('rmsT').setAttribute('y2', yv(rms));
  $s('rmsB').setAttribute('y1', yv(-rms)); $s('rmsB').setAttribute('y2', yv(-rms));
  const hrOn = ramp(t, wordAt(beats.room, /^headroom/i), wordAt(beats.room, /^headroom/i) + 0.6) * (1 - ramp(t, tUp, tUp + 0.6));
  $s('hrL').setAttribute('x1', 990); $s('hrL').setAttribute('x2', 990); $s('hrL').setAttribute('y1', yv(rms)); $s('hrL').setAttribute('y2', yv(1));
  $s('hr').setAttribute('opacity', hrOn);

  const show = ramp(t, beats.peaks.start, beats.peaks.start + 0.6) * end;
  $('tagH').style.opacity = show; $('tagC').style.opacity = show;
  const hdb = 20 * Math.log10(1 / (G * PK));
  $('tagH').querySelector('.val').textContent = hdb > 0 ? `${hdb.toFixed(1)} dB` : 'None';
  $('tagH').querySelector('i').style.width = clamp(hdb / 10) * 100 + '%';
  const pc = 100 * clipN / n;
  $('tagC').querySelector('.val').textContent = pc < 0.05 ? '0%' : pc.toFixed(1) + '%';
  $('tagC').querySelector('i').style.width = clamp(pc / 10) * 100 + '%';
  at($('nLim'), X0 + 100, yv(1) - 26); at($('nLim2'), X0 + 100, yv(-1) + 26);
  at($('nAvg'), 840, yv(rms) + 24);
  at($('nHr'), 990, yv((rms + 1) / 2), 'translate(-100%, -50%) translateX(-14px)');
  for (const id of ['nLim', 'nLim2']) $(id).style.opacity = show;
  $('nAvg').style.opacity = ramp(t, wordAt(beats.peaks, /^average/i), wordAt(beats.peaks, /^average/i) + 0.5) * end;
  $('nHr').style.opacity = hrOn * end;
  $('nFlat').style.opacity = ramp(t, wordAt(beats.clip, /^tops/i), wordAt(beats.clip, /^tops/i) + 0.5) * (1 - ramp(t, tBack, tBack + 0.8)) * end;
  at($('nFlat'), X1 - 100, ZY0 - 26);
  // Close-up of one kick: the waveform as the amplifier outputs it, and (dashed) what it was asked for.
  let zg = '', zw = '';
  for (let i = 0; i <= 300; i++) {
    const u = ZWIN * i / 300, v = G * sig(4 * BEAT - 0.004 + u), x = (X0 + 20 + (X1 - X0 - 40) * i / 300).toFixed(1);
    zg += (i ? 'L' : 'M') + x + ' ' + zy(clamp(v, -1.4, 1.4)).toFixed(1) + ' ';
    zw += (i ? 'L' : 'M') + x + ' ' + zy(clamp(v, -1, 1)).toFixed(1) + ' ';
  }
  $s('zg').setAttribute('d', zg); $s('zw').setAttribute('d', zw);
  const zOn = ramp(t, beats.clip.start, beats.clip.start + 0.6) * end;
  $s('zoom').setAttribute('opacity', zOn); $('nZoom').style.opacity = zOn; at($('nZoom'), X0 + 130, ZY0 - 26);
  $s('zg').setAttribute('opacity', G * PK > 1 ? 1 : 0);
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
