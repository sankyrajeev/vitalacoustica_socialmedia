// Footage edit. Plays a pre-cut, beat-aligned plate (posts/<id>/build/frames/NNNN.jpg,
// made from the owner's clip) under the shared brand frame: watermark, hook, captions
// and closing card come from frame.js. Adds title cards from the spec, a slow push-in
// on every shot, and a short zoom punch on the drop.
import { loadPost, Frame, clamp, ramp, lerp } from '../shared/frame.js';

const post = await loadPost();
const { spec, beats } = post;
const P = spec.params, FPS = P.fps, T = 60 / P.bpm;
const postDir = new URLSearchParams(location.search).get('post');
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { obsidian: css('--va-obsidian') };

// Segment boundaries in frames, rounded at the cumulative edges (as the plate was cut).
const bounds = [0]; let cum = 0;
for (const [, b] of P.segments) { cum += b; bounds.push(Math.round(cum * T * FPS)); }
const NFR = bounds[bounds.length - 1];
const tDrop = P.music.drop_in_edit_s;

const stage = document.getElementById('stage');
stage.innerHTML = `
  <div id="wrap" style="position:absolute;inset:0;overflow:hidden;background:${C.obsidian}">
    <img id="img" style="position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover;transform-origin:50% 45%">
  </div>
  <div style="position:absolute;left:0;right:0;top:0;height:640px;background:linear-gradient(to bottom, rgba(16,16,16,0.82), rgba(16,16,16,0))"></div>`;
const img = stage.querySelector('#img');

const ui = document.getElementById('ui');
const mark = s => s.replace(/\*(.+?)\*/g, '<em>$1</em>');
ui.insertAdjacentHTML('beforeend', P.titles.map((x, i) => `<div class="va-heading tt" id="tt${i}" style="position:absolute;left:80px;right:80px;top:270px;font-size:92px;line-height:1.04;opacity:0">${mark(x.text)}</div>`).join(''));
const frame = new Frame(ui, post);
const tts = [...ui.querySelectorAll('.tt')];

let lastSrc = '';
async function renderFrame(t) {
  const f = clamp(Math.floor(t * FPS), 0, NFR - 1);
  let seg = 0; while (seg < bounds.length - 2 && f >= bounds[seg + 1]) seg++;
  const segT = (f - bounds[seg]) / Math.max(1, bounds[seg + 1] - bounds[seg]);
  const punch = 0.07 * Math.exp(-Math.max(0, t - tDrop) / 0.18) * (t >= tDrop ? 1 : 0);
  img.style.transform = `scale(${1.02 + 0.05 * segT + punch})`;
  const src = `/${postDir}/build/frames/${String(f + 1).padStart(4, '0')}.jpg`;
  if (src !== lastSrc) { img.src = src; lastSrc = src; await img.decode().catch(() => {}); }
  P.titles.forEach((x, i) => {
    const a = ramp(t, x.from, x.from + 0.35) * (1 - ramp(t, x.to - 0.35, x.to));
    tts[i].style.opacity = a; tts[i].style.transform = `translateY(${lerp(24, 0, a)}px)`;
  });
  frame.update(t);
}

await frame.ready();
window.renderFrame = renderFrame;
window.videoDuration = post.timeline.duration;
await renderFrame(0);
window.__ready = true;
