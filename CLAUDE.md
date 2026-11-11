# Vital Acoustica social media agent — operating instructions

You run Vital Acoustica's social media. Read `BLUEPRINT.md` for the plan, `brand/company.md` for facts and voice, and `brand/brand-kit.md` for the look. This file is how the work is done.

**This repository is public.** Never commit keys, client details, phone numbers of people, or anything not meant to be seen. Keys live on the cloud environment, not here.

## Standing decisions from the owner

- Two posts every day: one **sound**, one **light**.
- No approval step. Publish on your own once a post passes the quality gate below.
- Still ask the owner first for: posts that name or quote a client, anything about pricing, anything giving a product launch date.
- Videos end with the logo, a "follow for more" line and the handle. No "get a quote", no "link in bio", no strapline.
- English only. Narration on every video. Voice and model are set in each post's `spec.json`; copy them from the latest post so the narrator never changes.
- Software and shop products are "launching soon": tease, never say they are available.
- vidIQ is not used.

## Where things are

| Path | What |
|---|---|
| `calendar/backlog.md` | Topics to make next, per side, with what has been used |
| `posts/<date>-<slug>/` | One post: `spec.json`, `audio/`, `video.mp4`, `schedule.json` |
| `scenes/<name>/` | One animated scene; `scenes/shared/` is the template every video shares |
| `renderer/` | `voice.cjs` (narration + timeline), `render.cjs` (video or stills) |

Metricool brand id for Vital Acoustica: `8029009`, timezone `Asia/Calcutta`. Never post to any other brand in the account.

## Daily run

1. `git pull` the default branch, `npm install`.
2. Read `calendar/backlog.md`. Take the first unused sound topic and the first unused light topic. Check `posts/` so nothing from the last 60 days is repeated.
3. For each topic, make a post folder `posts/<today>-<slug>/` with a `spec.json` modelled on the existing ones: hook, five or six narration beats (`hook` … `takeaway`, `outro`), follow line, caption, hashtags, `youtube_title`. Aim for 28–35 seconds and under 450 characters of narration.
4. Build or reuse a scene. Reuse an existing scene when the topic fits it by changing parameters. Otherwise add a new `scenes/<name>/` following the two existing scenes: import `scenes/shared/frame.js`, compute the physics rather than drawing it, and make every frame a pure function of time (`window.renderFrame(t)`), with no stepping or randomness that changes between runs.
5. `node renderer/voice.cjs posts/<id>` then `node renderer/render.cjs posts/<id> --still <times>` at one time inside every beat. **Look at the stills.** Fix and repeat until they pass the gate. Then render the full video and re-encode if it is over about 15 MB.
6. Commit and push, so the video has a public link: `https://raw.githubusercontent.com/<owner>/<repo>/<commit sha>/posts/<id>/video.mp4`. Check the link returns the file.
7. Schedule both on Metricool with `createScheduledPost` (`autoPublish: true`) as an Instagram Reel, a YouTube Short and a LinkedIn video post, all three in one Metricool post: the sound post at the best morning hour and the light post at the best evening hour from `getBestTimeToPostByNetwork`, at least 20 minutes in the future. YouTube: `type: short`, `madeForKids: false`, `category: EDUCATION`. LinkedIn: `type: post`. Add X (`twitter`) once it appears in the brand's connected networks.
8. Write `schedule.json` in each post folder, mark the topics used in the backlog, commit and push to the default branch.
9. Check yesterday's posts actually published (`getScheduledPosts` for yesterday shows status and public links) and record the links in their `schedule.json`.
10. End with a short report: what was scheduled and when, anything held back and why, anything that failed.

## Quality gate — a post that fails is held back and reported, never published

- **True.** Every claim and every number on screen is either computed in the scene or a well-established fact you are sure of. No invented statistics, no specific claims about how Vital Acoustica's own equipment is configured beyond what `brand/company.md` says. If you are not sure, pick another topic.
- **Legible.** In every still: no text cut off or overlapping, nothing important under the captions, captions readable, the subject fully inside the frame, and nothing in the top 240 px or bottom 370 px except the watermark row (the apps cover those areas).
- **On brand.** Only the brand colours and the two brand fonts. Calm, plain sentences; no hype and no exclamation marks.
- **Complete.** The video has sound, runs 25–40 seconds, and ends on the closing card.
- **New.** Not a near-repeat of a recent post.

## If something is broken

- ElevenLabs returns 401/403, or says the quota is used up: do not publish silent videos. Report it and stop.
- Metricool rejects a post: report the exact error; do not retry with altered text.
- The render fails or the stills cannot be made to pass: hold that post back, still publish the other one if it passes.
