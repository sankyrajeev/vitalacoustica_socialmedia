# Vital Acoustica — Social Media Agent Blueprint

Status: **draft v0.1** — nothing is built yet. This document is the plan we agree on before writing code.

## 1. Goal

An agent ("the manager") that runs Vital Acoustica's social media end to end:

| Job | What it means in practice |
|---|---|
| **Create** | One post per day: an educational or product video (code-rendered 3D / motion / physics), caption, hashtags, thumbnail |
| **Schedule & post** | Queue each post at the best time per network, publish automatically |
| **Analyze** | Pull performance daily, write a weekly report, learn what works |
| **Find competitors** | Discover and track similar accounts, spot their outlier posts |
| **Find keywords** | Track which topics, keywords and hashtags are performing, feed them into the next week's plan |

Everything follows a fixed **template system** (section 5) so the feed looks like one brand, not 30 random posts.

## 2. Company profile

- **Vital Acoustica** — sound and lighting rental and production, with the crew to run it; d&b audiotechnik systems, beam and LED lighting
- Tagline: *Sound is felt. Light is experienced.*
- Five disciplines: **Sound, Light, Visuals, Production, Installations**
- Events: club nights, concerts, festivals, brand events, private celebrations — **Karnataka** for now
- Software and hardware launching soon: **VANTA** (synth plugin), **VANTA Dynamics**, **ORBIT** (mixing system), **Lumière Link** (lighting that follows the DJ), **Lumière Resident** (venue lighting box), plus merch, audio packs and VJ loops
- Website: https://vitalacoustica.com · Instagram, X: @vitalacoustica

Details: [`brand/company.md`](brand/company.md) (services, full equipment list, products, voice) · [`brand/brand-kit.md`](brand/brand-kit.md) (colours, fonts, logos) · [`brand/tokens.css`](brand/tokens.css) (the same values for the renderer).

## 3. Architecture

```mermaid
flowchart LR
    subgraph Research
        K[Keyword & trend scan]
        C[Competitor tracker]
    end
    subgraph Planning
        P[Weekly content calendar]
    end
    subgraph Production
        S[Script + storyboard]
        V[Video renderer<br/>3D / motion / physics]
        Q[Quality gate]
    end
    subgraph Distribution
        A[Approval queue]
        X[Schedule & publish]
    end
    subgraph Learning
        M[Analytics pull]
        R[Weekly report + playbook update]
    end
    K --> P
    C --> P
    P --> S --> V --> Q --> A --> X --> M --> R --> P
```

The agent is **Claude Code running on a schedule in this repository**. The repo is its memory: brand rules, templates, the calendar, every post it made, and every metric it pulled are files here. Each scheduled run reads state, does one job, commits the result.

### Tools

| Capability | Tool | Status |
|---|---|---|
| Scheduling, publishing, analytics, best time to post | **Metricool** — brand "Vital Acoustica" | Connected: Instagram, YouTube, LinkedIn. X to be added |
| Competitor tracking | **Metricool** competitors (Instagram, YouTube) | Available once competitors are added to the brand |
| Keyword and trend research | **Web search** + our own post analytics + industry news (FOH Online, ProSoundWeb, already linked from the site journal) | Available |
| Video rendering | **Code in this repo** — Three.js (3D) + a physics engine + GSAP (motion), rendered headless to MP4 | To build (phase 1) |
| Voiceover | **ElevenLabs** API (key stored on the cloud environment, never in the repo) | Connected and tested: text-to-speech works. The key cannot list voices or read quota |
| Stills, thumbnails | **OpenArt** | Connected, used sparingly |

vidIQ is **not used**: the account is unavailable, so nothing in this plan depends on it.

### Why code-rendered video

"Simple 3D, motion and physics" is exactly what a browser scene can do deterministically: a sound wave leaving a speaker, two subs cancelling, a beam hitting a surface. Each video is a small HTML scene driven by a JSON spec, so the agent can produce a new one daily by changing data, not by re-inventing a video. It costs no generation credits and is always on-brand.

## 4. Content strategy

### Pillars

| Pillar | Share | Examples |
|---|---|---|
| **Sound explained** | 30% | Why a cardioid sub array keeps bass off the stage (B22-SUB) · point source vs. line array (V10P) · phase cancellation · inverse-square law · room modes · why tuning matters |
| **Light explained** | 20% | Why haze makes beams visible · beam angle vs. throw · blinders on the drop · cold vs. warm white · pixel mapping |
| **Know-how for organisers** | 20% | How much PA for 300 people · what a tech rider is · what "delivery, setup and tuning" involves · the four-step hire process |
| **Gear close-ups** | 10% | One item from the rental list per post, as a 3D turntable with what it is for |
| **Coming soon: software and shop** | 10% | Teasers for VANTA, ORBIT, Lumière Link, Lumière Resident — tease only until launch |
| **Proof and story** | 10% | Event recaps, testimonials, the founders' story (needs real footage from the team) |

### Weekly rhythm (draft)

| Day | Slot |
|---|---|
| Mon | Sound explained |
| Tue | Know-how for organisers |
| Wed | Light explained |
| Thu | Gear close-up |
| Fri | Sound explained (trend- or question-led) |
| Sat | Proof and story (real footage; falls back to know-how) |
| Sun | Coming-soon teaser, or myth vs. fact |

Reels and Shorts get the same vertical video. LinkedIn gets the organiser and installation posts with a longer, more professional caption. X gets a short text version with the clip.

## 5. Template system

### Video template (vertical 9:16, 20–40 s, voiceover + on-screen text)

| Beat | Time | Content |
|---|---|---|
| **Hook** | 0–2 s | One question or claim on screen ("Why do two subs get *quieter*?") |
| **Setup** | 2–8 s | The scene appears: speakers, room, fixture |
| **Demo** | 8–28 s | The physics plays out — waves, particles, beams, with 2–3 labels |
| **Takeaway** | 28–35 s | One sentence to remember |
| **Closing card** | last 3 s | Logo, a "follow for more" line, handle — nothing else |

Fixed across every video: Obsidian background, Ivory text, Brass as the single accent (wave fronts, beams, highlights), Instrument Serif hooks with italic emphasis, Manrope capitals for labels, logo position, caption safe zones, intro/outro sting, one consistent narrator voice.

### Scene library (reusable building blocks)

`product-3d` (models of the real rental gear) · `wave-propagation` · `interference` · `line-array-coverage` · `sub-array-polar` · `room-modes` · `beam-cone` · `colour-mix` · `dmx-signal-chain` · `product-turntable` · `number-comparison`

A daily post = one scene + a spec file:

```json
{
  "scene": "interference",
  "hook": "Why do two subs get quieter?",
  "params": { "sources": 2, "spacing_m": 1.7, "freq_hz": 100 },
  "labels": ["Peak meets trough", "Cancellation zone"],
  "takeaway": "Spacing is half a wavelength at 100 Hz — move them together.",
  "outro": "Follow for more *sound, explained.*"
}
```

### Caption template

```
[Hook line — restates the question]

[2–3 short lines of explanation]

[Practical tip tied to rental or product]

[Follow line]

[5–8 hashtags: 2 brand, 3 topic, 2–3 from keyword research]
```

Voice: calm, confident, plain sentences, no hype and no exclamation marks — see `brand/company.md`.

Videos and captions end with a follow line ("Follow @vitalacoustica for more"), not a sales ask: no "get a quote" and no "link in bio".

## 6. Operating loops

| Loop | When | What the agent does | Output |
|---|---|---|---|
| **Daily produce** | Every day, early | Take today's calendar slot → write spec → render video → quality gate → send to approval queue / schedule | `posts/YYYY-MM-DD/` |
| **Daily measure** | Every day, late | Pull metrics for posts from the last 7 days | `analytics/daily/` |
| **Weekly plan** | Sunday | Analytics review + web keyword scan + competitor posts that over-performed → next week's calendar | `calendar/YYYY-Www.md`, `reports/weekly/` |
| **Monthly research** | 1st of month | Refresh competitor list, pillar performance, keyword bank; propose strategy changes | `research/`, `reports/monthly/` |

### Quality gate (before anything is queued)

- Video renders, correct duration and resolution, no clipped text in safe zones
- Physics claim checked against the fact sheet in `brand/facts.md` (no wrong numbers going out under the company name)
- Caption follows template, no banned words, hashtags within limits
- Not a near-duplicate of a post from the last 60 days

### Approval

Start with **the owner approving every post** (Metricool's review flow), move to autopilot per pillar once a pillar has two clean weeks. Proof & people posts always need approval because they involve real clients.

## 7. Repository layout

```
brand/          company.md, voice.md, palette + logo, facts.md, banned.md
templates/      video beat templates, caption templates
scenes/         reusable 3D/physics scenes (HTML + JS)
renderer/       spec → MP4 pipeline
calendar/       weekly plans
posts/          one folder per post: spec, video, caption, post IDs
research/       competitors.md, keywords.md, trend notes
analytics/      raw daily metric pulls
reports/        weekly and monthly reports
playbook.md     what the agent has learned (updated weekly)
.claude/        skills for each loop (produce, measure, plan, research)
```

## 8. Build phases

| Phase | Deliverable | Done when |
|---|---|---|
| **0. Foundations** | Brand files, accounts connected, platforms chosen | Section 10 questions answered |
| **1. Renderer spike** | One scene (`interference`) rendered to a 30 s vertical MP4 from a spec | Video plays correctly on a phone and looks on-brand |
| **2. Template system** | Beat template, brand card, 4 scenes, caption generator | 7 varied videos produced from specs alone |
| **3. Publish path** | Spec → render → approval → scheduled post | One real post goes live through the pipeline |
| **4. Research** | Competitor list, keyword bank, weekly plan loop | Agent writes next week's calendar unaided |
| **5. Analytics & learning** | Daily pulls, weekly report, playbook updates | Report explains what worked and changes the plan |
| **6. Automation** | Scheduled runs for all four loops | A full week runs with approvals only |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Technically wrong explainer damages credibility with audio professionals | Fact sheet + quality gate; approval stays on for physics content until trusted |
| Feed feels repetitive | Scene library grows monthly; duplicate check; Saturday slot uses real footage |
| Media hosting — schedulers need a public URL for each video | Resolve in phase 3 (to be tested, not yet verified) |
| No dedicated keyword tool (vidIQ unavailable) | Web search plus our own analytics; revisit if research proves too thin |
| Platform rate limits / API changes | Metricool as the single publishing layer; failures reported, never silently skipped |
| Real footage dependence for "Proof & people" | Shared folder the team drops clips into; slot falls back to a know-how post if empty |

## 10. Decisions and open items

### Decided

| Topic | Decision |
|---|---|
| Platforms | Instagram Reels and YouTube Shorts first, LinkedIn alongside (all three connected in Metricool); X once it is added to Metricool |
| Research | No vidIQ — Metricool competitors, web search and our own analytics |
| Market | Karnataka for now — posting times and local keywords follow from this |
| Approval | The owner approves every post |
| Audio | Voiceover on every video |
| Brand | Kit and logo files recorded in `brand/` |
| Language | English only |
| YouTube | A Vital Acoustica channel exists for Shorts |

### Still open

1. **Narrator voice.** Pick one ElevenLabs voice to use on every video.
2. **X.** The site links an X profile; add it to the Vital Acoustica brand in Metricool when ready.
3. **Competitors.** A starting list of 5–10 accounts to track (other Karnataka rental houses, plus international accounts whose content style we like). The agent can propose one.
4. **Real footage.** Where the team will drop event clips for the Saturday slot.
