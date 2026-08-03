// Focus Stack — 3-layer teleprompter cycle:
// Layer 1 (W0) -> TOP line (Left-shifted white)
// Layer 2 (W1) -> MIDDLE line (HUGE Mint/Green Gradient focus)
// Layer 3 (W2) -> BOTTOM line (Right-shifted white)
// Words reveal sequentially (Top -> Middle -> Bottom). Once all 3 layers complete, all 3 vanish and the next triplet starts on TOP line.
// Auto-fits to prevent any canvas edge overflow.
import { clamp01, easeOutBack, yForPosition, xCenter, drawStrokedText, pushHitbox } from './utils.js';

function darken(hex, amt) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  const n = hex.replace('#', '');
  if (n.length !== 6) return hex;
  const r = Math.max(0, parseInt(n.substring(0, 2), 16) * (1 - amt));
  const g = Math.max(0, parseInt(n.substring(2, 4), 16) * (1 - amt));
  const b = Math.max(0, parseInt(n.substring(4, 6), 16) * (1 - amt));
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

function draw(ctx, f) {
  const { width, height, config, hitboxOut } = f;

  // 1. Resolve full transcript pool
  let pool = [];
  if (f.words && f.words.length) {
    pool = f.words;
  } else if (f.activeWords && f.activeWords.length) {
    pool = f.activeWords;
  }
  if (!pool.length) return;

  // 2. Find currently active word global index
  let curIdx = f.currentWordGlobalIndex;
  if (typeof curIdx !== 'number' || curIdx < 0 || curIdx >= pool.length) {
    curIdx = pool.findIndex(w => f.time >= w.start && f.time < w.end);
    if (curIdx === -1) {
      curIdx = pool.findIndex(w => f.time < w.start);
      if (curIdx === -1) curIdx = pool.length - 1;
    }
  }
  if (curIdx < 0) return;

  // 3. Group every 3 words into a fixed triplet cycle [W0 = Top, W1 = Mid, W2 = Bot]
  const groupSize = 3;
  const groupIndex = Math.floor(curIdx / groupSize);
  const groupStart = groupIndex * groupSize;
  const group = pool.slice(groupStart, groupStart + groupSize);
  if (!group.length) return;

  const cx0 = xCenter(width, config);
  const centerY0 = yForPosition(config, height);
  const fontSize = config.fontSize || 72;
  const rowGap = fontSize * (config.rowGap ?? 1.18);

  // Determine middle word for horizontal stagger calculation
  const midWord = group[1] || group[0];
  ctx.save();
  ctx.font = `800 ${fontSize * 1.4}px ${config.fontFamily}`;
  const midWidth = ctx.measureText(midWord.word).width;
  ctx.restore();

  const hOffset = midWidth * 0.30;

  // Slot mappings for 3-layer stack
  // W0 -> Top (shifted left)
  // W1 -> Middle (centered, HUGE green)
  // W2 -> Bottom (shifted right)
  const slotConfigs = [
    { word: group[0], dy: -1, dx: -hOffset, isMiddle: false, scaleBase: 0.65 },
    { word: group[1], dy: 0, dx: 0, isMiddle: true, scaleBase: 1.35 },
    { word: group[2], dy: 1, dx: hOffset, isMiddle: false, scaleBase: 0.65 }
  ];

  // If group only has 1 or 2 words (e.g. at end of transcript)
  if (group.length === 1) {
    slotConfigs[0] = { word: group[0], dy: 0, dx: 0, isMiddle: true, scaleBase: 1.35 };
    slotConfigs[1].word = null;
    slotConfigs[2].word = null;
  } else if (group.length === 2) {
    slotConfigs[0] = { word: group[0], dy: -1, dx: -hOffset, isMiddle: false, scaleBase: 0.65 };
    slotConfigs[1] = { word: group[1], dy: 0, dx: 0, isMiddle: true, scaleBase: 1.35 };
    slotConfigs[2].word = null;
  }

  slotConfigs.forEach(({ word: w, dy, dx, isMiddle, scaleBase }) => {
    if (!w) return;
    // Layer reveals ONLY when word timestamp starts
    if (f.time < w.start) return;

    const blockScale = w.overrideScale || 1;
    const isActive = f.time >= w.start && f.time < w.end;
    const t = clamp01((f.time - w.start) / Math.max(0.05, w.end - w.start));
    const bounce = Math.min(easeOutBack(t * 3.5), 1.15);

    let scale = (scaleBase + (isActive ? 0.22 : 0.05) * bounce) * blockScale;

    ctx.save();
    ctx.font = `${isMiddle ? 800 : 700} ${fontSize}px ${config.fontFamily}`;
    const measuredW = ctx.measureText(w.word).width;

    // Canvas Edge Overflow Protection: Auto-scale down text if wider than 86% of screen
    const maxW = width * 0.86;
    if (measuredW * scale > maxW) {
      scale = maxW / measuredW;
    }

    // Clamp horizontal center within canvas safe boundaries
    const halfW = (measuredW * scale) / 2;
    const px = Math.max(halfW + 16, Math.min(width - halfW - 16, cx0 + dx + (w.overrideX || 0)));
    const py = centerY0 + dy * rowGap * blockScale + (w.overrideY || 0);

    ctx.translate(px, py);
    ctx.scale(scale, scale);

    if (isMiddle) {
      const accent = config.accentColor || '#5CE58A';
      const grad = ctx.createLinearGradient(0, -fontSize * 0.4, 0, fontSize * 0.4);
      grad.addColorStop(0, '#A8FF78');
      grad.addColorStop(0.5, accent);
      grad.addColorStop(1, darken(accent, 0.45));

      drawStrokedText(ctx, w.word, 0, 0, { ...config, fontSize }, {
        color: grad,
        weight: 800
      });
    } else {
      const color = config.textColor || '#FFFFFF';
      drawStrokedText(ctx, w.word, 0, 0, { ...config, fontSize, strokeWidth: Math.min(config.strokeWidth, 4) }, {
        color,
        weight: 700
      });
    }
    ctx.restore();

    pushHitbox(hitboxOut, w, px, py, measuredW * scale, fontSize * 1.3 * scale);
  });
}

export default {
  id: 'focus-stack',
  name: 'Focus Stack',
  blurb: '3-layer cycle: Top (W0) \u2192 Mid HUGE (W1) \u2192 Bot (W2), then clears for next triplet',
  draw,
  wordLevel: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 72,
    textColor: '#FFFFFF',
    accentColor: '#5CE58A',
    strokeColor: '#07090E',
    strokeWidth: 8,
    position: 'center',
    shadow: true,
    rowGap: 1.18
  }
};
