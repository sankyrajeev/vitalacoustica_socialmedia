// Downlight vs uplight, in cross-section. Each fixture is a point source whose intensity falls
// off as cos^n from its aim. Illuminance on floor, walls and ceiling is computed directly
// (2D section: E ∝ I·cos(incidence)/d) and shown as surface brightness. The tags give the share
// of the emitted light that lands on each kind of surface, found by casting rays.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const hex = s => s.match(/\w\w/g).map(h => parseInt(h, 16));
const mixc = (a, b, x) => { const A = hex(a), B = hex(b); return A.map((v, i) => v + (B[i] - v) * x); };
const tone = v => { const c = v < 0.6 ? mixc(C.obsidian, C.brass, v / 0.6) : mixc(C.brass, C.ivory, (v - 0.6) / 0.4); return `rgb(${c.map(Math.round).join(',')})`; };

const W = spec.params.room_w_m, H = spec.params.room_h_m;
const deg = Math.PI / 180;
const DOWN = [2.25, 4.5, 6.75].map(x => ({ p: [x, H - 0.08], a: -90 * deg, n: 8 }));
const UP = [{ p: [0.35, 0.08], a: 101 * deg, n: 6 }, { p: [W - 0.35, 0.08], a: 79 * deg, n: 6 }];
const TABLES = [[2.5, 0.75, 1.5], [6.5, 0.75, 1.5]];     // centre x, height, width

const tOff = wordAt(beats.up, /^put/i), tOn = wordAt(beats.up, /^pointing/i), tBoth = wordAt(beats.takeaway, /^both/i);
const kDown = t => 1 - ramp(t, tOff, tOff + 1) + 0.75 * ramp(t, tBoth, tBoth + 1);
const kUp = t => ramp(t, tOn, tOn + 1.2);

function E(px, py, nx, ny, kd, ku) {
  let e = 0;
  for (const [set, k] of [[DOWN, kd], [UP, ku]]) {
    if (k <= 0) continue;
    for (const s of set) {
      const dx = px - s.p[0], dy = py - s.p[1], d = Math.hypot(dx, dy); if (d < 1e-3) continue;
      const c = (dx * Math.cos(s.a) + dy * Math.sin(s.a)) / d; if (c <= 0) continue;
      const inc = -(dx * nx + dy * ny) / d; if (inc <= 0) continue;
      e += k * c ** s.n * inc / d;
    }
  }
  return e;
}
// Share of emitted light reaching floor (incl. table tops) vs walls and ceiling, by ray casting.
function shares(set) {
  let floor = 0, rest = 0;
  for (const s of set) for (let i = 0; i < 721; i++) {
    const phi = (i / 720 - 0.5) * Math.PI, w = Math.cos(phi) ** s.n, a = s.a + phi, dx = Math.cos(a), dy = Math.sin(a);
    let tMin = Infinity, hit = '';
    const test = (tt, h) => { if (tt > 1e-6 && tt < tMin) { tMin = tt; hit = h; } };
    if (dy < 0) test(-s.p[1] / dy, 'floor'); if (dy > 0) test((H - s.p[1]) / dy, 'rest');
    if (dx < 0) { const tt = -s.p[0] / dx, y = s.p[1] + dy * tt; if (y >= 0 && y <= H) test(tt, 'rest'); }
    if (dx > 0) { const tt = (W - s.p[0]) / dx, y = s.p[1] + dy * tt; if (y >= 0 && y <= H) test(tt, 'rest'); }
    if (hit === 'floor') floor += w; else if (hit) rest += w;
  }
  return { floor, rest };
}
const SD = shares(DOWN), SU = shares(UP);

const S = 88.9, RX = 140, FY = 1150;
const sx = x => RX + x * S, sy = y => FY - y * S;
const NSEG = 120, T = 22, GL = 120;
const surf = [];
for (let i = 0; i < NSEG; i++) { const x = (i + 0.5) / NSEG * W; surf.push({ kind: 'f', x, y: 0, nx: 0, ny: 1, r: [sx(i / NSEG * W), sy(0), S * W / NSEG + 0.6, T] }); surf.push({ kind: 'c', x, y: H, nx: 0, ny: -1, r: [sx(i / NSEG * W), sy(H) - T, S * W / NSEG + 0.6, T] }); }
for (let i = 0; i < NSEG / 2; i++) { const y = (i + 0.5) / (NSEG / 2) * H, y1 = (i + 1) / (NSEG / 2) * H; surf.push({ kind: 'w', x: 0, y, nx: 1, ny: 0, r: [sx(0) - T, sy(y1), T, S * H / (NSEG / 2) + 0.6] }); surf.push({ kind: 'w', x: W, y, nx: -1, ny: 0, r: [sx(W), sy(y1), T, S * H / (NSEG / 2) + 0.6] }); }

const cone = s => { const L = 6, h = Math.acos(0.5 ** (1 / s.n)); return [s.p, [s.p[0] + L * Math.cos(s.a - h), s.p[1] + L * Math.sin(s.a - h)], [s.p[0] + L * Math.cos(s.a + h), s.p[1] + L * Math.sin(s.a + h)]]; };
const clipPoly = pts => pts.map(([x, y]) => `${sx(clamp(x, 0, W)).toFixed(1)},${sy(clamp(y, 0, H)).toFixed(1)}`).join(' ');
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <defs>
  ${[['gF', 0, 1, 0, 0], ['gC', 0, 0, 0, 1], ['gL', 0, 0, 1, 0], ['gR', 1, 0, 0, 0]].map(([id, x1, y1, x2, y2]) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`).join('')}
  <mask id="mF" maskUnits="userSpaceOnUse"><rect x="${sx(0)}" y="${sy(0) - GL}" width="${W * S}" height="${GL}" fill="url(#gF)"/></mask>
  <mask id="mC" maskUnits="userSpaceOnUse"><rect x="${sx(0)}" y="${sy(H)}" width="${W * S}" height="${GL}" fill="url(#gC)"/></mask>
  <mask id="mL" maskUnits="userSpaceOnUse"><rect x="${sx(0)}" y="${sy(H)}" width="${GL}" height="${H * S}" fill="url(#gL)"/></mask>
  <mask id="mR" maskUnits="userSpaceOnUse"><rect x="${sx(W) - GL}" y="${sy(H)}" width="${GL}" height="${H * S}" fill="url(#gR)"/></mask>
  <clipPath id="room"><rect x="${sx(0)}" y="${sy(H)}" width="${W * S}" height="${H * S}"/></clipPath></defs>
 <g id="all">
  <rect x="${sx(0)}" y="${sy(H)}" width="${W * S}" height="${H * S}" fill="${C.obsidian}"/>
  <g clip-path="url(#room)">
   ${DOWN.map((s, i) => `<polygon class="cd" points="${clipPoly(cone(s))}" fill="${C.ivory}"/>`).join('')}
   ${UP.map(s => `<polygon class="cu" points="${clipPoly(cone(s))}" fill="${C.ivory}"/>`).join('')}
  </g>
  <g mask="url(#mF)">${surf.filter(s => s.kind === 'f').map(s => `<rect class="gl" data-i="${surf.indexOf(s)}" x="${s.r[0].toFixed(1)}" y="${sy(0) - GL}" width="${s.r[2].toFixed(1)}" height="${GL}"/>`).join('')}</g>
  <g mask="url(#mC)">${surf.filter(s => s.kind === 'c').map(s => `<rect class="gl" data-i="${surf.indexOf(s)}" x="${s.r[0].toFixed(1)}" y="${sy(H)}" width="${s.r[2].toFixed(1)}" height="${GL}"/>`).join('')}</g>
  <g mask="url(#mL)">${surf.filter(s => s.kind === 'w' && s.x === 0).map(s => `<rect class="gl" data-i="${surf.indexOf(s)}" x="${sx(0)}" y="${s.r[1].toFixed(1)}" width="${GL}" height="${s.r[3].toFixed(1)}"/>`).join('')}</g>
  <g mask="url(#mR)">${surf.filter(s => s.kind === 'w' && s.x === W).map(s => `<rect class="gl" data-i="${surf.indexOf(s)}" x="${sx(W) - GL}" y="${s.r[1].toFixed(1)}" width="${GL}" height="${s.r[3].toFixed(1)}"/>`).join('')}</g>
  <g id="surf">${surf.map(s => `<rect x="${s.r[0].toFixed(1)}" y="${s.r[1].toFixed(1)}" width="${s.r[2].toFixed(1)}" height="${s.r[3].toFixed(1)}"/>`).join('')}</g>
  ${TABLES.map(([x, h, w]) => `<rect class="tt" x="${sx(x - w / 2)}" y="${sy(h) - 8}" width="${w * S}" height="10" rx="3"/><line x1="${sx(x)}" y1="${sy(h)}" x2="${sx(x)}" y2="${sy(0)}" stroke="${C.grey}" stroke-width="5"/>`).join('')}
  ${DOWN.map(s => `<path d="M ${sx(s.p[0]) - 22} ${sy(H)} L ${sx(s.p[0]) + 22} ${sy(H)} L ${sx(s.p[0]) + 12} ${sy(H) + 18} L ${sx(s.p[0]) - 12} ${sy(H) + 18} Z" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="2"/>`).join('')}
  ${UP.map(s => `<rect x="${sx(s.p[0]) - 16}" y="${sy(0) - 22}" width="32" height="22" rx="4" fill="${C.charcoal}" stroke="${C.ivory}" stroke-width="2"/>`).join('')}
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const glows = [...stage.querySelectorAll('.gl')].map(r => [r, +r.dataset.i]);
const rects = [...$s('surf').children], cds = [...stage.querySelectorAll('.cd')], cus = [...stage.querySelectorAll('.cu')], tts = [...stage.querySelectorAll('.tt')];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagF"><span class="va-label">Light landing on floor</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagW"><span class="va-label">On walls and ceiling</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nC" style="text-align:center;border-left:none;padding:6px 10px">Ceiling</div>
  <div class="va-note va-label" id="nW" style="text-align:center;border-left:none;padding:6px 10px">Wall</div>
  <div class="va-note va-label" id="nF" style="text-align:center;border-left:none;padding:6px 10px">Floor</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };
const E0 = 0.55;

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  const kd = kDown(t), ku = kUp(t);
  const cols = surf.map(s => tone(1 - Math.exp(-E(s.x, s.y, s.nx, s.ny, kd, ku) / E0)));
  cols.forEach((c, i) => rects[i].setAttribute('fill', c)); glows.forEach(([r, i]) => r.setAttribute('fill', cols[i]));
  TABLES.forEach(([x, h], i) => tts[i].setAttribute('fill', tone(1 - Math.exp(-E(x, h, 0, 1, kd, ku) / E0))));
  cds.forEach(c => c.setAttribute('opacity', 0.07 * kd)); cus.forEach(c => c.setAttribute('opacity', 0.07 * ku));
  const fl = kd * SD.floor + ku * SU.floor, re = kd * SD.rest + ku * SU.rest, tot = fl + re;
  const show = ramp(t, beats.down.start, beats.down.start + 0.6) * end;
  $('tagF').style.opacity = show; $('tagW').style.opacity = show;
  const pf = tot > 0 ? Math.round(100 * fl / tot) : 0;
  $('tagF').querySelector('.val').textContent = pf + '%'; $('tagF').querySelector('i').style.width = pf + '%';
  $('tagW').querySelector('.val').textContent = (100 - pf) + '%'; $('tagW').querySelector('i').style.width = (100 - pf) + '%';
  at($('nC'), 540, sy(H) - 40); at($('nW'), sx(W) + 50, sy(H / 2)); at($('nF'), 540, sy(0) + 54);
  for (const id of ['nC', 'nW', 'nF']) $(id).style.opacity = show;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
