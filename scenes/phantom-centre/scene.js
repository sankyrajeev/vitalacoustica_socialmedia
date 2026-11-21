// Phantom centre, seen from above. Two speakers play the same voice. With equal levels the
// image sits midway; a level difference moves it (stereophonic tangent law); standing
// off-centre makes the nearer speaker arrive first, and once that lead passes about 1 ms the
// image is drawn at the nearer speaker (precedence effect). Arrival times come from distance.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const P = spec.params, SX = P.speaker_x_m, LY = P.listener_y_m, C0 = P.speed_of_sound;

const S = 100, OX = 540, OY = 620;                        // 1 m = 100 px; speaker line at OY
const scr = (x, y) => [OX + x * S, OY + y * S];

const tPanUp = wordAt(beats.pan, /^up/i), tPanBack = beats.off.start + 0.1;
const tMove = wordAt(beats.off, /^stand/i);
const panDb = t => P.pan_db * (ramp(t, tPanUp - 0.2, tPanUp + 0.8) - ramp(t, tPanBack, tPanBack + 0.8));
const lx = t => P.listener_off_m * ramp(t, tMove, tMove + 1.6);

// Arrival-time lead (ms) of the right speaker over the left for a listener at (x, LY).
const lead = x => (Math.hypot(x + SX, LY) - Math.hypot(x - SX, LY)) / C0 * 1000;
// Half-width of the strip where both arrive within 1 ms.
let band = 0; while (lead(band) < 1) band += 0.005;

function imageX(t) {
  const x = lx(t), gR = 10 ** (panDb(t) / 20), gL = 1;
  // Tangent law, relative to the listener's view of the pair.
  const phi0 = Math.atan(SX / LY), phi = Math.atan((gR - gL) / (gR + gL) * Math.tan(phi0));
  const levelX = LY * Math.tan(phi);
  const w = clamp(Math.abs(lead(x)) / 1.0);               // precedence takes over past ~1 ms
  return lerp(levelX, Math.sign(lead(x)) * SX, w);
}

const [Lx, Ly] = scr(-SX, 0), [Rx, Ry] = scr(SX, 0);
const NR = 5, RMAX = 560;
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <defs><clipPath id="below"><rect x="0" y="${OY + 30}" width="1080" height="${(LY + 1.2) * S}"/></clipPath></defs>
  <g id="all">
  <rect id="band" y="${OY + 70}" height="${(LY + 1.3) * S - 70}" fill="${C.brass}" opacity="0"/>
  <g clip-path="url(#below)"><g id="ringsL"></g><g id="ringsR"></g></g>
  ${[[Lx, Ly], [Rx, Ry]].map(([x, y]) => `<g transform="translate(${x} ${y})"><rect x="-55" y="-70" width="110" height="100" rx="10" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/><rect x="-40" y="22" width="80" height="10" rx="3" fill="${C.ivory}"/></g>`).join('')}
  <line id="ray" stroke="${C.brass}" stroke-width="3" stroke-dasharray="10 10"/>
  <g id="img"><circle r="46" fill="${C.brass}" opacity="0.25"/><circle r="26" fill="${C.brass}"/>
    <path d="M -10 -8 L -10 8 M -3 -14 L -3 14 M 4 -6 L 4 6 M 11 -11 L 11 11" stroke="${C.obsidian}" stroke-width="4" stroke-linecap="round"/></g>
  <g id="head"><circle r="42" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    <path d="M -12 -40 L 0 -60 L 12 -40" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="-52" y="-12" width="12" height="24" rx="5" fill="${C.ivory}"/><rect x="40" y="-12" width="12" height="24" rx="5" fill="${C.ivory}"/></g>
  </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
for (const side of ['ringsL', 'ringsR']) for (let k = 0; k < NR; k++) $s(side).insertAdjacentHTML('beforeend', `<circle class="r" fill="none" stroke="${C.brass}" stroke-width="3"/>`);
const ringsL = [...$s('ringsL').children], ringsR = [...$s('ringsR').children];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagP"><span class="va-label">Right side level</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagA"><span class="va-label">Arrives first</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nL" style="text-align:center;border-left:none;padding:6px 10px">Left</div>
  <div class="va-note va-label" id="nR" style="text-align:center;border-left:none;padding:6px 10px">Right</div>
  <div class="va-note va-label" id="nImg" style="text-align:center;border-left:none;padding:6px 10px"><b>Where you hear the voice</b></div>
  <div class="va-note va-label" id="nYou" style="text-align:center;border-left:none;padding:6px 10px">You</div>
  <div class="va-note va-label" id="nBand" style="text-align:center;border-left:none;padding:6px 10px">Both arrive within 1 ms</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  const play = ramp(t, beats.equal.start, beats.equal.start + 0.6) * end;
  const db = panDb(t), gR = 10 ** (db / 20);
  const ring = (els, x, y, g) => els.forEach((c, k) => {
    const r = ((t * 150 + k * RMAX / NR) % RMAX);
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r);
    c.setAttribute('opacity', play * (1 - r / RMAX) * 0.45 * Math.min(1, g / 2 + 0.5));
    c.setAttribute('stroke-width', 2 + 1.5 * g);
  });
  ring(ringsL, Lx, Ly + 30, 1); ring(ringsR, Rx, Ry + 30, gR);

  const x = lx(t), [hx, hy] = scr(x, LY);
  $s('head').setAttribute('transform', `translate(${hx} ${hy})`);
  const imgOn = ramp(t, wordAt(beats.centre, /^hears/i) - 0.3, wordAt(beats.centre, /^hears/i) + 0.5) * end;
  const [ix, iy] = scr(imageX(t), 1.6);
  $s('img').setAttribute('transform', `translate(${ix} ${iy})`); $s('img').setAttribute('opacity', imgOn);
  $s('ray').setAttribute('x1', hx); $s('ray').setAttribute('y1', hy - 62); $s('ray').setAttribute('x2', ix); $s('ray').setAttribute('y2', iy + 50);
  $s('ray').setAttribute('opacity', imgOn * 0.8);

  const bOn = ramp(t, wordAt(beats.takeaway, /^stereo/i) - 0.2, wordAt(beats.takeaway, /^stereo/i) + 0.6) * end;
  $s('band').setAttribute('x', OX - band * S); $s('band').setAttribute('width', 2 * band * S); $s('band').setAttribute('opacity', 0.18 * bOn);

  const show = ramp(t, beats.equal.start + 0.2, beats.equal.start + 0.8) * end;
  $('tagP').style.opacity = show; $('tagA').style.opacity = show;
  $('tagP').querySelector('.val').textContent = (db >= 0.05 ? '+' : '') + db.toFixed(1).replace('-0.0', '0.0') + ' dB';
  $('tagP').querySelector('i').style.width = clamp(db / P.pan_db) * 100 + '%';
  const ms = lead(x);
  $('tagA').querySelector('.val').textContent = ms < 0.05 ? 'Together' : `Right, ${ms.toFixed(1)} ms`;
  $('tagA').querySelector('i').style.width = clamp(ms / 8) * 100 + '%';
  at($('nL'), Lx, Ly - 105); at($('nR'), Rx, Ry - 105);
  at($('nImg'), ix, iy - 82); at($('nYou'), hx, hy + 78);
  at($('nBand'), OX, OY + (LY + 1.3) * S + 30);
  for (const id of ['nL', 'nR', 'nYou']) $(id).style.opacity = show;
  $('nImg').style.opacity = imgOn; $('nBand').style.opacity = bOn;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
