import { clamp01, easeOutBack, yForPosition, xCenter, baseFont, drawStrokedText, pushHitbox, layoutRow } from './utils.js';

function wordEntryAnim(w, config) {
  const anim = config.wordEntryAnim || 'glitch';
  const entered = w.hasStarted;
  if (!entered) return { dy: 0, alpha: 0, glitchAmp: 0 };
  switch (anim) {
    case 'fade':     return { dy: 0, alpha: clamp01(w.progress * 4), glitchAmp: 0 };
    case 'slide-up': return { dy: (1 - easeOutBack(clamp01(w.progress * 2))) * 30, alpha: clamp01(w.progress * 4), glitchAmp: 0 };
    case 'bounce':   return { dy: (1 - easeOutBack(clamp01(w.progress * 2.2))) * 40, alpha: 1, glitchAmp: 0 };
    case 'pop':      return { dy: 0, alpha: 1, glitchAmp: 0 };
    case 'glitch':
    default:
      return { dy: 0, alpha: 1, glitchAmp: w.active ? (1 - clamp01(w.progress / 0.25)) * 6 : 0 };
  }
}

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;
  const y = yForPosition(config, height);
  layoutRow(ctx, activeWords, config, xCenter(width, config), y, (w, cx, cy, wWidth, fitScale) => {
    const { dy, alpha, glitchAmp } = wordEntryAnim(w, config);
    const px = cx + w.overrideX, py = cy + w.overrideY + dy;
    const scale = w.overrideScale * fitScale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    if (glitchAmp > 0.3) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.font = baseFont(config, 800);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FF3D6B';
      ctx.fillText(w.word, -glitchAmp, 0);
      ctx.fillStyle = '#33E0F0';
      ctx.fillText(w.word, glitchAmp, 0);
      ctx.restore();
    }
    drawStrokedText(ctx, w.word, 0, 0, config, { color: w.active ? config.accentColor : config.textColor });
    ctx.restore();
    pushHitbox(hitboxOut, w, px, py, wWidth * scale, config.fontSize * 1.3 * scale);
  }, width);
}

export default {
  id: 'glitch-shift', name: 'Glitch Shift', blurb: 'RGB-split glitch as each word lands', draw, wordLevel: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif', fontSize: 62, textColor: '#F5F6FA', accentColor: '#FFD23F',
    strokeColor: '#0B0E14', strokeWidth: 6, position: 'bottom', shadow: false,
    wordGap: 0.40, blockOffsetX: 0, blockOffsetY: 0, wordEntryAnim: 'glitch'
  }
};
