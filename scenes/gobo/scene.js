// Gobos. Side view: lamp → gobo → lens → wall. Front views: the gobo disc and the
// projection on the wall, drawn from the same pattern geometry (the projection is the
// gobo's open shapes, scaled up), so what lands on the wall is exactly what the disc lets through.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };

// Two gobo patterns, as open shapes inside a unit disc.
const patA = () => [`<circle r="0.17"/>`, ...[0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="0" cy="-0.52" rx="0.13" ry="0.27" transform="rotate(${a})"/>`),
  ...Array.from({ length: 12 }, (_, i) => `<circle cx="${(0.86 * Math.sin(i * Math.PI / 6)).toFixed(3)}" cy="${(-0.86 * Math.cos(i * Math.PI / 6)).toFixed(3)}" r="0.065"/>`)].join('');
const patB = () => [...Array.from({ length: 10 }, (_, i) => `<path d="M -0.05 -0.2 L 0.05 -0.2 L 0.11 -0.9 L -0.11 -0.9 Z" transform="rotate(${i * 36})"/>`), `<circle r="0.1"/>`].join('');

const tGobo = wordAt(beats.stencil, /^gobo/), tLight = beats.block.start + 0.1, tLens = wordAt(beats.lens, /^lens/), tThrow = wordAt(beats.lens, /^throws/);
const tSpin = wordAt(beats.takeaway, /^spin/), tSwap = wordAt(beats.takeaway, /^swap/);
const angleAt = t => 55 * Math.max(0, t - tSpin);              // degrees, spinning from the word "spin"

// Layout: side view on top, two front views below.
const SY = 600, LX = 130, GX = 300, NX = 420, WX = 1000;
const G = { x: 260, y: 1095, r: 110 }, P = { x: 735, y: 1095, r: 200 };
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <defs>
    <radialGradient id="lampG"><stop offset="0" stop-color="${C.ivory}"/><stop offset="0.6" stop-color="${C.brass}" stop-opacity="0.6"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0"/></radialGradient>
    <linearGradient id="beamG" x1="0" x2="1"><stop offset="0" stop-color="${C.ivory}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0.18"/></linearGradient>
    <clipPath id="gClip"><circle r="1"/></clipPath>
  </defs>
  <!-- Side view -->
  <g id="side" opacity="0">
    <rect x="${LX - 70}" y="${SY - 90}" width="${NX - LX + 120}" height="180" rx="16" fill="none" stroke="${C.grey}" stroke-opacity="0.5" stroke-width="2"/>
    <circle id="lamp" cx="${LX}" cy="${SY}" r="56" fill="url(#lampG)" opacity="0.2"/>
    <circle cx="${LX}" cy="${SY}" r="16" fill="${C.ivory}"/>
    <polygon id="feed" points="${LX},${SY - 10} ${GX},${SY - 60} ${GX},${SY + 60} ${LX},${SY + 10}" fill="url(#beamG)" opacity="0"/>
    <line x1="${GX}" y1="${SY - 70}" x2="${GX}" y2="${SY + 70}" stroke="${C.grey}" stroke-width="10" stroke-dasharray="18 10"/>
    <ellipse cx="${NX}" cy="${SY}" rx="16" ry="66" fill="none" stroke="${C.ivory}" stroke-width="4"/>
    <polygon id="throw" points="${NX},${SY - 40} ${WX},${SY - 150} ${WX},${SY + 150} ${NX},${SY + 40}" fill="url(#beamG)" opacity="0"/>
    <line x1="${WX}" y1="${SY - 170}" x2="${WX}" y2="${SY + 170}" stroke="${C.ivory}" stroke-width="5"/>
  </g>
  <!-- Front view of the gobo: a metal disc with the pattern cut out -->
  <g id="front" opacity="0" transform="translate(${G.x} ${G.y})">
    <circle r="${G.r + 18}" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="3"/>
    <g id="gPat" transform="scale(${G.r})"><g class="pA" fill="${C.obsidian}">${patA()}</g><g class="pB" fill="${C.obsidian}" opacity="0">${patB()}</g></g>
    <g id="gLit" transform="scale(${G.r})" opacity="0"><g class="pA" fill="${C.ivory}">${patA()}</g><g class="pB" fill="${C.ivory}" opacity="0">${patB()}</g></g>
  </g>
  <!-- The wall, with the projected pattern -->
  <g id="wall" opacity="0" transform="translate(${P.x} ${P.y})">
    <rect x="${-P.r - 30}" y="${-P.r - 30}" width="${2 * P.r + 60}" height="${2 * P.r + 60}" rx="12" fill="${C.charcoal}" stroke="${C.grey}" stroke-opacity="0.5" stroke-width="2"/>
    <circle r="${P.r}" fill="${C.ivory}" fill-opacity="0.03"/>
    <g id="proj" transform="scale(${P.r})" opacity="0"><g class="pA" fill="${C.ivory}">${patA()}</g><g class="pB" fill="${C.ivory}" opacity="0">${patB()}</g></g>
  </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-note va-label" id="nLamp" style="text-align:center;border-left:none;padding:6px 10px"><b>Lamp</b></div>
  <div class="va-note va-label" id="nGobo" style="text-align:center;border-left:none;padding:6px 10px"><b>Gobo</b></div>
  <div class="va-note va-label" id="nLens" style="text-align:center;border-left:none;padding:6px 10px"><b>Lens</b></div>
  <div class="va-note va-label" id="nWall" style="text-align:center;border-left:none;padding:6px 10px"><b>Wall</b></div>
  <div class="va-note va-label" id="nG" style="text-align:center;border-left:none;padding:6px 10px"><b>The gobo</b><br>A few cm across</div>
  <div class="va-note va-label" id="nP" style="text-align:center;border-left:none;padding:6px 10px"><b>On the wall</b><br>Much bigger</div>
  <div class="va-tag left" id="tagR"><span class="va-label">Gobo rotation</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagG"><span class="va-label">Pattern</span><span class="val"></span><div class="bar"><i style="width:100%"></i></div></div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const sideA = ramp(t, beats.stencil.start, beats.stencil.start + 0.6) * end;
  const frontA = ramp(t, tGobo - 0.3, tGobo + 0.4) * end;
  const light = ramp(t, tLight, tLight + 0.6);
  const thrown = ramp(t, tThrow - 0.2, tThrow + 0.6);
  const swap = ramp(t, tSwap - 0.1, tSwap + 0.5);
  $s('side').setAttribute('opacity', sideA);
  $s('lamp').setAttribute('opacity', 0.2 + 0.8 * light); $s('feed').setAttribute('opacity', light);
  $s('throw').setAttribute('opacity', thrown);
  $s('front').setAttribute('opacity', frontA);
  $s('gLit').setAttribute('opacity', light);
  $s('wall').setAttribute('opacity', ramp(t, tLens - 0.3, tLens + 0.3) * end);
  $s('proj').setAttribute('opacity', thrown * 0.95);
  const a = angleAt(t);
  for (const id of ['gPat', 'gLit']) $s(id).setAttribute('transform', `scale(${G.r}) rotate(${a})`);
  $s('proj').setAttribute('transform', `scale(${P.r}) rotate(${a})`);
  stage.querySelectorAll('.pA').forEach(e => e.setAttribute('opacity', 1 - swap));
  stage.querySelectorAll('.pB').forEach(e => e.setAttribute('opacity', swap));

  at($('nLamp'), LX, SY + 128); at($('nGobo'), GX, SY + 128); at($('nLens'), NX, SY + 128); at($('nWall'), WX - 20, SY + 200, 'translate(-100%, -50%)');
  for (const id of ['nLamp', 'nGobo', 'nLens', 'nWall']) $(id).style.opacity = sideA;
  at($('nG'), G.x, G.y - G.r - 70); $('nG').style.opacity = frontA;
  at($('nP'), P.x, P.y - P.r - 80); $('nP').style.opacity = ramp(t, tLens - 0.3, tLens + 0.3) * end;
  const tagA = ramp(t, tSpin - 0.3, tSpin + 0.3) * end;
  $('tagR').style.opacity = tagA; $('tagG').style.opacity = tagA;
  $('tagR').querySelector('.val').textContent = Math.round(a % 360) + '°'; $('tagR').querySelector('i').style.width = (a % 360) / 360 * 100 + '%';
  $('tagG').querySelector('.val').textContent = swap > 0.5 ? 'B' : 'A';
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
