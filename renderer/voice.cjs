// Spec -> narration. Calls ElevenLabs once per beat (cached by text hash), then
// builds one voice track and a timeline with word timings that the scene reads.
// Usage: node renderer/voice.cjs posts/<id>
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const postDir = path.resolve(process.argv[2] || '');
if (!fs.existsSync(path.join(postDir, 'spec.json'))) { console.error('usage: voice.cjs posts/<id>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(path.join(postDir, 'spec.json'), 'utf8'));
const audioDir = path.join(postDir, 'audio'), buildDir = path.join(postDir, 'build');
fs.mkdirSync(audioDir, { recursive: true }); fs.mkdirSync(buildDir, { recursive: true });
const { voice_id, model_id } = spec.voice;
const GAP = 0.35; // default pause after each line, seconds

function synth(beat) {
  const hash = crypto.createHash('sha1').update([voice_id, model_id, beat.say].join('|')).digest('hex').slice(0, 10);
  const base = path.join(audioDir, `${beat.id}-${hash}`);
  if (!fs.existsSync(base + '.json')) {
    // The API key is injected by the environment's network proxy; curl honours the proxy settings.
    const body = JSON.stringify({ text: beat.say, model_id });
    const out = execFileSync('curl', ['-sS', '--fail-with-body', '-m', '120', '-X', 'POST',
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/with-timestamps?output_format=mp3_44100_128`,
      '-H', 'xi-api-key: ' + (process.env.ELEVENLABS_API_KEY || 'proxy-injected'),
      '-H', 'Content-Type: application/json', '-d', body], { maxBuffer: 1 << 28 });
    const res = JSON.parse(out.toString());
    if (!res.audio_base64) throw new Error('ElevenLabs: ' + out.toString().slice(0, 300));
    fs.writeFileSync(base + '.mp3', Buffer.from(res.audio_base64, 'base64'));
    fs.writeFileSync(base + '.json', JSON.stringify(res.alignment));
    console.log('synthesised', beat.id);
  } else console.log('cached     ', beat.id);
  const a = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
  const words = []; let cur = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { cur = null; return; }
    if (!cur) { cur = { w: '', s: a.character_start_times_seconds[i], e: 0 }; words.push(cur); }
    cur.w += ch; cur.e = a.character_end_times_seconds[i];
  });
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', base + '.mp3']).toString());
  return { file: base + '.mp3', words, dur };
}

let t = 0; const beats = [], inputs = [];
for (const b of spec.beats) {
  const { file, words, dur } = synth(b);
  const start = t, speech = start + (b.lead || 0), end = speech + dur + (b.hold ?? GAP);
  beats.push({ id: b.id, start, speech, end, words: words.map(w => ({ w: w.w, s: +(w.s + speech).toFixed(3), e: +(w.e + speech).toFixed(3) })) });
  inputs.push({ file, at: speech });
  t = end;
}
const duration = +t.toFixed(3);
const args = ['-y', '-v', 'error'];
inputs.forEach(i => args.push('-i', i.file));
const filt = inputs.map((i, n) => `[${n}:a]adelay=${Math.round(i.at * 1000)}:all=1[a${n}]`).join(';') +
  ';' + inputs.map((_, n) => `[a${n}]`).join('') + `amix=inputs=${inputs.length}:normalize=0,apad,atrim=0:${duration},loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
args.push('-filter_complex', filt, '-map', '[out]', '-ar', '48000', path.join(buildDir, 'voice.wav'));
execFileSync('ffmpeg', args);
fs.writeFileSync(path.join(buildDir, 'timeline.json'), JSON.stringify({ duration, beats }, null, 1));
console.log(`timeline: ${duration}s, ${beats.length} beats, ${spec.beats.reduce((n, b) => n + b.say.length, 0)} characters of narration`);
