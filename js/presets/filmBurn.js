// filmBurn.js — Warm sepia/orange film-burn caption style
import { clamp01, easeOutBack, yForPosition, xCenter, baseFont, roundRect, pushHitbox, layoutRow } from './utils.js';

function seededRand(seed) {
  let x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut, time } = f;
  if (!activeWords.length) return;

  const y = yForPosition(config, height);
  const cx = xCenter(width, config);

  layoutRow(ctx, activeWords, config, cx, y, (w, wordCx, wordCy, wWidth, fitScale) => {
    const entered = w.hasStarted;
    const inT = clamp01(w.progress * 2.5);
    const alpha = entered ? clamp01(inT * 1.8) : 0;
    if (alpha <= 0.01) { pushHitbox(hitboxOut, w, wordCx, wordCy, wWidth, config.fontSize); return; }

    const scale = fitScale * w.overrideScale * (entered ? easeOutBack(clamp01(inT * 1.5)) : 0.5);
    const px = wordCx + w.overrideX, py = wordCy + w.overrideY;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py);
    ctx.scale(scale, scale);

    const fs = config.fontSize;
    const padX = fs * 0.3, padY = fs * 0.18;
    const bx = -wWidth / 2 - padX, bw = wWidth + padX * 2, bh = fs + padY * 2;
    const by = -fs / 2 - padY;

    if (w.active) {
      const g = ctx.createLinearGradient(bx, by, bx, by + bh);
      g.addColorStop(0, 'rgba(255, 140, 0, 0.92)');
      g.addColorStop(0.5, config.accentColor);
      g.addColorStop(1, 'rgba(200, 60, 0, 0.85)');
      ctx.fillStyle = g;
      roundRect(ctx, bx, by, bw, bh, fs * 0.12);
      ctx.fill();

      const grainAmp = 18;
      for (let gi = 0; gi < 8; gi++) {
        const rx = (seededRand(w.globalIndex * 13 + gi * 7) - 0.5) * bw;
        const ry = (seededRand(w.globalIndex * 7 + gi * 11) - 0.5) * bh;
        const rr = seededRand(w.globalIndex + gi + Math.floor(time * 12)) * grainAmp;
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#FFF0B0';
        ctx.beginPath();
        ctx.arc(rx, ry, Math.max(0.5, rr * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
      }

      const leak = ctx.createLinearGradient(bx, by, bx + bw * 0.6, by + bh * 0.3);
      leak.addColorStop(0, 'rgba(255,240,180,0.4)');
      leak.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = leak;
      roundRect(ctx, bx, by, bw * 0.6, bh * 0.4, fs * 0.12);
      ctx.fill();
    }

    ctx.font = baseFont(config, 800);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const txtColor = w.active ? (config.highlightTextColor || '#1A0800') : config.textColor;
    if (config.strokeWidth > 0 && !w.active) {
      ctx.lineWidth = config.strokeWidth;
      ctx.strokeStyle = config.strokeColor;
      ctx.lineJoin = 'round';
      ctx.strokeText(w.word, 0, 0);
    }
    ctx.fillStyle = txtColor;
    ctx.fillText(w.word, 0, 0);

    ctx.restore();
    pushHitbox(hitboxOut, w, px, py, wWidth * scale, config.fontSize * 1.3 * scale);
  }, width);
}

export default {
  id: 'film-burn',
  name: 'Film Burn',
  blurb: 'Warm film-burn gradient with grain & light leaks on active word',
  draw,
  wordLevel: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 62,
    textColor: '#F5E8D0',
    accentColor: '#E85C00',
    highlightTextColor: '#1A0800',
    strokeColor: '#1A0800',
    strokeWidth: 5,
    position: 'bottom',
    shadow: false,
    wordGap: 0.40,
    blockOffsetX: 0,
    blockOffsetY: 0,
    wordEntryAnim: 'fade'
  }
};
