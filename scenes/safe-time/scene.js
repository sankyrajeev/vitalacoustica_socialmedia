// Safe listening time. Reference: 85 dB(A) for 8 hours; every 3 dB louder halves the time
// (NIOSH recommended exposure limit). Each row's bar is the safe time at that level, drawn
// to the same scale, so each step is half the one above.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';
import { wordAt } from '../shared/words.js';

const post = await loadPost();
const { spec, beats } = post;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian'), charcoal: css('--va-charcoal'), ivory: css('--va-ivory'), brass: css('--va-brass'), grey: css('--va-grey') };
const P = spec.params, L = P.levels;
const hours = db => P.ref_hours / 2 ** ((db - P.ref_db) / P.exchange_db);
const fmt = h => h >= 1 ? `${+h.toFixed(1)} h` : `${Math.round(h * 60)} min`;

const reveal = [wordAt(beats.ref, /^eighty/i), wordAt(beats.halve, /^four/i), wordAt(beats.halve, /^two/i), wordAt(beats.halve, /^one/i),
  beats.loud.start, wordAt(beats.loud, /^hundred/i)];
const X0 = 230, BW = 640, Y0 = 640, DY = 110;
const stage = document.getElementById('stage');
stage.innerHTML = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0">
 <g id="all">
  ${L.map((db, i) => `<g class="row" transform="translate(0 ${Y0 + i * DY})">
    <text x="${X0 - 24}" y="12" text-anchor="end" font-family="Instrument Serif" font-size="44" fill="${C.ivory}">${db} dB</text>
    <rect x="${X0}" y="-22" width="${BW}" height="44" rx="6" fill="${C.charcoal}"/>
    <rect class="bar" x="${X0}" y="-22" height="44" rx="6" fill="${C.brass}"/>
    <text class="tt" y="12" font-family="Manrope" font-size="30" font-weight="600" fill="${C.ivory}">${fmt(hours(db))}</text></g>`).join('')}
  <rect id="hl" x="${X0 - 160}" width="${BW + 190}" height="76" rx="12" fill="none" stroke="${C.ivory}" stroke-width="3"/>
 </g>
</svg>`;
const $s = id => stage.querySelector('#' + id);
const rows = [...stage.querySelectorAll('.row')];

const ui = document.getElementById('ui');
ui.insertAdjacentHTML('beforeend', `
  <div class="va-tag left" id="tagL"><span class="va-label">Level</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-tag right" id="tagT"><span class="va-label">Safe for about</span><span class="val"></span><div class="bar"><i></i></div></div>
  <div class="va-note va-label" id="nG" style="text-align:center;border-left:none;padding:6px 10px">Guideline: 85 dB for 8 hours a day, halving every 3 dB</div>`);
const frame = new Frame(ui, post);
const $ = id => ui.querySelector('#' + id);
const at = (el, x, y, tf = 'translate(-50%, -50%)') => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = tf; };

function renderFrame(t) {
  const end = 1 - ramp(t, beats.outro.start - 0.2, beats.outro.start + 0.2);
  $s('all').setAttribute('opacity', ramp(t, beats.hook.end - 0.6, beats.hook.end) * end);
  let cur = -1;
  rows.forEach((r, i) => {
    const k = ramp(t, reveal[i] - 0.2, reveal[i] + 0.6); if (t >= reveal[i] - 0.2) cur = i;
    r.setAttribute('opacity', k);
    const w = Math.max(6, BW * hours(L[i]) / P.ref_hours) * k;
    r.querySelector('.bar').setAttribute('width', w);
    const tt = r.querySelector('.tt'); tt.setAttribute('x', X0 + Math.max(6, BW * hours(L[i]) / P.ref_hours) + 16);
    if (i === 0) { tt.setAttribute('x', X0 + BW - 16); tt.setAttribute('text-anchor', 'end'); tt.setAttribute('fill', C.obsidian); }
  });
  const ci = Math.max(0, cur);
  $s('hl').setAttribute('y', Y0 + ci * DY - 38); $s('hl').setAttribute('opacity', cur >= 0 ? 1 : 0);
  const show = ramp(t, beats.ref.start, beats.ref.start + 0.6) * end;
  $('tagL').style.opacity = show; $('tagT').style.opacity = show;
  $('tagL').querySelector('.val').textContent = `${L[ci]} dB`; $('tagL').querySelector('i').style.width = (L[ci] - 80) / 20 * 100 + '%';
  $('tagT').querySelector('.val').textContent = fmt(hours(L[ci])); $('tagT').querySelector('i').style.width = hours(L[ci]) / 8 * 100 + '%';
  at($('nG'), 540, Y0 + L.length * DY - 20); $('nG').style.opacity = show;
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
renderFrame(0);
window.__ready = true;
