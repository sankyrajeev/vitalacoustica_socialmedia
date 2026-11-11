# Vital Acoustica — social media agent

The plan is in [BLUEPRINT.md](BLUEPRINT.md). Brand rules and company facts are in [brand/](brand/).

## Making a video

Each post is a folder in `posts/` with a `spec.json`: the scene to use, the hook, the narration line by line, the caption and hashtags.

```bash
npm install
```

```bash
node renderer/voice.cjs posts/2026-11-12-cardioid-subs
```

```bash
node renderer/render.cjs posts/2026-11-12-cardioid-subs
```

- `voice.cjs` turns the narration into speech with ElevenLabs and writes the timeline (when each word is spoken). Lines are cached in `posts/<id>/audio/`, so re-running costs nothing unless the text changes. The API key is supplied by the cloud environment; it is never stored in this repository.
- `render.cjs` plays the scene frame by frame in a headless browser and writes `posts/<id>/video.mp4` (1080×1920, 30 fps). Add `--still 8,19` to get PNG stills at those seconds instead.

## Layout

| Path | What it holds |
|---|---|
| `brand/` | Brand kit, logos, colour and font tokens, company profile |
| `scenes/shared/` | The template every video shares: watermark, hook, captions, brand card |
| `scenes/<name>/` | One reusable animated scene |
| `renderer/` | Narration and rendering scripts |
| `posts/<id>/` | One post: spec, narration audio, finished video |
