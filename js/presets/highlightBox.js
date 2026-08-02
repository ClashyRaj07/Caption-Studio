// Highlight Box — industry standard: ALL words visible from phrase start.
// Multi-line auto-wrapping at 100% constant font size across all frames.
import { clamp01, easeOutBack, yForPosition, xCenter, baseFont, roundRect, pushHitbox, layoutRow } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;
  const y = yForPosition(config, height);
  const upper = activeWords.map(w => ({ ...w, word: w.word.toUpperCase() }));
  layoutRow(ctx, upper, config, xCenter(width, config), y, (w, cx, cy, wWidth, fitScale) => {
    const anim = config.wordEntryAnim || 'pop';
    let activeBoost = 1;
    if (w.active) {
      switch (anim) {
        case 'bounce': activeBoost = 1 + 0.12 * easeOutBack(clamp01(w.progress * 2.5)); break;
        case 'scale':  activeBoost = 0.8 + 0.3 * easeOutBack(clamp01(w.progress * 2)); break;
        case 'pop':
        default:       activeBoost = 1 + 0.10 * easeOutBack(clamp01(w.progress * 3)); break;
      }
    }
    const scale = fitScale * w.overrideScale * activeBoost;
    const px = cx + w.overrideX, py = cy + w.overrideY;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    ctx.font = baseFont(config, 800);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (w.active) {
      const padX = config.fontSize * 0.28, padY = config.fontSize * 0.16;
      ctx.fillStyle = config.accentColor;
      roundRect(ctx, -wWidth / 2 - padX, -config.fontSize / 2 - padY, wWidth + padX * 2, config.fontSize + padY * 2, config.fontSize * 0.18);
      ctx.fill();
    }

    if (config.strokeWidth > 0 && !w.active) {
      ctx.lineWidth = config.strokeWidth;
      ctx.strokeStyle = config.strokeColor;
      ctx.lineJoin = 'round';
      ctx.strokeText(w.word, 0, 0);
    }
    const color = w.active ? (config.highlightTextColor || '#0B0E14')
      : w.hasStarted ? config.textColor
      : 'rgba(255,255,255,0.45)';
    ctx.fillStyle = color;
    ctx.fillText(w.word, 0, 0);
    ctx.restore();
    pushHitbox(hitboxOut, w, px, py, wWidth * scale, config.fontSize * 1.3 * scale);
  }, width);
}

export default {
  id: 'highlight-box', name: 'Highlight Box', blurb: 'Solid highlight box pops behind the active word', draw, wordLevel: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif', fontSize: 62, textColor: '#FFFFFF', accentColor: '#C6FF3D',
    highlightTextColor: '#0B0E14', strokeColor: '#0B0E14', strokeWidth: 7, position: 'bottom', shadow: false,
    wordGap: 0.40, blockOffsetX: 0, blockOffsetY: 0, wordEntryAnim: 'pop'
  }
};
