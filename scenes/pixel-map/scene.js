// Pixel mapping. 8 bars × 16 pixels. A "picture" is a brightness function over the rig;
// each pixel shows the picture's value at its own position. The faint grid behind the
// rig is the same picture drawn finely, so the mapping is visible.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const NB = spec.params.bars, NP = spec.params.pixels_per_bar, CH = spec.params.channels_per_pixel;

const X0 = 110, X1 = 970, Y0 = 600, Y1 = 1240;
const px = i => X0 + (i + 0.5) * (X1 - X0) / NP, py = j => Y0 + (j + 0.5) * (Y1 - Y0) / NB;

// Pictures, each a function of normalised position (u, v in 0..1) and time.
const blob = (u, v, cx, cy, r) => Math.exp(-((u - cx) ** 2 + ((v - cy) * 0.75) ** 2) / (r * r));
const pictures = {
  blob: (u, v, t) => blob(u, v, 0.5, 0.5, 0.26),
  orbit: (u, v, t) => blob(u, v, 0.5 + 0.3 * Math.cos(1.6 * t), 0.5 + 0.28 * Math.sin(1.6 * t), 0.22),
  wave: (u, v, t) => clamp(0.5 + 0.5 * Math.sin(2 * Math.PI * (1.1 * u + 0.45 * v) - 3.2 * t)) ** 2,
};
const tMap = wordAt(beats.map, /^picture/), tMove = beats.move.start + 0.2, tWave = wordAt(beats.move, /^waves/);
function picture(u, v, t) {
  const wBlob = ramp(t, tMap - 0.2, tMap + 0.6) * (1 - ramp(t, tMove, tMove + 0.6));
  const wOrbit = ramp(t, tMove, tMove + 0.6) * (1 - ramp(t, tWave - 0.2, tWave + 0.6));
  const wWave = ramp(t, tWave - 0.2, tWave + 0.6);
  return wBlob * pictures.blob(u, v, t) + wOrbit * pictures.orbit(u, v, t) + wWave * pictures.wave(u, v, t);
}
// Before the picture: each pixel set on its own, one after another.
const chase = (i, j, t) => { const head = (t - beats.pixels.start) * 22, k = j * NP + i, d = ((head - k) % (NB * NP) + NB * NP) % (NB * NP); return d < 7 ? 1 - d / 7 : 0; };

const stage = document.getElementById('stage');
const GX = 48, GY = 24;
let grid = '', bars = '', dots = '';
for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
  const w = (X1 - X0) / GX, h = (Y1 - Y0) / GY;
  grid += `<rect class="g" x="${(X0 + gx * w).toFixed(1)}" y="${(Y0 + gy * h).toFixed(1)}" width="${(w + 0.5).toFixed(1)}" height="${(h + 0.5).toFixed(1)}" fill="${C.ivory}" opacity="0"/>`;
}
for (let j = 0; j < NB; j++) {
  bars += `<rect x="${X0 - 14}" y="${py(j) - 30}" width="${X1 - X0 + 28}" height="60" rx="10" fill="${C.charcoal}" stroke="${C.grey}" stroke-opacity="0.6" stroke-width="2"/>`;
  for (let i = 0; i < NP; i++) dots += `<g><circle cx="${px(i)}" cy="${py(j)}" r="19" fill="${C.obsidian}" stroke="${C.grey}" stroke-opacity="0.5" stroke-width="1.5"/>
    <circle class="lit" cx="${px(i)}" cy="${py(j)}" r="17" fill="${C.brass}" opacity="0"/><circle class="core" cx="${px(i)}" cy="${py(j)}" r="10" fill="${C.ivory}" opacity="0"/></g>`;
}
stage.innerHTML = `<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <g>${bars}</g><g id="grid">${grid}</g><g>${dots}</g>
  <rect id="frameBox" x="${X0 - 30}" y="${Y0 - 30}" width="${X1 - X0 + 60}" height="${Y1 - Y0 + 60}" rx="16" fill="none" stroke="${C.brass}" stroke-width="3" stroke-dasharray="10 10" opacity="0"/>
</svg>`;
const gEls = [...stage.querySelectorAll('.g')], lit = [...stage.querySelectorAll('.lit')], core = [...stage.querySelectorAll('.core')];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagP"><span class="va-label">Pixels</span><span class="val">${NB * NP}</span><div class="bar"><i style="width:100%"></i></div></div>
  <div class="va-tag right" id="tagC"><span class="va-label">Desk channels</span><span class="val">${NB * NP * CH}</span><div class="bar"><i style="width:${NB * NP * CH / 512 * 100}%"></i></div></div>
  <div class="va-note va-label" id="nBar"><b>Pixel bar</b><br>${NP} LEDs, each on its own</div>
  <div class="va-note va-label" id="nPic"><b>The picture</b><br>Laid over the rig</div>
  <div class="va-note va-label" id="nCh">${CH} channels per pixel (RGB)<br>${NB * NP * CH} of one 512-channel universe</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(0, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const rigOn = ramp(t, beats.pixels.start, beats.pixels.start + 0.5);
  const chaseW = rigOn * (1 - ramp(t, tMap - 0.2, tMap + 0.3));
  const overlay = ramp(t, tMap - 0.2, tMap + 0.6) * (1 - 0.6 * ramp(t, beats.move.start + 2.5, beats.move.start + 3.5)) * end;
  gEls.forEach((g, k) => {
    const u = ((k % GX) + 0.5) / GX, v = (Math.floor(k / GX) + 0.5) / GY;
    g.setAttribute('opacity', 0.38 * overlay * picture(u, v, t));
  });
  for (let j = 0; j < NB; j++) for (let i = 0; i < NP; i++) {
    const k = j * NP + i, u = (i + 0.5) / NP, v = (j + 0.5) / NB;
    const b = clamp(Math.max(chaseW * chase(i, j, t), picture(u, v, t) * ramp(t, tMap + 0.3, tMap + 1.0))) * end;
    lit[k].setAttribute('opacity', 0.1 + 0.9 * b > 0.1 ? b : 0); core[k].setAttribute('opacity', b * b);
  }
  stage.querySelector('#frameBox').setAttribute('opacity', overlay);

  const tk = ramp(t, wordAt(beats.takeaway, /^numbers/) - 0.3, wordAt(beats.takeaway, /^numbers/) + 0.4) * end;
  $('tagP').style.opacity = ramp(t, beats.pixels.start + 0.3, beats.pixels.start + 0.9) * end;
  $('tagC').style.opacity = tk;
  $('nBar').style.opacity = rigOn * (1 - ramp(t, tMap - 0.4, tMap)); at($('nBar'), 540, Y0 - 70, 'translate(-50%, -50%)');
  $('nPic').style.opacity = ramp(t, tMap, tMap + 0.5) * (1 - ramp(t, beats.move.start + 1.5, beats.move.start + 2.2)); at($('nPic'), 540, Y0 - 76, 'translate(-50%, -50%)');
  $('nCh').style.opacity = tk; at($('nCh'), 540, Y1 + 72, 'translate(-50%, -50%)');
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
