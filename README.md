# Caption Studio — free, animated video captions

A 100% client-side web app: upload a video, transcribe it with **your own
free Groq API key**, pick an animated caption style, preview it live over
the video (drag captions around directly in the preview), and export a
captioned `.mp4` — all in the browser, no server, no cost to run.

See **DOCS.md** for the folder structure, what changed in the latest pass,
and what's left to do — read that first if you're continuing this build.

## How it works

- **Transcription** — the app extracts the audio track, downmixes it to
  mono 16kHz, and sends it straight from your browser to Groq's Whisper
  endpoint using the API key you enter. The key is stored only in
  `localStorage`.
- **Preview** — a `<canvas>` sits on top of the `<video>` element and
  redraws the current caption style every frame using word-level timestamps.
  Click or drag any caption directly in the preview to reposition/resize it.
- **Export** — uses the browser's native **WebCodecs API** plus the
  open-source [`mp4-muxer`](https://github.com/Vanilagy/mp4-muxer) library
  to encode an H.264 + AAC `.mp4` with captions burned in, entirely on your
  machine.

## Running it

```
cd captiontool
python3 -m http.server 8000
# open http://localhost:8000
```
(Needs a local server — the app uses ES module imports, which browsers
block on `file://`.)

Or drag the folder onto any static host (GitHub Pages, Netlify, Cloudflare
Pages, Vercel).

## Get Free API Keys

The app uses **100% free API keys** for speech transcription (no credit card required).

- **Standard Transcription (Groq)**:
  1. Go to [console.groq.com/keys](https://console.groq.com/keys).
  2. Create a free account & click **Create API Key**.
  3. Paste your key into the app's **Add Standard API Key** button.
- **Hinglish Mode (AssemblyAI)**:
  1. Go to [assemblyai.com](https://www.assemblyai.com/).
  2. Create a free account to get your free API key.
  3. Paste it into the app's **Add Hinglish API Key** modal.

> 💡 **Free Tier Note**: A single free account covers up to **180 hours of free transcription**. If you ever reach the limit or quota on an account, simply create another free account using a different email address to get a new free API key!
>
> 🔒 **Privacy First**: Your API keys are saved strictly inside your browser's `localStorage`. They are never sent to or stored on our servers.

## Caption styles included

| Style | Effect |
|---|---|
| Highlight Box | Active word gets a solid highlighter box behind it |
| Pop Karaoke | Current word scales/pops and highlights |
| Typewriter Mono | Line types itself out, blinking cursor |
| Bounce In | Words spring in from below, one by one |
| Slide Up Lines | Whole lines glide up and fade between phrases |
| Neon Glow | Glowing pulse on the active word |
| Minimal Clean | Simple single-line captions with a soft backing box |
| Marker Sweep | Highlighter box wipes across the word |
| Big Word Pop | One dominant word at a time, TikTok-style |
| Gradient Wave | Shifting color gradient across each word |
| Glitch Shift | RGB-split glitch as each word lands |
| Depth Reveal | Big bold text tucked behind the subject with a feathered cutout layer |

Every style only ever draws its own caption text/background — none of them
tint or filter the video itself. Font, size, color, and position are all
editable per-project from the right-hand panel, and captions can be dragged
directly in the preview.

**Depth Reveal** lets you tuck big bold text behind a subject using a fast,
user-positioned feathered cutout box. Click, drag, or resize the cutout box
directly in the preview to align with the subject in your video.

## Known limits

- **Export needs WebCodecs** — currently desktop Chrome or Edge. Preview
  works everywhere modern.
- **Groq's free tier** caps audio upload size (~25MB) and has a rate limit.
- Export re-encodes frame-by-frame, so a few minutes of footage can take a
  couple of minutes to render.
