// inkStamp.js — Dramatic ink stamp press with ink spread on the active word
import { clamp01, easeOutBack, yForPosition, xCenter, baseFont, roundRect, pushHitbox, layoutRow } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;

  const y = yForPosition(config, height);
  const upper = activeWords.map(w => ({ ...w, word: w.word.toUpperCase() }));
  layoutRow(ctx, upper, config, xCenter(width, config), y, (w, cx, cy, wWidth, fitScale) => {
    const entered = w.hasStarted;
    if (!entered) { pushHitbox(hitboxOut, w, cx, cy, wWidth, config.fontSize); return; }

    const inT = clamp01(w.progress * 4); // fast stamp
    const stampScale = easeOutBack(inT); // overshoots and settles
    const alpha = clamp01(inT * 2.5);
    const px = cx + w.overrideX, py = cy + w.overrideY;
    const scale = fitScale * w.overrideScale * (0.3 + 0.7 * stampScale);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py);
    ctx.scale(scale, scale);

    const fs = config.fontSize;

    if (w.active) {
      // Ink bleed shadow layers (simulate ink spread)
      const inkLayers = [
        { blur: fs * 0.5, alpha: 0.22, spread: 1.25 },
        { blur: fs * 0.2, alpha: 0.45, spread: 1.08 },
        { blur: 0,        alpha: 1.0,  spread: 1.0  },
      ];
      inkLayers.forEach(({ blur, alpha: la, spread }) => {
        const padX = fs * 0.28 * spread, padY = fs * 0.16 * spread;
        const bx = -wWidth / 2 - padX, by = -fs / 2 - padY;
        const bw = wWidth + padX * 2, bh = fs + padY * 2;
        ctx.save();
        ctx.globalAlpha = la;
        if (blur > 0) ctx.filter = `blur(${blur}px)`;
        ctx.fillStyle = config.accentColor;
        roundRect(ctx, bx, by, bw, bh, fs * 0.06);
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
      });

      // Stamp border line (distressed edge)
      ctx.save();
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = fs * 0.06;
      ctx.globalAlpha = 0.5;
      const padX = fs * 0.3, padY = fs * 0.18;
      roundRect(ctx, -wWidth / 2 - padX, -fs / 2 - padY, wWidth + padX * 2, fs + padY * 2, fs * 0.06);
      ctx.setLineDash([fs * 0.15, fs * 0.08]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Text
    ctx.font = baseFont(config, 900);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (config.strokeWidth > 0 && !w.active) {
      ctx.lineWidth = config.strokeWidth;
      ctx.strokeStyle = config.strokeColor;
      ctx.lineJoin = 'round';
      ctx.strokeText(w.word, 0, 0);
    }
    ctx.fillStyle = w.active ? (config.highlightTextColor || '#0B0E14') : config.textColor;
    ctx.fillText(w.word, 0, 0);
    ctx.restore();

    pushHitbox(hitboxOut, w, px, py, wWidth * scale, config.fontSize * 1.4 * scale);
  }, width);
}

export default {
  id: 'ink-stamp',
  name: 'Ink Stamp',
  blurb: 'Each word presses like a rubber stamp with ink bleed effect',
  draw,
  wordLevel: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 62,
    textColor: '#FFFFFF',
    accentColor: '#FF3D81',
    highlightTextColor: '#FFFFFF',
    strokeColor: '#0B0E14',
    strokeWidth: 7,
    position: 'bottom',
    shadow: false,
    wordGap: 0.40,
    blockOffsetX: 0,
    blockOffsetY: 0
  }
};
