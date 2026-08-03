import { PRESETS, getPreset } from './presets/index.js';
import { buildFrameWords } from './wordTiming.js';
import { extractAudioAsWav, transcribeWithGroq, transcribeWithAssemblyAI } from './groq.js';
import { exportCaptionedVideo, isExportSupported } from './exporter.js';
// ---------- State ----------
const state = {
  apiKey: localStorage.getItem('groq_api_key') || '',
  assemblyApiKey: localStorage.getItem('assemblyai_api_key') || '',
  videoFile: null,
  videoURL: null,
  words: [],                // [{word,start,end}]
  presetId: 'highlight-box',
  config: null,
  wordsPerLine: 5,
  step: 1,
  overrides: {},             // { [globalIndex]: {offsetX, offsetY, scale} }
  selectedWordIndex: null,   // number = a word's globalIndex, 'block' = whole caption line, null = nothing
  lastHitboxes: [],
  dragMode: null,            // 'move' | 'resize' | null
  dragStart: null
};

// ---------- DOM refs ----------
const $ = sel => document.querySelector(sel);
const els = {
  keyModal: $('#keyModal'),
  keyInput: $('#keyInput'),
  saveKeyBtn: $('#saveKeyBtn'),
  closeKeyBtn: $('#closeKeyBtn'),
  keyStatusBtn: $('#keyStatusBtn'),
  assemblyKeyModal: $('#assemblyKeyModal'),
  assemblyKeyInput: $('#assemblyKeyInput'),
  saveAssemblyKeyBtn: $('#saveAssemblyKeyBtn'),
  closeAssemblyKeyBtn: $('#closeAssemblyKeyBtn'),
  assemblyKeyStatusBtn: $('#assemblyKeyStatusBtn'),
  uploadZone: $('#uploadZone'),
  fileInput: $('#fileInput'),
  stage: $('#stage'),
  playerWrap: $('#playerWrap'),
  video: $('#video'),
  overlay: $('#overlay'),
  transport: $('#transport'),
  playBtn: $('#playBtn'),
  seek: $('#seek'),
  timeLabel: $('#timeLabel'),
  statusLine: $('#statusLine'),
  progressBar: $('#progressBar'),
  progressFill: $('#progressFill'),
  transcribeBtn: $('#transcribeBtn'),
  transcribeBtnText: $('#transcribeBtnText'),
  hinglishOpt: $('#hinglishOpt'),
  fsBtn: $('#fsBtn'),
  fsContainer: $('#fsContainer'),
  transcriptBox: $('#transcriptBox'),
  styleGrid: $('#styleGrid'),
  styleSearchInput: $('#styleSearchInput'),
  controls: $('#controls'),
  exportBtn: $('#exportBtn'),
  steps: [...document.querySelectorAll('.step')],
  wordEditPanel: $('#wordEditPanel'),
  wordList: $('#wordList'),
  wordEditHint: $('#wordEditHint')
};

// ---------- Groq API Key Modal ----------
function openGroqKeyModal() { els.keyModal.classList.remove('hidden'); els.keyInput.value = state.apiKey; els.keyInput.focus(); }
function closeGroqKeyModal() { els.keyModal.classList.add('hidden'); }

// ---------- AssemblyAI API Key Modal ----------
function openAssemblyKeyModal() { els.assemblyKeyModal.classList.remove('hidden'); els.assemblyKeyInput.value = state.assemblyApiKey; els.assemblyKeyInput.focus(); }
function closeAssemblyKeyModal() { els.assemblyKeyModal.classList.add('hidden'); }

function refreshKeyStatus() {
  const isHinglish = els.hinglishOpt?.checked;

  els.keyStatusBtn.textContent = state.apiKey ? 'Standard Key connected' : 'Add Standard API key';
  els.keyStatusBtn.classList.toggle('key-connected', !!state.apiKey);

  if (els.assemblyKeyStatusBtn) {
    els.assemblyKeyStatusBtn.classList.toggle('hidden', !isHinglish);
    els.assemblyKeyStatusBtn.textContent = state.assemblyApiKey ? 'Hinglish Key connected' : 'Add Hinglish API key';
    els.assemblyKeyStatusBtn.classList.toggle('key-connected', !!state.assemblyApiKey);
  }
}

els.keyStatusBtn.addEventListener('click', openGroqKeyModal);
els.closeKeyBtn?.addEventListener('click', closeGroqKeyModal);
els.saveKeyBtn.addEventListener('click', () => {
  state.apiKey = els.keyInput.value.trim();
  localStorage.setItem('groq_api_key', state.apiKey);
  refreshKeyStatus();
  closeGroqKeyModal();
});

els.assemblyKeyStatusBtn?.addEventListener('click', openAssemblyKeyModal);
els.closeAssemblyKeyBtn?.addEventListener('click', closeAssemblyKeyModal);
els.saveAssemblyKeyBtn?.addEventListener('click', () => {
  state.assemblyApiKey = els.assemblyKeyInput.value.trim();
  localStorage.setItem('assemblyai_api_key', state.assemblyApiKey);
  refreshKeyStatus();
  closeAssemblyKeyModal();
});

els.hinglishOpt?.addEventListener('change', () => {
  const isHinglish = els.hinglishOpt?.checked;
  if (els.transcribeBtnText) {
    els.transcribeBtnText.textContent = isHinglish ? 'Transcribe Hinglish' : 'Transcribe video';
  }
  if (isHinglish && !state.assemblyApiKey) {
    openAssemblyKeyModal();
  }
  refreshKeyStatus();
});

refreshKeyStatus();
if (!state.apiKey) openGroqKeyModal();

// ---------- Upload ----------
['dragover', 'dragenter'].forEach(evt =>
  els.uploadZone.addEventListener(evt, e => { e.preventDefault(); els.uploadZone.classList.add('drag'); }));
['dragleave', 'drop'].forEach(evt =>
  els.uploadZone.addEventListener(evt, e => { e.preventDefault(); els.uploadZone.classList.remove('drag'); }));
els.uploadZone.addEventListener('drop', e => {
  const file = e.dataTransfer.files?.[0];
  if (file) loadVideo(file);
});
els.uploadZone.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) loadVideo(file);
});

function loadVideo(file) {
  if (!file.type.startsWith('video/')) { setStatus('That doesn\u2019t look like a video file.', true); return; }
  state.videoFile = file;
  state.videoURL = URL.createObjectURL(file);
  state.words = [];
  state.overrides = {};
  state.selectedWordIndex = null;
  els.video.src = state.videoURL;
  els.uploadZone.classList.add('hidden');
  els.playerWrap.classList.remove('hidden');
  els.transport.classList.remove('hidden');
  els.transcribeBtn.disabled = false;
  goToStep(2);
  setStatus('Video loaded. Ready to transcribe.');
}

// ---------- Player ----------
els.video.addEventListener('loadedmetadata', () => {
  els.overlay.width = els.video.videoWidth;
  els.overlay.height = els.video.videoHeight;
  els.seek.max = els.video.duration;
  resizeOverlayToVideo();
});
els.video.addEventListener('timeupdate', () => {
  els.seek.value = els.video.currentTime;
  els.timeLabel.textContent = `${fmtTime(els.video.currentTime)} / ${fmtTime(els.video.duration || 0)}`;
});
els.seek.addEventListener('input', () => { els.video.currentTime = +els.seek.value; });
els.fsBtn?.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
  else els.fsContainer.requestFullscreen().catch(() => { });
});
els.playBtn.addEventListener('click', () => {
  if (els.video.paused) { els.video.play().catch(() => { }); els.playBtn.classList.add('is-playing'); }
  else { els.video.pause(); els.playBtn.classList.remove('is-playing'); }
});
function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const overlayCtx = els.overlay.getContext('2d');

// Space Grotesk / Inter / JetBrains Mono are loaded via <link> in index.html
// (async, `display=swap`). If a caption preset measures/draws text before
// those finish loading, the canvas falls back to a system font whose glyph
// widths don't match — throwing off layoutRow's spacing.
let fontsReady = false;
(document.fonts?.ready || Promise.resolve()).then(() => { fontsReady = true; });

const GOOGLE_FONTS = [
  { name: 'Space Grotesk (Default)', value: 'Space Grotesk, sans-serif' },
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif' },
  { name: 'Oswald', value: 'Oswald, sans-serif' },
  { name: 'Bebas Neue', value: 'Bebas Neue, sans-serif' },
  { name: 'Outfit', value: 'Outfit, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Raleway', value: 'Raleway, sans-serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
  { name: 'Anton', value: 'Anton, sans-serif' },
  { name: 'Pacifico', value: 'Pacifico, cursive' },
  { name: 'Syne', value: 'Syne, sans-serif' },
  { name: 'Lora', value: 'Lora, serif' },
  { name: 'Cinzel', value: 'Cinzel, serif' },
  { name: 'Rubik', value: 'Rubik, sans-serif' },
  { name: 'Righteous', value: 'Righteous, sans-serif' },
  { name: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans, sans-serif' },
  { name: 'Bungee', value: 'Bungee, sans-serif' }
];

const loadedFonts = new Set(['Space Grotesk', 'Inter', 'JetBrains Mono']);

function loadGoogleFont(fontFamilyStr) {
  if (!fontFamilyStr) return;
  const familyName = fontFamilyStr.split(',')[0].replace(/['"]/g, '').trim();
  if (!familyName || loadedFonts.has(familyName)) return;
  loadedFonts.add(familyName);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familyName)}:wght@400;600;700;800;900&display=swap`;
  document.head.appendChild(link);
  if (document.fonts) {
    document.fonts.load(`800 24px "${familyName}"`).then(() => {
      fontsReady = true;
    });
  }
}

// Fullscreen alignment fix: size the playerWrap to the exact video aspect
// ratio so the canvas (position:absolute inside it) always matches the video
// 1:1. The fsContainer centers the playerWrap via flexbox. This avoids the
// position:fixed hack which caused the canvas to misalign with the video.
function resizeOverlayToVideo() {
  const video = els.video;
  if (!video.videoWidth || !video.videoHeight) return;

  if (document.fullscreenElement) {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const ar = video.videoWidth / video.videoHeight;
    const screenAr = screenW / screenH;
    const w = ar > screenAr ? screenW : Math.round(screenH * ar);
    const h = ar > screenAr ? Math.round(screenW / ar) : screenH;
    // Size playerWrap to exact video rect - canvas fills it naturally
    els.playerWrap.style.width = w + 'px';
    els.playerWrap.style.height = h + 'px';
    els.playerWrap.style.maxWidth = 'none';
    // Reset canvas to fill playerWrap (position:absolute is set in CSS)
    els.overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
  } else {
    els.playerWrap.style.width = '';
    els.playerWrap.style.height = '';
    els.playerWrap.style.maxWidth = '';
    els.overlay.style.cssText = 'position:absolute;top:0;left:0;';
  }
}
document.addEventListener('fullscreenchange', resizeOverlayToVideo);
window.addEventListener('resize', resizeOverlayToVideo);

function previewLoop() {
  overlayCtx.clearRect(0, 0, els.overlay.width, els.overlay.height);
  if (fontsReady && state.words.length && state.config) {
    const { activeWords, currentLineStart, currentWordGlobalIndex } = buildFrameWords(state.words, els.video.currentTime, state.wordsPerLine, state.overrides);
    const preset = getPreset(state.presetId);
    const hitboxOut = [];
    preset.draw(overlayCtx, {
      width: els.overlay.width,
      height: els.overlay.height,
      time: els.video.currentTime,
      activeWords,
      currentLineStart,
      config: state.config,
      hitboxOut,
      words: state.words,
      currentWordGlobalIndex
    });
    state.lastHitboxes = hitboxOut;
    drawSelectionHandles();
  }
  requestAnimationFrame(previewLoop);
}
requestAnimationFrame(previewLoop);

function drawSelectionHandles() {
  if (state.selectedWordIndex === null) return;
  const box = state.lastHitboxes.find(h => h.index === state.selectedWordIndex);
  if (!box) return;
  const ctx = overlayCtx;
  ctx.save();
  ctx.strokeStyle = '#7CE7FF';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);

  if (state.selectedWordIndex === 'cutout') {
    const rx = box.x - box.w / 2;
    const ry = box.y - box.h / 2;
    ctx.strokeRect(rx, ry, box.w, box.h);
    ctx.setLineDash([]);
    // Cutout bottom-right resize handle
    const hx = box.x + box.w / 2;
    const hy = box.y + box.h / 2;
    ctx.fillStyle = '#7CE7FF';
    ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0B0E14'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    return;
  }

  const w = Math.max(box.w, 24), h = Math.max(box.h, 24);
  ctx.strokeRect(box.x - w / 2 - 8, box.y - h / 2 - 8, w + 16, h + 16);
  ctx.setLineDash([]);
  // resize handle, bottom-right — word-level captions only
  if (typeof state.selectedWordIndex === 'number') {
    const hx = box.x + w / 2 + 8, hy = box.y + h / 2 + 8;
    ctx.fillStyle = '#7CE7FF';
    ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0B0E14'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

// ---------- Word / block drag & drop editing on the canvas ----------
function canvasPointFromEvent(e) {
  const rect = els.overlay.getBoundingClientRect();
  const scaleX = els.overlay.width / rect.width;
  const scaleY = els.overlay.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function hitboxAt(px, py) {
  for (let i = state.lastHitboxes.length - 1; i >= 0; i--) {
    const b = state.lastHitboxes[i];
    if (b.index === 'cutout') {
      if (Math.abs(px - b.x) <= b.w / 2 && Math.abs(py - b.y) <= b.h / 2) return b;
    } else {
      const w = Math.max(b.w, 24), h = Math.max(b.h, 24);
      if (Math.abs(px - b.x) <= w / 2 + 8 && Math.abs(py - b.y) <= h / 2 + 8) return b;
    }
  }
  return null;
}

function resizeHandleAt(px, py) {
  if (state.selectedWordIndex === 'cutout') {
    const box = state.lastHitboxes.find(h => h.index === 'cutout');
    if (!box) return false;
    const hx = box.x + box.w / 2;
    const hy = box.y + box.h / 2;
    return Math.hypot(px - hx, py - hy) <= 12;
  }
  if (typeof state.selectedWordIndex !== 'number') return false;
  const box = state.lastHitboxes.find(h => h.index === state.selectedWordIndex);
  if (!box) return false;
  const w = Math.max(box.w, 24), h = Math.max(box.h, 24);
  const hx = box.x + w / 2 + 8, hy = box.y + h / 2 + 8;
  return Math.hypot(px - hx, py - hy) <= 12;
}

function ensureOverride(index) {
  if (!state.overrides[index]) state.overrides[index] = { offsetX: 0, offsetY: 0, scale: 1 };
  return state.overrides[index];
}

els.overlay.addEventListener('pointerdown', e => {
  if (!state.words.length) return;
  const pt = canvasPointFromEvent(e);
  if (resizeHandleAt(pt.x, pt.y)) {
    state.dragMode = 'resize';
    state.dragStart = {
      ...pt,
      orig: state.selectedWordIndex === 'cutout'
        ? { cutoutWidth: state.config.cutoutWidth ?? 0.5, cutoutHeight: state.config.cutoutHeight ?? 0.85 }
        : { ...ensureOverride(state.selectedWordIndex) }
    };
    els.overlay.setPointerCapture(e.pointerId);
    return;
  }
  const box = hitboxAt(pt.x, pt.y);
  if (box) {
    if (box.index === 'cutout') {
      selectCutout();
    } else if (box.index === 'block') {
      selectBlock();
    } else {
      selectWord(box.index, { seek: true });
    }
    state.dragMode = 'move';
    state.dragStart = {
      ...pt,
      orig: box.index === 'cutout'
        ? { cutoutX: state.config.cutoutX ?? 0.5, cutoutY: state.config.cutoutY ?? 0.55 }
        : box.index === 'block'
          ? { offsetX: state.config.blockOffsetX || 0, offsetY: state.config.blockOffsetY || 0 }
          : { ...ensureOverride(box.index) }
    };
    els.overlay.setPointerCapture(e.pointerId);
  } else {
    selectWord(null);
  }
});
els.overlay.addEventListener('pointermove', e => {
  if (!state.dragMode || state.selectedWordIndex === null) return;
  const pt = canvasPointFromEvent(e);

  if (state.selectedWordIndex === 'cutout') {
    if (state.dragMode === 'move') {
      const dx = (pt.x - state.dragStart.x) / els.overlay.width;
      const dy = (pt.y - state.dragStart.y) / els.overlay.height;
      state.config.cutoutX = Math.max(0, Math.min(1, state.dragStart.orig.cutoutX + dx));
      state.config.cutoutY = Math.max(0, Math.min(1, state.dragStart.orig.cutoutY + dy));
    } else if (state.dragMode === 'resize') {
      const box = state.lastHitboxes.find(h => h.index === 'cutout');
      if (box) {
        const left = box.x - box.w / 2;
        const top = box.y - box.h / 2;
        const newW = Math.max(0.05, Math.min(1, (pt.x - left) / els.overlay.width));
        const newH = Math.max(0.05, Math.min(1, (pt.y - top) / els.overlay.height));
        state.config.cutoutWidth = newW;
        state.config.cutoutHeight = newH;
      }
    }
    syncWordEditFields();
    return;
  }

  if (state.dragMode === 'move' && state.selectedWordIndex === 'block') {
    state.config.blockOffsetX = state.dragStart.orig.offsetX + (pt.x - state.dragStart.x);
    state.config.blockOffsetY = state.dragStart.orig.offsetY + (pt.y - state.dragStart.y);
    syncWordEditFields();
    return;
  }
  const ov = ensureOverride(state.selectedWordIndex);
  if (state.dragMode === 'move') {
    ov.offsetX = state.dragStart.orig.offsetX + (pt.x - state.dragStart.x);
    ov.offsetY = state.dragStart.orig.offsetY + (pt.y - state.dragStart.y);
  } else if (state.dragMode === 'resize') {
    const box = state.lastHitboxes.find(h => h.index === state.selectedWordIndex);
    const dNow = Math.hypot(pt.x - box.x, pt.y - box.y);
    const dStart = Math.hypot(state.dragStart.x - box.x, state.dragStart.y - box.y);
    const ratio = dStart > 1 ? dNow / dStart : 1;
    ov.scale = Math.max(0.4, Math.min(3, state.dragStart.orig.scale * ratio));
  }
  syncWordEditFields();
});
window.addEventListener('pointerup', () => { state.dragMode = null; state.dragStart = null; });

function selectWord(globalIndex, { seek = false } = {}) {
  state.selectedWordIndex = globalIndex;
  if (globalIndex !== null && typeof globalIndex === 'number') {
    [...els.wordList.children].forEach(row => row.classList.toggle('selected', +row.dataset.index === globalIndex));
    const row = els.wordList.querySelector(`[data-index="${globalIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
    if (seek) {
      const w = state.words[globalIndex];
      els.video.pause();
      els.playBtn.classList.remove('is-playing');
      els.video.currentTime = Math.min(w.start + 0.02, els.video.duration - 0.02);
    }
  } else {
    [...els.wordList.children].forEach(row => row.classList.remove('selected'));
  }
  syncWordEditFields();
}

function selectBlock() {
  state.selectedWordIndex = 'block';
  [...els.wordList.children].forEach(row => row.classList.remove('selected'));
  syncWordEditFields();
}

function selectCutout() {
  state.selectedWordIndex = 'cutout';
  [...els.wordList.children].forEach(row => row.classList.remove('selected'));
  syncWordEditFields();
}

function syncWordEditFields() {
  const hint = els.wordEditHint;
  if (state.selectedWordIndex === null) {
    hint.textContent = 'Click a word below, or drag any caption directly in the preview, to move, resize, or reposition it.';
    return;
  }
  if (state.selectedWordIndex === 'cutout') {
    hint.innerHTML = '';
    const label = document.createElement('div');
    label.className = 'word-edit-label';
    label.textContent = 'Subject cutout box';
    hint.appendChild(label);
    const row = document.createElement('div');
    row.className = 'word-edit-row';
    const cx = Math.round((state.config.cutoutX ?? 0.5) * 100);
    const cy = Math.round((state.config.cutoutY ?? 0.55) * 100);
    const cw = Math.round((state.config.cutoutWidth ?? 0.5) * 100);
    const ch = Math.round((state.config.cutoutHeight ?? 0.85) * 100);
    const cf = state.config.cutoutFeather ?? 30;

    row.innerHTML = `
      <label>X <input type="range" id="cX" min="0" max="100" value="${cx}"></label>
      <label>Y <input type="range" id="cY" min="0" max="100" value="${cy}"></label>
      <label>W <input type="range" id="cW" min="5" max="100" value="${cw}"></label>
      <label>H <input type="range" id="cH" min="5" max="100" value="${ch}"></label>
      <label>Feather <input type="range" id="cF" min="0" max="100" value="${cf}"></label>
      <button class="btn btn-ghost btn-tiny" id="cReset">Reset cutout</button>
    `;
    hint.appendChild(row);
    hint.querySelector('#cX').addEventListener('input', e => { state.config.cutoutX = +e.target.value / 100; });
    hint.querySelector('#cY').addEventListener('input', e => { state.config.cutoutY = +e.target.value / 100; });
    hint.querySelector('#cW').addEventListener('input', e => { state.config.cutoutWidth = +e.target.value / 100; });
    hint.querySelector('#cH').addEventListener('input', e => { state.config.cutoutHeight = +e.target.value / 100; });
    hint.querySelector('#cF').addEventListener('input', e => { state.config.cutoutFeather = +e.target.value; });
    hint.querySelector('#cReset').addEventListener('click', () => {
      state.config.cutoutX = 0.5;
      state.config.cutoutY = 0.55;
      state.config.cutoutWidth = 0.5;
      state.config.cutoutHeight = 0.85;
      state.config.cutoutFeather = 30;
      syncWordEditFields();
    });
    return;
  }
  if (state.selectedWordIndex === 'block') {
    hint.innerHTML = '';
    const label = document.createElement('div');
    label.className = 'word-edit-label';
    label.textContent = 'Caption block';
    hint.appendChild(label);
    const row = document.createElement('div');
    row.className = 'word-edit-row';
    const bx = state.config.blockOffsetX || 0, by = state.config.blockOffsetY || 0;
    row.innerHTML = `
      <label>X <input type="range" id="wX" min="-300" max="300" value="${bx}"></label>
      <label>Y <input type="range" id="wY" min="-300" max="300" value="${by}"></label>
      <button class="btn btn-ghost btn-tiny" id="wReset">Reset position</button>
    `;
    hint.appendChild(row);
    hint.querySelector('#wX').addEventListener('input', e => { state.config.blockOffsetX = +e.target.value; });
    hint.querySelector('#wY').addEventListener('input', e => { state.config.blockOffsetY = +e.target.value; });
    hint.querySelector('#wReset').addEventListener('click', () => {
      state.config.blockOffsetX = 0; state.config.blockOffsetY = 0;
      syncWordEditFields();
    });
    return;
  }
  const ov = ensureOverride(state.selectedWordIndex);
  const w = state.words[state.selectedWordIndex];
  hint.innerHTML = '';

  const spellContainer = document.createElement('div');
  spellContainer.style.marginBottom = '10px';
  spellContainer.innerHTML = `
    <label style="font-family: var(--font-mono); font-size: 10px; color: var(--muted); text-transform: uppercase; margin-bottom: 4px; display: block;">Spelling / Text</label>
    <input type="text" id="wSpellingInput" class="spelling-input" value="${w.word.replace(/"/g, '&quot;')}">
  `;
  hint.appendChild(spellContainer);
  const spellInput = spellContainer.querySelector('#wSpellingInput');
  spellInput.addEventListener('input', e => {
    w.word = e.target.value;
    if (els.transcriptBox) els.transcriptBox.textContent = state.words.map(x => x.word).join(' ');
    const chip = els.wordList.querySelector(`[data-index="${state.selectedWordIndex}"]`);
    if (chip) chip.textContent = e.target.value;
  });

  const row = document.createElement('div');
  row.className = 'word-edit-row';
  row.innerHTML = `
    <label>X <input type="range" id="wX" min="-300" max="300" value="${ov.offsetX}"></label>
    <label>Y <input type="range" id="wY" min="-300" max="300" value="${ov.offsetY}"></label>
    <label>Size <input type="range" id="wS" min="40" max="300" value="${Math.round(ov.scale * 100)}"></label>
    <button class="btn btn-ghost btn-tiny" id="wReset">Reset word</button>
  `;
  hint.appendChild(row);
  hint.querySelector('#wX').addEventListener('input', e => { ov.offsetX = +e.target.value; });
  hint.querySelector('#wY').addEventListener('input', e => { ov.offsetY = +e.target.value; });
  hint.querySelector('#wS').addEventListener('input', e => { ov.scale = +e.target.value / 100; });
  hint.querySelector('#wReset').addEventListener('click', () => {
    delete state.overrides[state.selectedWordIndex];
    syncWordEditFields();
  });
}

function renderWordList() {
  els.wordList.innerHTML = '';
  state.words.forEach((w, i) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'word-chip';
    row.dataset.index = i;
    row.textContent = w.word;
    row.addEventListener('click', () => selectWord(i, { seek: true }));
    row.addEventListener('dblclick', e => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'word-chip-input';
      input.value = w.word;
      row.replaceWith(input);
      input.focus();
      input.select();
      const finishEdit = () => {
        const val = input.value.trim();
        if (val) {
          w.word = val;
          if (els.transcriptBox) els.transcriptBox.textContent = state.words.map(x => x.word).join(' ');
        }
        renderWordList();
      };
      input.addEventListener('blur', finishEdit);
      input.addEventListener('keydown', evt => {
        if (evt.key === 'Enter') finishEdit();
      });
    });
    els.wordList.appendChild(row);
  });
}

// keep the word list's active/played highlighting in sync with playback
setInterval(() => {
  if (!state.words.length) return;
  const t = els.video.currentTime;
  const idx = state.words.findIndex(w => t >= w.start && t < w.end);
  [...els.wordList.children].forEach((row, i) => row.classList.toggle('playing', i === idx));
}, 80);

// ---------- Transcription ----------
els.transcribeBtn.addEventListener('click', async () => {
  const isHinglish = els.hinglishOpt?.checked;
  if (isHinglish) {
    if (!state.assemblyApiKey) {
      openAssemblyKeyModal();
      setStatus('Please enter your Hinglish API key for speech recognition.', true);
      return;
    }
    if (!state.apiKey) {
      openGroqKeyModal();
      setStatus('Please enter your Standard API key for Hinglish caption refinement.', true);
      return;
    }
  } else {
    if (!state.apiKey) {
      openGroqKeyModal();
      setStatus('Please enter your API key.', true);
      return;
    }
  }

  if (!state.videoFile) return;
  els.transcribeBtn.disabled = true;
  els.progressBar.classList.remove('hidden');
  try {
    let result;
    if (isHinglish) {
      setStatus('Transcribing Hinglish captions\u2026');
      result = await transcribeWithAssemblyAI(state.videoFile, state.assemblyApiKey, {
        onProgress: setStatus,
        groqApiKey: state.apiKey
      });
    } else {
      const { wavBlob } = await extractAudioAsWav(state.videoFile, msg => setStatus(msg));
      setStatus('Transcribing video captions\u2026');
      result = await transcribeWithGroq(wavBlob, state.apiKey, { onProgress: setStatus });
    }
    const { words, fullText } = result;
    state.words = words;
    state.overrides = {};
    els.transcriptBox.textContent = fullText || '(no speech detected)';
    els.transcriptBox.classList.remove('hidden');
    setStatus(`Transcribed ${words.length} words \u2014 fully timestamp-synced.`);
    goToStep(3);
    renderStyleGallery();
    selectPreset(state.presetId);
    renderWordList();
    els.wordEditPanel.classList.remove('hidden');
    els.exportBtn.disabled = !isExportSupported();
    if (!isExportSupported()) {
      setStatus('Transcribed! Note: this browser can\u2019t export (needs desktop Chrome/Edge) but preview still works.', true);
    }
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Transcription failed.', true);
  } finally {
    els.transcribeBtn.disabled = false;
    els.progressBar.classList.add('hidden');
  }
});

// ---------- Style gallery ----------
function renderStyleGallery(filterQuery = '') {
  els.styleGrid.innerHTML = '';
  const q = filterQuery.toLowerCase().trim();
  const filtered = PRESETS.filter(preset =>
    preset.name.toLowerCase().includes(q) ||
    preset.blurb.toLowerCase().includes(q) ||
    preset.id.toLowerCase().includes(q)
  );
  if (!filtered.length) {
    els.styleGrid.innerHTML = '<div style="grid-column: 1/-1; padding: 14px; text-align: center; color: var(--muted); font-size: 12px;">No matching caption styles found</div>';
    return;
  }
  filtered.forEach(preset => {
    const card = document.createElement('button');
    card.className = 'style-card' + (preset.id === state.presetId ? ' selected' : '');
    card.type = 'button';
    const canvas = document.createElement('canvas');
    canvas.width = 260; canvas.height = 112;
    card.appendChild(canvas);
    const nameRow = document.createElement('div'); nameRow.className = 'name-row';
    const name = document.createElement('span'); name.className = 'name'; name.textContent = preset.name;
    nameRow.appendChild(name);
    if (preset.wordLevel) {
      const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'word edit';
      nameRow.appendChild(tag);
    }
    const blurb = document.createElement('div'); blurb.className = 'blurb'; blurb.textContent = preset.blurb;
    card.appendChild(nameRow); card.appendChild(blurb);
    card.addEventListener('click', () => selectPreset(preset.id));
    els.styleGrid.appendChild(card);
    animateDemoCard(canvas, preset);
  });
}

els.styleSearchInput?.addEventListener('input', e => {
  renderStyleGallery(e.target.value);
});

const demoWords = [
  { word: 'Made', s: 0.0, e: 0.35 }, { word: 'with', s: 0.35, e: 0.6 },
  { word: 'motion', s: 0.6, e: 1.05 }, { word: 'graphics', s: 1.05, e: 1.6 }
];

function animateDemoCard(canvas, preset) {
  const ctx = canvas.getContext('2d');
  const isFocusStack = preset.id === 'focus-stack';

  const config = {
    ...preset.defaultConfig,
    fontSize: preset.id === 'big-word-pop' ? 20 : (isFocusStack ? 16 : 22),
    rowGap: isFocusStack ? 1.4 : preset.defaultConfig.rowGap,
    strokeWidth: Math.min(preset.defaultConfig.strokeWidth, 3),
    position: 'center'
  };

  const loopMs = isFocusStack ? 1800 : 2200;

  function frame(ts) {
    const t = ((ts || 0) % loopMs) / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sourceWords = isFocusStack
      ? [{ word: 'Made', s: 0.0, e: 0.4 }, { word: 'with', s: 0.4, e: 0.8 }, { word: 'motion', s: 0.8, e: 1.4 }]
      : demoWords;

    const words = sourceWords.map((w, i) => ({
      word: w.word, start: w.s, end: w.e, globalIndex: i,
      active: t >= w.s && t < w.e, hasStarted: t >= w.s,
      progress: Math.max(0, Math.min(1, (t - w.s) / Math.max(0.05, w.e - w.s))),
      overrideX: 0, overrideY: 0, overrideScale: 1
    }));

    let curIdx = words.findIndex(w => t >= w.start && t < w.end);
    if (curIdx === -1) {
      curIdx = words.findIndex(w => t < w.start);
      if (curIdx === -1) curIdx = words.length - 1;
    }

    preset.draw(ctx, {
      width: canvas.width,
      height: canvas.height,
      time: t,
      activeWords: words,
      currentLineStart: 0,
      config,
      words,
      currentWordGlobalIndex: curIdx
    });

    if (document.body.contains(canvas)) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function selectPreset(id) {
  state.presetId = id;
  state.config = { ...getPreset(id).defaultConfig };
  state.selectedWordIndex = null;
  [...els.styleGrid.children].forEach((card, i) => card.classList.toggle('selected', PRESETS[i].id === id));
  renderControls();
  const preset = getPreset(id);
  els.wordEditPanel?.classList.toggle('style-line-level', !preset.wordLevel);
}

// ---------- Style controls ----------
function renderControls() {
  const c = state.config;
  const preset = getPreset(state.presetId);
  let controlsHtml = `
    <div class="control-group">
      <label>Font size</label>
      <input type="range" id="ctrlSize" min="20" max="90" value="${c.fontSize}">
    </div>
    <div class="control-group">
      <label>Text / accent color</label>
      <div class="control-row">
        <input type="color" id="ctrlText" value="${c.textColor}">
        <input type="color" id="ctrlAccent" value="${c.accentColor}">
      </div>
    </div>
    <div class="control-group">
      <label>Position</label>
      <div class="segmented" id="ctrlPos">
        <button data-v="top" class="${c.position === 'top' ? 'on' : ''}">Top</button>
        <button data-v="center" class="${c.position === 'center' ? 'on' : ''}">Center</button>
        <button data-v="bottom" class="${c.position === 'bottom' ? 'on' : ''}">Bottom</button>
      </div>
    </div>
    <div class="control-group">
      <label>Words per line</label>
      <input type="range" id="ctrlWpl" min="1" max="8" value="${state.wordsPerLine}">
    </div>
    <div class="control-group">
      <label>Word gap</label>
      <input type="range" min="0" max="1" step="0.01" value="${c.wordGap ?? 0.40}" data-key="wordGap">
    </div>
    <div class="control-group">
      <label>Font (Google Fonts)</label>
      <div class="font-select-wrap">
        <select id="ctrlFontSelect" class="font-select">
          ${GOOGLE_FONTS.map(f => {
    const isMatch = c.fontFamily === f.value || c.fontFamily.startsWith(f.name);
    return `<option value="${f.value}" ${isMatch ? 'selected' : ''}>${f.name}</option>`;
  }).join('')}
          <option value="custom" ${!GOOGLE_FONTS.some(f => c.fontFamily === f.value || c.fontFamily.startsWith(f.name)) ? 'selected' : ''}>+ Custom Google Font…</option>
        </select>
      </div>
      <div id="customFontWrap" class="${!GOOGLE_FONTS.some(f => c.fontFamily === f.value || c.fontFamily.startsWith(f.name)) ? '' : 'hidden'}" style="margin-top: 6px;">
        <input type="text" id="customFontInput" placeholder="Enter Google Font e.g. Montserrat" value="${c.fontFamily.split(',')[0].replace(/['"]/g, '')}" class="custom-font-input">
      </div>
    </div>
  `;

  // Word-level presets get the entry animation picker
  if (preset.wordLevel && c.wordEntryAnim !== undefined) {
    const anims = [
      { v: 'pop', label: 'Pop' },
      { v: 'fade', label: 'Fade' },
      { v: 'slide-up', label: 'Slide' },
      { v: 'bounce', label: 'Bounce' },
      { v: 'scale', label: 'Scale' },
      { v: 'glitch', label: 'Glitch' },
    ];
    const cur = c.wordEntryAnim || 'pop';
    controlsHtml += `
    <div class="control-group">
      <label>Word entry animation</label>
      <div class="segmented" id="ctrlWordAnim" style="flex-wrap:wrap;">
        ${anims.map(a => `<button data-v="${a.v}" class="${cur === a.v ? 'on' : ''}">${a.label}</button>`).join('')}
      </div>
    </div>
  `;
  }

  if (preset.hasCutout || preset.id === 'portal-depth') {
    const isPortal = preset.id === 'portal-depth';
    const isSmart = preset.id === 'smart-depth';

    const label = isPortal ? 'Portal' : (isSmart ? 'Cutout' : 'Cutout');

    controlsHtml += `
      <div class="control-group">
        <label>${label} Position</label>
        <div class="control-row">
          <div class="control">
            <label class="small">X</label>
            <input type="range" min="0" max="1" step="0.01" 
              value="${isPortal ? (c.portalX ?? 0.5) : (isSmart ? (c.cutout1X ?? 0.5) : (c.cutoutX ?? 0.5))}"
              data-key="${isPortal ? 'portalX' : (isSmart ? 'cutout1X' : 'cutoutX')}">
          </div>
          <div class="control">
            <label class="small">Y</label>
            <input type="range" min="0" max="1" step="0.01" 
              value="${isPortal ? (c.portalY ?? 0.5) : (isSmart ? (c.cutout1Y ?? 0.55) : (c.cutoutY ?? 0.55))}"
              data-key="${isPortal ? 'portalY' : (isSmart ? 'cutout1Y' : 'cutoutY')}">
          </div>
        </div>
      </div>
      
      <div class="control-group">
        <label>${label} Size</label>
        <div class="control-row">
          <div class="control">
            <label class="small">W</label>
            <input type="range" min="0.05" max="1" step="0.01" 
              value="${isPortal ? (c.portalRadius ?? 0.28) : (isSmart ? (c.cutout1W ?? 0.22) : (c.cutoutWidth ?? 0.5))}"
              data-key="${isPortal ? 'portalRadius' : (isSmart ? 'cutout1W' : 'cutoutWidth')}">
          </div>
          <div class="control">
            <label class="small">H</label>
            <input type="range" min="0.05" max="1" step="0.01" 
              value="${isSmart ? (c.cutout1H ?? 0.26) : (isPortal ? (c.portalRadius ?? 0.28) : (c.cutoutHeight ?? 0.85))}"
              data-key="${isSmart ? 'cutout1H' : (isPortal ? 'portalRadius' : 'cutoutHeight')}" 
              ${isPortal ? 'disabled' : ''}>
          </div>
        </div>
      </div>
      
      <div class="control-group">
        <label>${isPortal ? 'Feather' : 'Feather'}</label>
        <input type="range" min="0" max="80" step="1" 
          value="${isPortal ? (c.portalFeather ?? 35) : (isSmart ? (c.cutout1Feather ?? 22) : (c.cutoutFeather ?? 30))}"
          data-key="${isPortal ? 'portalFeather' : (isSmart ? 'cutout1Feather' : 'cutoutFeather')}">
      </div>
    `;

    // Smart Depth second ellipse
    if (isSmart) {
      controlsHtml += `
        <div class="control-group">
          <label>Body Cutout Position</label>
          <div class="control-row">
            <div class="control">
              <label class="small">X</label>
              <input type="range" min="0" max="1" step="0.01" value="${c.cutout2X ?? 0.5}" data-key="cutout2X">
            </div>
            <div class="control">
              <label class="small">Y</label>
              <input type="range" min="0" max="1" step="0.01" value="${c.cutout2Y ?? 0.7}" data-key="cutout2Y">
            </div>
          </div>
        </div>
        <div class="control-group">
          <label>Body Cutout Size</label>
          <div class="control-row">
            <div class="control">
              <label class="small">W</label>
              <input type="range" min="0.05" max="1" step="0.01" value="${c.cutout2W ?? 0.36}" data-key="cutout2W">
            </div>
            <div class="control">
              <label class="small">H</label>
              <input type="range" min="0.05" max="1" step="0.01" value="${c.cutout2H ?? 0.44}" data-key="cutout2H">
            </div>
          </div>
        </div>
        <div class="control-group">
          <label>Body Feather</label>
          <input type="range" min="0" max="80" step="1" value="${c.cutout2Feather ?? 32}" data-key="cutout2Feather">
        </div>
      `;
    }
  }

  els.controls.innerHTML = controlsHtml;

  els.controls.querySelectorAll('[data-key]').forEach(input => {
    input.addEventListener('input', e => {
      c[e.target.dataset.key] = +e.target.value;
    });
  });

  $('#ctrlSize').addEventListener('input', e => c.fontSize = +e.target.value);
  $('#ctrlText').addEventListener('input', e => c.textColor = e.target.value);
  $('#ctrlAccent').addEventListener('input', e => c.accentColor = e.target.value);
  $('#ctrlWpl').addEventListener('input', e => state.wordsPerLine = +e.target.value);
  els.controls.querySelectorAll('#ctrlPos button').forEach(btn => {
    btn.addEventListener('click', () => {
      c.position = btn.dataset.v;
      els.controls.querySelectorAll('#ctrlPos button').forEach(b => b.classList.toggle('on', b === btn));
    });
  });
  const fontSelect = $('#ctrlFontSelect');
  const customWrap = $('#customFontWrap');
  const customInput = $('#customFontInput');

  if (fontSelect) {
    fontSelect.addEventListener('change', e => {
      const val = e.target.value;
      if (val === 'custom') {
        customWrap?.classList.remove('hidden');
        customInput?.focus();
      } else {
        customWrap?.classList.add('hidden');
        loadGoogleFont(val);
        c.fontFamily = val;
      }
    });
  }

  if (customInput) {
    customInput.addEventListener('input', e => {
      const fontName = e.target.value.trim();
      if (fontName) {
        loadGoogleFont(fontName);
        c.fontFamily = `"${fontName}", sans-serif`;
      }
    });
  }
  els.controls.querySelectorAll('#ctrlWordAnim button').forEach(btn => {
    btn.addEventListener('click', () => {
      c.wordEntryAnim = btn.dataset.v;
      els.controls.querySelectorAll('#ctrlWordAnim button').forEach(b => b.classList.toggle('on', b === btn));
    });
  });
}

// ---------- Export ----------
els.exportBtn.addEventListener('click', async () => {
  if (!state.words.length) { setStatus('Transcribe the video first.', true); return; }
  els.exportBtn.disabled = true;
  els.progressBar.classList.remove('hidden');
  els.video.pause();
  els.playBtn.classList.remove('is-playing');
  try {
    await (document.fonts?.ready || Promise.resolve());
    const preset = getPreset(state.presetId);
    const blob = await exportCaptionedVideo({
      videoEl: els.video,
      videoFile: state.videoFile,
      fps: 30,
      drawFrame: async (ctx, frame) => {
        const { activeWords, currentLineStart, currentWordGlobalIndex } = buildFrameWords(state.words, frame.time, state.wordsPerLine, state.overrides);
        preset.draw(ctx, { ...frame, activeWords, currentLineStart, config: state.config, words: state.words, currentWordGlobalIndex });
      },
      onProgress: (frac, label) => {
        els.progressFill.style.width = `${Math.round(frac * 100)}%`;
        setStatus(label);
      }
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (state.videoFile.name.replace(/\.[^.]+$/, '') || 'captioned') + '-captioned.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus('Exported! Download started.');
    goToStep(4);
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Export failed.', true);
  } finally {
    els.exportBtn.disabled = false;
    els.progressBar.classList.add('hidden');
  }
});

// ---------- Misc ----------
function setStatus(msg, isErr = false) {
  els.statusLine.textContent = msg;
  els.statusLine.classList.toggle('err', !!isErr);
}
function goToStep(n) {
  state.step = n;
  els.steps.forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
    el.classList.toggle('done', i + 1 < n);
  });
}
goToStep(1);
renderStyleGallery();
selectPreset(state.presetId);
syncWordEditFields();
