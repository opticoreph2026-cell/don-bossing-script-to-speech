# Don Bossing — Filipino Billionaire Script-to-Speech

An app that converts your script into the voice of a **Filipino male billionaire fluent in Tagalog**, built for faceless YouTube content on **Sikolohiya ng Pera, Diskarte, at Buhay Pinoy** (Applied Psychology + Money for a Filipino audience).

Model: **Faceless** — bundle a voiceover, thumbnail ideas, and B-roll prompts all in one studio.

## Features

- **Natural human voice (free, no key)** — Microsoft Edge neural TTS with two **Tagalog-fluent** voices: `fil-PH-AngeloNeural` (Filipino male) and `fil-PH-BlessicaNeural` (Filipino female). No API key, no credits, no limits.
- **More Filipino characters via Google Cloud (optional)** — add up to **10 more Tagalog-fluent Google voices** (`fil-PH` Standard/WaveNet/Neural2, 6 female + 4 male) by setting a `GOOGLE_TTS_API_KEY`. Generous free tier (4M chars/month Standard, 1M WaveNet/Neural2).
- **6 voice personas (emotions)** — Confident Billionaire, Calm Executive, Tough Love Direct, Engaging Storyteller, Suspenseful Reveal, and Warm Brotherly Advice, each with its own natural prosody (pitch/rate/volume). One persona + one intensity apply uniformly to the whole script.
- **4 vocal intensity levels** — Subtle/Secret Tone, Normal Dialogue, High Energy/Hook, and Explosive Boss Energy, layered on top of the persona for mood-rich delivery.
- **3 preset topics** — Sikolohiya ng Pera, Diskarte, and Buhay Pinoy with ready-made Tagalog scripts, thumbnail ideas, and B-roll prompts. Custom topics also supported.
- **Line-by-line editor** — reorder, adjust pauses, add visual prompts per line. Voice and emotion stay uniform from the global persona + intensity settings.
- **Full voice control** — every voice (Edge or Google) with pitch, rate, and volume sliders, plus a **Reset** button to restore defaults. Browser TTS is kept as an automatic offline fallback.
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

### Enabling the Google Filipino voices

1. In [Google Cloud Console](https://console.cloud.google.com), create a project, enable the **Cloud Text-to-Speech** API, and create an **API key** (APIs & Services → Credentials). A billing account is required for quotas; the monthly free allowances (Standard 4M chars, WaveNet/Neural2 1M chars) are usually enough.
2. Add the key to Vercel: `vercel env add GOOGLE_TTS_API_KEY` (pick `production`).
3. Redeploy (`vercel --prod`). The voice dropdown then shows the extra Google Tagalog voices; without the key it keeps the two free Edge voices.

## Downloading a `.wav` voiceover

1. Click **Record & Download .wav**.
2. The app generates every line with Edge TTS, joins them with your per-line pauses, and downloads `Don_Bossing_voiceover.wav` — no share-screen prompt.

## Tips

- For the most natural Tagalog, keep the **Angelo (Filipino Male)** voice selected and dial the Pitch slider down slightly.
- Personas + intensities combine: e.g. **Tough Love Direct** + **Explosive Boss Energy** for hard-hitting hooks, **Calm Executive** + **Subtle/Secret** for suspenseful reveals.
- Longform mode adds an intro; Shorts mode keeps it tight for retention.
- The whole script uses one uniform voice and emotion — pick your persona + intensity once at the top and every line follows it.
- Use **Reset Voice & Emotion** in the Voice & Emotion card to restore the default persona, intensity, voice, and sliders at any time.

## Local AI Video Generator (Section 6) — free, $0

Section 6 turns a sequence of storyboard images into an animated video (each image → a ~4s clip, concatenated into a 2–15 min MP4). It runs **locally** because Vercel has no GPU. The diffusion runs on a **free Kaggle P100 GPU** via ComfyUI, orchestrated by a small Node server on your PC.

**Architecture:** `index.html` → `server.js` (your PC, port 3000) → ComfyUI on Kaggle (stable public tunnel) → ffmpeg concat → final MP4.

**Why $0:** Kaggle gives a free P100 (16 GB, ~30 GPU-hrs/week). Only **CogVideoX‑5B‑I2V** (quantized) fits; **HunyuanVideo** is disabled by default in `video.config.json` (needs ~24 GB) and auto‑disables if attempted. Not "unlimited" — re‑launch the notebook when the weekly quota/session ends. With a **reserved ngrok subdomain the tunnel URL is stable**, so you set `comfyUrl` once and rarely touch it again.

### Setup
1. **Install ffmpeg** (free) on your PC: `winget install ffmpeg` (or download from gyan.dev), ensure `ffmpeg` is on PATH.
2. **Stable tunnel (one‑time):** create a free [ngrok](https://ngrok.com) account, copy your authtoken, and pick a subdomain (e.g. `donbossing-video`). In the Kaggle notebook: *Add-ons → Secrets* → add `NGROK_AUTHTOKEN` and `NGROK_SUBDOMAIN`. (No‑signup alternative: pinggy.io — URL may rotate each restart.)
3. **Kaggle notebook:** open `comfy/kaggle_setup.ipynb`, set accelerator to **GPU P100**, run all cells. It installs ComfyUI + wrappers, downloads CogVideoX weights, launches ComfyUI, and prints a stable `https://<subdomain>.ngrok-free.app` URL.
4. Paste that URL into `video.config.json` → `comfyUrl` (or set env `VIDEO_COMFY_URL`). Set once.
5. On your PC: `npm run local`, then open `http://localhost:3000`.
6. In Section 6: drop images (storyboard), optionally add an English motion prompt per image, pick model + seconds/image, click **Generate Video**. Watch live progress; the final MP4 plays and downloads. If ComfyUI is down, Section 6 shows an "unreachable" warning.

### Notes / tuning
- **Prompts are English‑only** (model limit). Motion prompts like *"gentle cinematic motion, slight camera drift"* animate the image; the Tagalog audio is added separately (visuals‑only output).
- **Workflow templates:** `comfy/cogvideox_i2v.json` and `comfy/hunyuan_i2v.json` are best‑effort graphs `server.js` auto‑fills (image, prompt, frames, resolution, fps). If a model fails to run, export your own working graph from ComfyUI (Menu → Export API Format) and overwrite the file — `server.js` injects by input key, so it keeps working.
- **Long videos:** 15 min = 225 clips; at quantized CogVideoX on a P100, budget minutes per clip → many hours. The job runs as a background batch with live progress.
- Your PC (low RAM, no GPU) only does light orchestration + ffmpeg concat, so keep resolution ≤480p.
