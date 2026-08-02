// presets/utils.js
// Shared drawing helpers used by every caption preset. Keeping this logic in
// one place means every preset lays text out, strokes it, and reports its
// hitboxes the same way — new presets just call these instead of
// reimplementing canvas math.
//
// IMPORTANT: presets must never paint outside the caption text/background
// itself (no full-canvas fills, no blend modes like 'screen'/'multiply'
// applied to large areas). That's what makes a preset "caption-only" and
// keeps it from tinting the video underneath. See DOCS.md.

export function clamp01(x) { return Math.max(0, Math.min(1, x)); }
export function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

export function baseFont(config, weight = 800, sizeOverride) {
  return `${weight} ${sizeOverride || config.fontSize}px ${config.fontFamily}`;
}

// Base vertical anchor for a style's position setting, plus the whole-block
// drag offset (blockOffsetX/Y) that every line-level and word-level preset
// respects so the user can drag the caption block anywhere in the preview.
export function yForPosition(config, height) {
  let y;
  if (config.position === 'top') y = height * 0.14;
  else if (config.position === 'center') y = height * 0.5;
  else y = height * 0.84;
  return y + (config.blockOffsetY || 0);
}
export function xCenter(width, config) {
  return width / 2 + (config.blockOffsetX || 0);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Plain stroked/filled text. No compositing modes — always source-over —
// so a preset built from this primitive can never tint the video.
export function drawStrokedText(ctx, text, x, y, config, opts = {}) {
  ctx.font = baseFont(config, opts.weight || 800, opts.size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalCompositeOperation = 'source-over';
  if (config.strokeWidth > 0) {
    ctx.lineWidth = config.strokeWidth;
    ctx.strokeStyle = config.strokeColor;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  if (config.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; }
  else { ctx.shadowBlur = 0; }
  ctx.fillStyle = opts.color || config.textColor;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

export function pushHitbox(hitboxOut, w, x, y, boxW, boxH) {
  if (!hitboxOut) return;
  hitboxOut.push({ index: w.globalIndex, x, y, w: boxW, h: boxH });
}

// Reports a single hitbox for the whole caption block — used by line-level
// presets (typewriter, slide-up, minimal) so the whole line can be dragged
// as one unit in the preview, same gesture as dragging a single word.
export function pushBlockHitbox(hitboxOut, x, y, boxW, boxH) {
  if (!hitboxOut) return;
  hitboxOut.push({ index: 'block', x, y, w: boxW, h: boxH });
}

// Lays a row of words out horizontally, calling `place(w, cx, widthOfWord,
// fitScale)` for each — used by every word-by-word preset so spacing math
// lives once.
//
// fitScale < 1 ONLY when the total line width genuinely overflows the canvas
// (very rare with proper wordsPerLine). It no longer pre-shrinks to reserve
// headroom for animation scale growth — that was causing every phrase to
// render at a different font size, breaking visual consistency.
// Lays out words in one or more centered lines, wrapping automatically when total width
// exceeds maxWidth (88% of canvas width).
// Font size remains 100% CONSTANT (fitScale = 1.0) across all frames/phrases in the video.
export function layoutRow(ctx, words, config, centerX, centerY, place, maxWidth = Infinity) {
  // Support legacy signature where centerY was omitted: layoutRow(ctx, words, config, centerX, place, maxWidth)
  if (typeof centerY === 'function') {
    maxWidth = place || Infinity;
    place = centerY;
    centerY = yForPosition(config, ctx.canvas?.height || 1080);
  }

  ctx.font = baseFont(config);
  const spacing = config.fontSize * (config.wordGap ?? 0.4);
  const safeMaxWidth = (maxWidth < Infinity ? maxWidth : (ctx.canvas?.width || 1920)) * 0.88;

  const lines = [];
  let currentLine = [];
  let currentLineWidth = 0;

  words.forEach(w => {
    const wWidth = ctx.measureText(w.word).width;
    const addedWidth = currentLine.length > 0 ? spacing + wWidth : wWidth;

    if (currentLine.length > 0 && (currentLineWidth + addedWidth > safeMaxWidth)) {
      lines.push({ words: currentLine, width: currentLineWidth });
      currentLine = [{ word: w, width: wWidth }];
      currentLineWidth = wWidth;
    } else {
      currentLine.push({ word: w, width: wWidth });
      currentLineWidth += addedWidth;
    }
  });
  if (currentLine.length > 0) {
    lines.push({ words: currentLine, width: currentLineWidth });
  }

  const lineHeight = config.fontSize * 1.32;
  const totalHeight = lines.length * lineHeight;
  const startY = centerY - (totalHeight / 2) + (lineHeight / 2);

  lines.forEach((line, lineIdx) => {
    const lineY = startY + lineIdx * lineHeight;
    let x = centerX - line.width / 2;

    line.words.forEach(item => {
      const cx = x + item.width / 2;
      place(item.word, cx, lineY, item.width, 1.0);
      x += item.width + spacing;
    });
  });
}

// Draws `text` as a single centred string at `config.fontSize * sizeMult`,
// automatically scaling it down if it would overflow `maxWidth` (92% of canvas
// width). Returns the final rendered pixel width so callers can size
// background panels. Used by all line-level depth presets.
export function drawFittedLine(ctx, text, cx, cy, config, sizeMult = 1.0, maxWidth = Infinity, opts = {}) {
  const size = config.fontSize * sizeMult;
  ctx.font = baseFont(config, opts.weight || 800, size);
  const measured = ctx.measureText(text).width;
  const safeW = maxWidth * 0.92;
  const scale = measured > safeW ? safeW / measured : 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, 1); // horizontal scale only — preserves font height
  drawStrokedText(ctx, text, 0, 0, { ...config, fontSize: size }, opts);
  ctx.restore();
  return measured * scale;
}
