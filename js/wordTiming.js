// wordTiming.js
// Builds the word-timestamp-synced draw context for a given playback time.
// Not a preset itself — every preset consumes its output (`activeWords`,
// `currentLineStart`), so it lives at the top level rather than inside
// js/presets/.
import { clamp01 } from './presets/utils.js';

/**
 * `overrides` is a plain object keyed by the word's global index in the
 * full transcript: { [globalIndex]: { offsetX, offsetY, scale } }.
 */
export function buildFrameWords(words, time, wordsPerLine = 5, overrides = {}) {
  if (!words || !words.length) return { activeWords: [], currentLineStart: 0, currentWordGlobalIndex: -1 };
  let idx = words.findIndex(w => time >= w.start && time < w.end);
  if (idx === -1) {
    idx = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].start <= time) idx = i; else break;
    }
    if (idx === -1) return { activeWords: [], currentLineStart: 0, currentWordGlobalIndex: -1 };
  }
  const lineIndex = Math.floor(idx / wordsPerLine);
  const start = lineIndex * wordsPerLine;
  const end = Math.min(words.length, start + wordsPerLine);
  const slice = words.slice(start, end);
  const currentLineStart = slice[0].start;
  const activeWords = slice.map((w, i) => {
    const globalIndex = start + i;
    const ov = overrides[globalIndex] || {};
    return {
      word: w.word,
      start: w.start,
      end: w.end,
      globalIndex,
      active: time >= w.start && time < w.end,
      hasStarted: time >= w.start,
      progress: clamp01((time - w.start) / Math.max(0.05, w.end - w.start)),
      overrideX: ov.offsetX || 0,
      overrideY: ov.offsetY || 0,
      overrideScale: ov.scale || 1
    };
  });
  return { activeWords, currentLineStart, currentWordGlobalIndex: idx };
}
