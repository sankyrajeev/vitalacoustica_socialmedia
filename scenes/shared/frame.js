// Shared frame for every Vital Acoustica video: loads the post, and draws the parts
// of the template that never change (watermark, hook, captions, brand card).
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ramp = (t, a, b) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
export const lerp = (a, b, x) => a + (b - a) * x;
export const easeOutBounce = x => {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
};
const mark = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*(.+?)\*/g, '<em>$1</em>');

export async function loadPost() {
  const post = new URLSearchParams(location.search).get('post');
  const [spec, timeline] = await Promise.all([
    fetch(`/${post}/spec.json`).then(r => r.json()),
    fetch(`/${post}/build/timeline.json`).then(r => r.json()),
  ]);
  const beats = Object.fromEntries(timeline.beats.map(b => [b.id, b]));
  return { spec, timeline, beats };
}

export class Frame {
  constructor(ui, { spec, timeline, beats }) {
    this.spec = spec; this.timeline = timeline; this.beats = beats;
    ui.insertAdjacentHTML('beforeend', `
      <div class="va-floor"></div>
      <div class="va-dim"></div>
      <img class="va-mark" src="/brand/logo/mark-white.png">
      <div class="va-kicker va-label">Vital Acoustica &nbsp;·&nbsp; <b>${spec.kicker}</b></div>
      <div class="va-hook va-heading">${mark(spec.hook)}</div>
      <div class="va-takeaway va-heading">${mark(spec.takeaway || '')}</div>
      <div class="va-captions"><div></div></div>
      <div class="va-card">
        <img src="/brand/logo/wordmark-white.png">
        <div class="tagline va-heading">Sound is felt. <em>Light is experienced.</em></div>
        <div class="rule"></div>
        <div class="cta va-label">${spec.cta}</div>
        <div class="handle va-label">@vitalacoustica</div>
      </div>`);
    this.el = Object.fromEntries(['dim', 'hook', 'takeaway', 'captions', 'card'].map(k => [k, ui.querySelector('.va-' + k)]));
    // Caption chunks: a few words at a time, broken at punctuation, never across beats.
    this.chunks = [];
    for (const b of timeline.beats) {
      if (b.id === 'outro') continue;
      let cur = [];
      const flush = () => { if (cur.length) { this.chunks.push({ words: cur, s: cur[0].s, e: cur[cur.length - 1].e }); cur = []; } };
      for (const w of b.words) {
        cur.push(w);
        const len = cur.map(x => x.w).join(' ').length;
        if (/[.,?!]$/.test(w.w) || len > 22) flush();
      }
      flush();
    }
    this.chunks.forEach((c, i) => { const n = this.chunks[i + 1]; c.until = n ? Math.min(n.s, c.e + 0.6) : c.e + 0.6; });
    this.chunkShown = -1;
  }
  async ready() {
    await document.fonts.load('400 40px "Instrument Serif"'); await document.fonts.load('italic 400 40px "Instrument Serif"');
    await document.fonts.load('600 40px Manrope'); await document.fonts.load('400 40px Manrope');
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  }
  update(t) {
    const { beats, el } = this, hook = beats.hook, outro = beats.outro;
    // Hook: large over a dimmed scene, then it clears for the demo.
    const hookIn = ramp(t, 0.15, 0.75), hookOut = 1 - ramp(t, hook.end - 0.45, hook.end + 0.1);
    el.hook.style.opacity = hookIn * hookOut;
    el.hook.style.transform = `translateY(${lerp(40, 0, hookIn) - 60 * (1 - hookOut)}px)`;
    el.dim.style.opacity = 0.62 * hookOut;
    if (beats.takeaway) {
      const a = ramp(t, beats.takeaway.start + 1.7, beats.takeaway.start + 2.4) * (1 - ramp(t, outro.start - 0.3, outro.start + 0.1));
      el.takeaway.style.opacity = a; el.takeaway.style.transform = `translateY(${lerp(30, 0, a)}px)`;
    }
    // Captions follow the narration word by word.
    const i = this.chunks.findIndex(c => t >= c.s - 0.08 && t < c.until);
    const box = el.captions.firstElementChild;
    if (i !== this.chunkShown) {
      box.innerHTML = i < 0 ? '' : this.chunks[i].words.map(w => `<span>${w.w}</span>`).join(' ');
      this.chunkShown = i;
    }
    if (i >= 0) [...box.children].forEach((s, k) => s.classList.toggle('on', t >= this.chunks[i].words[k].s - 0.05));
    el.captions.style.opacity = 1 - ramp(t, hook.start, hook.start + 0.01) * (1 - ramp(t, hook.end - 0.2, hook.end)) ;
    // Brand card closes every video.
    const card = ramp(t, outro.start, outro.start + 0.6);
    el.card.style.opacity = card;
    el.card.firstElementChild.style.transform = `scale(${lerp(0.94, 1, ramp(t, outro.start, outro.start + 1.6))})`;
  }
}
