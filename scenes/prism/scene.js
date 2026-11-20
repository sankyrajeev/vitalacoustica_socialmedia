// A rotating prism. One beam leaves the lens; a glass prism with N angled faces swings in
// front of it, and each face sends part of the light off in its own direction, so N beams
// land on the floor around a circle. Turning the prism turns that circle. Seen in
// perspective: floor spots sit on an ellipse, beams towards the back are drawn dimmer.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const N = spec.params.facets;

const tIn = wordAt(beats.glass, /^prism/i);
const tSplit = wordAt(beats.split, /^several/i);
const tSpin = wordAt(beats.rotate, /^spin/i);
const tHaze = wordAt(beats.takeaway, /^haze/i);
const W = 60 * Math.PI / 180;                       // spin speed, rad/s
const theta = t => { const u = t - tSpin, d = 1; return u <= 0 ? 0 : W * (u < d ? u * u / (2 * d) : u - d / 2); };

const LENS = [540, 640], FLOOR = [540, 1230], R = 270, YF = 0.28;
const INSET = [850, 520], IR = 95;

const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ivory}" stop-opacity="0.9"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0.35"/></linearGradient>
    <radialGradient id="sg"><stop offset="0" stop-color="${C.ivory}" stop-opacity="0.95"/><stop offset="0.6" stop-color="${C.brass}" stop-opacity="0.6"/><stop offset="1" stop-color="${C.brass}" stop-opacity="0"/></radialGradient>
  </defs>
  <g id="base"><ellipse cx="${FLOOR[0]}" cy="${FLOOR[1]}" rx="${R + 130}" ry="${(R + 130) * YF}" fill="none" stroke="${C.grey}" stroke-opacity="0.35" stroke-width="2"/>
  </g><g id="spots"></g>
  <g id="beams"></g>
  <!-- Fixture head -->
  <g id="fix" transform="translate(${LENS[0]} ${LENS[1]})">
    <path d="M -120 -150 L 120 -150 L 120 -40 L -120 -40 Z" fill="none" stroke="${C.grey}" stroke-width="4"/>
    <rect x="-80" y="-120" width="160" height="110" rx="18" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="3"/>
    <rect x="-60" y="-14" width="120" height="16" rx="6" fill="${C.ivory}"/>
  </g>
  <!-- Prism in front of the lens -->
  <g id="prism"><path d="M -54 0 L 54 0 L 40 24 L -40 24 Z" fill="${C.ivory}" fill-opacity="0.25" stroke="${C.ivory}" stroke-width="3"/></g>
  <!-- Front view of the prism -->
  <g id="inset" transform="translate(${INSET[0]} ${INSET[1]})">
    <circle r="${IR}" fill="${C.charcoal}" stroke="${C.grey}" stroke-width="2"/>
    <g id="faces"></g>
  </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
for (let k = 0; k < N; k++) {
  $s('beams').insertAdjacentHTML('beforeend', `<polygon class="beam" fill="url(#bg)"/>`);
  $s('spots').insertAdjacentHTML('beforeend', `<ellipse class="spot" fill="url(#sg)"/>`);
  $s('faces').insertAdjacentHTML('beforeend', `<path class="face" stroke="${C.ivory}" stroke-width="3" stroke-linejoin="round"/>`);
}
const beamEls = [...stage.querySelectorAll('.beam')], spotEls = [...stage.querySelectorAll('.spot')], faceEls = [...stage.querySelectorAll('.face')];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagB"><span class="va-label">Beams</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagR"><span class="va-label">Prism rotation</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nFix"><b>Fixture</b></div>
  <div class="va-note va-label" id="nPrism" style="text-align:center;border-left:none;padding:6px 10px">Prism, seen from the front</div>
  <div class="va-note va-label" id="nFloor" style="text-align:center;border-left:none;padding:6px 10px">Floor</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  const on = ramp(t, beats.hook.end - 0.4, beats.hook.end + 0.2) * end;  // beam switches on after the hook
  const pin = ramp(t, tIn, tIn + 0.9);                                   // prism swung in
  const sp = ramp(t, tSplit - 0.2, tSplit + 0.9);                        // split spread
  const th = theta(t);
  const base = ramp(t, beats.hook.end - 0.6, beats.hook.end) * end;
  $s('fix').setAttribute('opacity', base); $s('base').setAttribute('opacity', base);
  const haze = lerp(0.45, 0.85, ramp(t, tHaze, tHaze + 1));

  // The prism slides in from the side, in front of the lens.
  $s('prism').setAttribute('transform', `translate(${lerp(LENS[0] + 260, LENS[0], pin)} ${LENS[1] + 6})`);
  $s('prism').setAttribute('opacity', clamp(pin * 3) * end);

  // Beams: with the prism in, N copies, each tilted outward by sp; otherwise one.
  const n = sp > 0.01 ? N : 1;
  const list = [];
  for (let k = 0; k < N; k++) {
    const a = th + 2 * Math.PI * k / N - Math.PI / 2;
    const r = R * sp;
    const x = FLOOR[0] + r * Math.cos(a), y = FLOOR[1] + r * YF * Math.sin(a);
    const depth = Math.sin(a);                          // +1 front, -1 back
    list.push({ k, x, y, depth });
  }
  list.sort((p, q) => p.depth - q.depth);
  list.forEach((p, i) => {
    const b = beamEls[i], s = spotEls[i];
    const share = n === 1 ? 1 : lerp(1, 1 / N, sp);     // each copy carries part of the light
    const vis = (p.k < n ? 1 : 0) * on;
    const dim = 0.72 + 0.28 * (p.depth + 1) / 2;
    const sx = p.x, sy = p.y, rx = 62, w0 = 9;
    const dx = sx - LENS[0], dy = sy - LENS[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const pts = [[LENS[0] + nx * w0, LENS[1] + 10 + ny * w0], [sx + nx * rx, sy + ny * rx * YF], [sx - nx * rx, sy - ny * rx * YF], [LENS[0] - nx * w0, LENS[1] + 10 - ny * w0]];
    b.setAttribute('points', pts.map(q => q.join(',')).join(' '));
    b.setAttribute('opacity', vis * haze * dim * lerp(1, 0.75, 1 - share));
    s.setAttribute('cx', sx); s.setAttribute('cy', sy); s.setAttribute('rx', rx); s.setAttribute('ry', rx * YF);
    s.setAttribute('opacity', vis * dim * lerp(1, 0.8, 1 - share));
  });

  // Front view of the prism: N faces meeting in the middle, turning with it.
  const inShow = ramp(t, tIn - 0.2, tIn + 0.6) * end;
  $s('inset').setAttribute('opacity', inShow);
  faceEls.forEach((f, k) => {
    const a0 = th + 2 * Math.PI * k / N - Math.PI / 2 - Math.PI / N, a1 = a0 + 2 * Math.PI / N, r = IR - 18;
    f.setAttribute('d', `M 0 0 L ${r * Math.cos(a0)} ${r * Math.sin(a0)} L ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`);
    f.setAttribute('fill', k === 0 ? C.brass : C.ivory); f.setAttribute('fill-opacity', k === 0 ? 0.55 : 0.12 + 0.08 * k);
  });

  const show = ramp(t, beats.glass.start + 0.2, beats.glass.start + 0.8) * end;
  $('tagB').style.opacity = show; $('tagR').style.opacity = show;
  const nb = sp > 0.5 ? N : 1;
  $('tagB').querySelector('.val').textContent = String(nb); $('tagB').querySelector('i').style.width = (nb / N) * 100 + '%';
  const deg = Math.round(th * 180 / Math.PI) % 360;
  $('tagR').querySelector('.val').textContent = deg + '°'; $('tagR').querySelector('i').style.width = (deg / 360) * 100 + '%';
  at($('nFix'), LENS[0] - 150, LENS[1] - 175, 'translate(0, -50%)'); $('nFix').style.opacity = show;
  at($('nPrism'), INSET[0], INSET[1] + IR + 30); $('nPrism').style.opacity = inShow;
  at($('nFloor'), FLOOR[0], FLOOR[1] + (R + 130) * YF + 34); $('nFloor').style.opacity = show;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
