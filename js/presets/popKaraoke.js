// Pop Karaoke — industry standard: ALL words visible from phrase start,
// multi-line auto-wrapping at 100% constant font size across all frames.
import { clamp01, easeOutBack, yForPosition, xCenter, drawStrokedText, pushHitbox, layoutRow } from './utils.js';

function activeWordScale(w, config) {
  if (!w.active) return 1;
  const t = clamp01(w.progress * 3);
  const anim = config.wordEntryAnim || 'pop';
  switch (anim) {
    case 'bounce': return 1 + 0.22 * easeOutBack(clamp01(w.progress * 2.2));
    case 'scale':  return 0.75 + 0.45 * easeOutBack(clamp01(w.progress * 2));
    case 'pop':
    default:       return 1 + 0.28 * Math.sin(Math.min(t, 1) * Math.PI);
  }
}

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;
  const y = yForPosition(config, height);
  layoutRow(ctx, activeWords, config, xCenter(width, config), y, (w, cx, cy, wWidth, fitScale) => {
    const scale = activeWordScale(w, config) * w.overrideScale * fitScale;
    const px = cx + w.overrideX, py = cy + w.overrideY;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    const color = w.active ? config.accentColor
      : w.hasStarted ? config.textColor
      : 'rgba(245,246,250,0.45)';
    drawStrokedText(ctx, w.word, 0, 0, config, { color });
    ctx.restore();
    pushHitbox(hitboxOut, w, px, py, wWidth * scale, config.fontSize * 1.3 * scale);
  }, width);
}

export default {
  id: 'pop-karaoke', name: 'Pop Karaoke', blurb: 'Words punch up & highlight as spoken', draw, wordLevel: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif', fontSize: 62, textColor: '#F5F6FA', accentColor: '#FF3D81',
    strokeColor: '#0B0E14', strokeWidth: 8, position: 'bottom', shadow: false,
    wordGap: 0.40, blockOffsetX: 0, blockOffsetY: 0, wordEntryAnim: 'pop'
  }
};
