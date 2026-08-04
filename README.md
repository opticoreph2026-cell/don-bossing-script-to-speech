# Don Bossing â€” Filipino Billionaire Script-to-Speech

An app that converts your script into the voice of a **Filipino male billionaire fluent in Tagalog**, built for faceless YouTube content on **Sikolohiya ng Pera, Diskarte, at Buhay Pinoy** (Applied Psychology + Money for a Filipino audience).

Model: **Faceless** â€” bundle a voiceover, thumbnail ideas, and B-roll prompts all in one studio.

## Features

- **Unlimited outputs** â€” runs 100% in your browser using the free Web Speech API. No API key, no credits, no limits.
- **6 voice personas (emotions)** â€” Confident Billionaire, Calm Executive, Tough Love Direct, Engaging Storyteller, Suspenseful Reveal, and Warm Brotherly Advice.
- **4 vocal intensity levels** â€” Subtle/Secret Tone, Normal Dialogue, High Energy/Hook, and Explosive Boss Energy, with gain (dB) shaping for different content moods.
- **3 preset topics** â€” Sikolohiya ng Pera, Diskarte, and Buhay Pinoy with ready-made Tagalog scripts, thumbnail ideas, and B-roll prompts. Custom topics also supported.
- **Line-by-line editor** â€” reorder, re-emotion, adjust pauses, add visual prompts per line.
- **Full voice control** â€” Filipino male voice auto-selection, pitch, rate, bass boost, and volume sliders.
- **Downloadable voiceover** â€” record the playback to a `.wav` file via tab-audio capture.

## How to run

No Node.js or Python required. Pick one:

**Option A â€” just open it (playback only):**
Double-click `index.html`. Playback works everywhere, but the `.wav` download needs a secure context, so use Option B for downloads.

**Option B â€” local server (full features, recommended):**
1. Right-click `start-server.ps1` â†’ *Run with PowerShell* (or run `powershell -ExecutionPolicy Bypass -File start-server.ps1`).
2. It opens `http://localhost:8787` automatically.

## To download a `.wav` voiceover

1. Click **Record & Download .wav**.
2. In the browser prompt, select the Don Bossing tab and check **"Share tab audio"** (Chrome) / **"Share system audio"** (Edge).
3. The app plays every line, then downloads the finished `.wav` automatically.

## Tips

- For best Tagalog quality, pick a Filipino voice (`fil-PH`) in the *Browser Voice* dropdown when available on your OS.
- Longform mode adds an intro; Shorts mode keeps it tight for retention.
- Every line can carry its own emotion + intensity for dynamic, mood-rich delivery.
