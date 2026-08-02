import { clamp01, easeOutBack, yForPosition, xCenter, drawStrokedText, pushHitbox, layoutRow } from './utils.js';

function wordEntryAnim(w, config) {
  const anim = config.wordEntryAnim || 'bounce';
  const entered = w.hasStarted;
  if (!entered) return { dy: 40, alpha: 0 };
  switch (anim) {
    case 'fade':     return { dy: 0, alpha: clamp01(w.progress * 4) };
    case 'slide-up': return { dy: (1 - easeOutBack(clamp01(w.progress * 2))) * 30, alpha: clamp01(w.progress * 4) };
    case 'pop':      return { dy: 0, alpha: 1 };
    case 'scale':    return { dy: 0, alpha: easeOutBack(clamp01(w.progress * 2)) };
    case 'bounce':
    default:
      return {
        dy: (1 - easeOutBack(clamp01(w.progress * 2.2))) * 40,
        alpha: clamp01(w.progress * 4)
      };
  }
}

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;
  const y = yForPosition(config, height);
  layoutRow(ctx, activeWords, config, xCenter(width, config), y, (w, cx, cy, wWidth, fitScale) => {
    const { dy, alpha } = wordEntryAnim(w, config);
    const scale = w.overrideScale * fitScale;
    const px = cx + w.overrideX, py = cy + dy + w.overrideY;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    drawStrokedText(ctx, w.word, 0, 0, config, { color: w.active ? config.accentColor : config.textColor });
    ctx.restore();
    pushHitbox(hitboxOut, w, px, py, wWidth * scale, config.fontSize * 1.3 * scale);
  }, width);
}

export default {
  id: 'bounce', name: 'Bounce In', blurb: 'Each word springs in from below', draw, wordLevel: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif', fontSize: 62, textColor: '#F5F6FA', accentColor: '#FFD23F',
    strokeColor: '#0B0E14', strokeWidth: 7, position: 'bottom', shadow: false,
    wordGap: 0.40, blockOffsetX: 0, blockOffsetY: 0, wordEntryAnim: 'bounce'
  }
};
