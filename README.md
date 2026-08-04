# Don Bossing — Filipino Billionaire Script-to-Speech

An app that converts your script into the voice of a **Filipino male billionaire fluent in Tagalog**, built for faceless YouTube content on **Sikolohiya ng Pera, Diskarte, at Buhay Pinoy** (Applied Psychology + Money for a Filipino audience).

Model: **Faceless** — bundle a voiceover, thumbnail ideas, and B-roll prompts all in one studio.

## Features

- **Natural human voice (free)** — uses Microsoft Edge neural TTS via a Vercel serverless function. Voice `fil-PH-AngeloNeural` is a natural-sounding Filipino male fluent in Tagalog. No API key, no credits, no limits.
- **6 voice personas (emotions)** — Confident Billionaire, Calm Executive, Tough Love Direct, Engaging Storyteller, Suspenseful Reveal, and Warm Brotherly Advice, each with its own natural prosody (pitch/rate/volume).
- **4 vocal intensity levels** — Subtle/Secret Tone, Normal Dialogue, High Energy/Hook, and Explosive Boss Energy, layered on top of the persona for mood-rich delivery.
- **3 preset topics** — Sikolohiya ng Pera, Diskarte, and Buhay Pinoy with ready-made Tagalog scripts, thumbnail ideas, and B-roll prompts. Custom topics also supported.
- **Line-by-line editor** — reorder, re-emotion, adjust pauses, add visual prompts per line.
- **Full voice control** — Edge Filipino voices (Angelo male, Blessica female) + English neural voices, with pitch, rate, and volume sliders. Browser TTS is kept as an automatic offline fallback.
- **Downloadable `.wav` voiceover** — directly generated from the Edge TTS audio (no screen-share needed) with your per-line pauses baked in.

## How to run

No Node.js or Python required for the static app.

**Option A — live app (recommended, natural voice):**
Open the deployed app and everything works — playback and `.wav` download use the free Edge TTS API.

**Option B — just open it locally (playback only, browser TTS fallback):**
Double-click `index.html`. Playback uses your OS browser voices (robotic); the Edge TTS natural voice is only available from the deployed app.

**Option C — local server:**
1. Right-click `start-server.ps1` → *Run with PowerShell* (or run `powershell -ExecutionPolicy Bypass -File start-server.ps1`).
2. It opens `http://localhost:8787` automatically (browser TTS fallback).

## Deploying the natural voice to Vercel

The natural voice comes from the serverless function in `api/tts.js` (uses the free `@andresaya/edge-tts` npm package). Deploy the repo root:

- Vercel auto-detects `api/` as serverless functions and runs `npm install` from `package.json`.
- `vercel.json` sets the function timeout to 30s.
- The frontend auto-detects the API on load; if it's missing (e.g. opening `index.html` from disk), it silently falls back to browser TTS.

## Downloading a `.wav` voiceover

1. Click **Record & Download .wav**.
2. The app generates every line with Edge TTS, joins them with your per-line pauses, and downloads `Don_Bossing_voiceover.wav` — no share-screen prompt.

## Tips

- For the most natural Tagalog, keep the **Angelo (Filipino Male)** voice selected and dial the Pitch slider down slightly.
- Personas + intensities combine: e.g. **Tough Love Direct** + **Explosive Boss Energy** for hard-hitting hooks, **Calm Executive** + **Subtle/Secret** for suspenseful reveals.
- Longform mode adds an intro; Shorts mode keeps it tight for retention.
- Every line can carry its own emotion + intensity for dynamic, mood-rich delivery.
