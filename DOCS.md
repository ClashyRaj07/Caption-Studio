# Caption Studio — dev docs / handoff notes

Read this first if you're picking this project up cold (including another AI
assistant). It explains the folder structure, what changed in the latest
pass, and what's still open.

## Folder structure (scalable — one file per preset)

```
captiontool/
  index.html
  css/style.css
  js/
    app.js            – all UI wiring: upload, transcription, style gallery,
                         controls panel, canvas preview loop, drag/resize
    groq.js           – audio extraction + Groq Whisper transcription call
    exporter.js        – WebCodecs-based burned-in MP4 export
    wordTiming.js      – buildFrameWords(): turns word timestamps + playhead
                         time into the per-frame word list every preset draws
    presets/
      utils.js         – shared canvas helpers (layoutRow, drawStrokedText,
                         roundRect, hitbox helpers, yForPosition/xCenter).
                         ALL presets should be built from these primitives.
      index.js         – imports every preset file and exports PRESETS[] +
                         getPreset(id). This is the only place that needs a
                         new line when you add a preset.
      popKaraoke.js
      highlightBox.js  – matches the reference clip (see below)
      typewriter.js
      bounce.js
      slideUpLines.js
      neonGlow.js
      minimalClean.js
      markerSweep.js
      bigWordPop.js
      gradientWave.js
      glitchShift.js
      depthReveal.js   – text tucked behind subject using a manual feathered cutout box
```

**To add a new caption style:** copy any file in `js/presets/` as a
template, change `draw()` and `defaultConfig`, give it a unique `id`, then
add one import + one line in `js/presets/index.js`. Nothing else in the app
needs to change — the style gallery, controls panel, and export path all
read from `PRESETS`.

## What changed in this pass (latest)

Three things were reported after the last handoff: overlapping caption
text, no audio in the preview, and a request for a "text behind the
speaker" depth-style preset. All three are addressed:

1. **Audio missing in preview.** `index.html`'s `<video>` element had a
   hardcoded `muted` attribute. Export already had working audio (see
   `exporter.js`'s AudioEncoder path, untouched) — only the live preview
   was silent. Removed `muted`; the custom play button already triggers
   `play()` from a user gesture, so unmuted playback works under normal
   autoplay policies.

2. **Overlapping / off-frame caption text**, root-caused two ways:
   - `layoutRow()` (`presets/utils.js`) spaced words using each word's
     *resting* width, but several presets (Highlight Box, Pop Karaoke,
     Marker Sweep, Gradient Wave, Glitch Shift, Neon Glow, Bounce) scale the
     *active* word up 8–30% as a pop/bounce animation — that growth wasn't
     reserved for, so a word mid-pop could bleed into its neighbor. A
     5-word line at a large font size could also simply be wider than the
     video frame, pushing words toward/off the edges (verified with a
     headless render test — see `test/layout-check.mjs` — the old code let
     words spill up to ~270px past the frame edges on a 480px-wide 9:16
     canvas at default settings).
   - Fix: `layoutRow()` now takes an optional `maxWidth` (every preset
     passes the canvas `width`), reserves headroom for the largest pop
     scale used by any preset, and — if the row would still be too wide —
     shrinks the whole row uniformly around its center point. It returns a
     `fitScale` that each preset multiplies into its own per-word animation
     scale. All 7 affected presets were updated to pass `width` and use
     `fitScale`.
   - Also added a `document.fonts.ready` gate (`app.js`) before the preview
     loop starts drawing and before export starts rendering, so no frame is
     ever laid out against fallback-font metrics while the Google Fonts
     `<link>` is still loading.
   - `test/layout-check.mjs` is a small headless (node-canvas) regression
     check for this — not part of the shipped app, just a dev tool. Run
     `npm install canvas` in that folder, then `node test/layout-check.mjs`.

3. **Rebuilt "Depth Reveal" preset to a manual feathered-cutout approach.**
   - Removed `js/segmentation.js` and all MediaPipe SelfieSegmentation CDN model loading logic.
   - `js/presets/depthReveal.js` now uses an offscreen scratch canvas with `globalCompositeOperation = 'destination-out'` and `filter = 'blur(feather)'` to erase text within a user-positioned rectangular cutout box.
   - Users can drag and resize the subject cutout rectangle directly in the live preview canvas, as well as fine-tune X/Y/W/H and edge feathering in the side panel.
   - Renders cleanly with zero ML inference cost or network dependency, enabling high-performance preview and export.

## What changed in the previous pass

1. **New "Highlight Box" preset** (`js/presets/highlightBox.js`) — built to
   match the reference clip you sent: bold uppercase words, plain white
   otherwise, and the word currently being spoken gets a solid rounded
   highlight box behind it. It's now the default preset.

2. **Removed all video-color-altering effects.** The old `duotone-overlay`
   preset painted a translucent gradient across the *entire canvas* every
   frame (`ctx.fillRect(0,0,width,height)` with `globalCompositeOperation =
   'overlay'`) — that's what was tinting the video. It's been deleted
   outright (replaced by Highlight Box). A few other presets used blend
   modes (`screen`, `multiply`, `lighten`) that, while scoped to the text
   area, could still visibly shift pixels of the video peeking through:
   - `bigWordPop.js` — dropped the large radial `screen`-blend glow behind
     the big word (was up to ~32% of the frame width).
   - `markerSweep.js` — highlight box now uses normal opaque fill
     (`source-over`) instead of `multiply`.
   - `gradientWave.js` — gradient text fill now uses normal fill instead of
     `screen`.
   - `glitchShift.js` — RGB-split ghost copies now use plain alpha
     transparency instead of `lighten`.
   `drawStrokedText()` in `utils.js` also force-sets
   `globalCompositeOperation = 'source-over'` before every text draw as a
   safety net. **Rule going forward: no preset should fill or blend across
   an area larger than its own caption text/background — only size, font,
   color, and position of the caption itself should be adjustable.**

3. **Whole-block drag positioning for line-level presets.** Word-level
   presets (Pop Karaoke, Highlight Box, Bounce, etc.) already supported
   dragging individual words in the preview — that was already built and is
   unchanged. What was missing: the *line-level* presets (Typewriter,
   Slide Up Lines, Minimal Clean) had no way to reposition the caption block
   itself except the Top/Center/Bottom buttons. Added:
   - `config.blockOffsetX` / `config.blockOffsetY` on every preset's
     `defaultConfig`, applied in `yForPosition()` / `xCenter()` in
     `utils.js`.
   - `pushBlockHitbox()` in `utils.js` — line-level presets report one
     hitbox for the whole line (`index: 'block'`) instead of per-word boxes.
   - `app.js` drag logic now branches on `state.selectedWordIndex === 'block'`
     to drag the whole config offset instead of a per-word override, with
     its own small X/Y control + reset button in the side panel.
   - Resize is intentionally *not* supported via drag for the whole block
     (only via the Font size slider) — dragging a resize handle for an
     entire line is a much fiddlier gesture than for one word, and wasn't
     asked for.

4. **Responsive one-page layout.** `css/style.css` was rewritten so the app
   fills exactly `100dvh` with `overflow: hidden` on `html/body` — no more
   page-level scrolling to see the whole UI. The three columns (step rail,
   video stage, style panel) each get their own `overflow-y: auto` and a
   styled scrollbar; the style panel specifically has a visible custom
   scrollbar (`.panel::-webkit-scrollbar…`) since that's the one that gets
   long once the style gallery + controls + word list are all showing.

5. **Added a Font picker** (Grotesk / Inter / Mono) to the controls panel,
   since the ask was "size, font, position... can be changed" and only font
   size existed before.

## Known limits / not done yet

- **Highlight-box text color on the active word** is a fixed dark color in
  `defaultConfig.highlightTextColor`, not exposed as its own color picker
  (the generic controls panel only has two swatches: text + accent). If you
  want it user-adjustable, add a third `<input type="color">` in
  `renderControls()` in `app.js`, wired to `c.highlightTextColor`.
- **Mobile layout** hides the step rail below 1080px width but hasn't been
  tested on an actual phone — the video stage + panel stacking on narrow
  screens could still use a pass if mobile support matters.
- **Transcription** (`groq.js`) was **not modified** in either of the last
  two passes — carried over unchanged from the original build.
  `exporter.js` **was** touched in the latest pass (its render loop now
  `await`s `drawFrame()` so Depth Reveal's per-frame mask lookup can
  finish) but its WebCodecs/audio pipeline is otherwise unchanged. Same
  browser-support caveat as before: export needs desktop Chrome/Edge.
- **Depth Reveal export is now as fast as all other presets**, running in real-time with zero ML or per-frame segmentation overhead.
- The word-by-word drag/resize UI (blue dashed box + resize handle in the
  bottom-right) is unchanged from before this pass — it already worked for
  word-level presets and wasn't broken by this refactor, just reused.

## Running it

Static site, no build step:
```
cd captiontool
python3 -m http.server 8000
# open http://localhost:8000
```
(Needs a local server because of `<script type="module">` imports — won't
work off `file://`.)
