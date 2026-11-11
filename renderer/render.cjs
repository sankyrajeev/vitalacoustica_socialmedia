// Post -> MP4. Opens the post's scene in headless Chromium, steps it frame by frame
// (so the result is identical on every run), and encodes with the narration track.
// Usage: node renderer/render.cjs posts/<id>            full video -> posts/<id>/video.mp4
//        node renderer/render.cjs posts/<id> --still 3,12,25   PNG stills -> posts/<id>/build/
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const postRel = path.relative(root, path.resolve(args[0] || '')).split(path.sep).join('/');
const postDir = path.join(root, postRel);
const stillAt = args.includes('--still') ? args[args.indexOf('--still') + 1].split(',').map(Number) : null;
const FPS = 30, W = 1080, H = 1920;
const spec = JSON.parse(fs.readFileSync(path.join(postDir, 'spec.json'), 'utf8'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/scenes/${spec.scene}/index.html?post=${postRel}`);
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  const duration = await page.evaluate('window.videoDuration');

  if (stillAt) {
    for (const t of stillAt) {
      await page.evaluate(t => window.renderFrame(t), t);
      const out = path.join(postDir, 'build', `still-${String(t).padStart(5, '0')}.png`);
      await page.screenshot({ path: out }); console.log(out);
    }
  } else {
    const out = path.join(postDir, 'video.mp4'), frames = Math.round(duration * FPS);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-i', path.join(postDir, 'build', 'voice.wav'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(duration), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg exited ' + c)) : res()));
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      await page.evaluate(t => window.renderFrame(t), i / FPS);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log(`frame ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await done;
    console.log(`${out}  ${duration}s  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  }
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
