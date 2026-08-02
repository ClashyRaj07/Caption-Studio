// Marker Sweep — ALL words visible, multi-line auto-wrapping at 100% font size.
import { clamp01, yForPosition, xCenter, roundRect, drawStrokedText, pushHitbox, layoutRow } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;
  const y = yForPosition(config, height);
  layoutRow(ctx, activeWords, config, xCenter(width, config), y, (w, cx, cy, wWidth, fitScale) => {
    const px = cx + w.overrideX, py = cy + w.overrideY;
    const scale = w.overrideScale * fitScale;
    if (w.active) {
      const sweep = clamp01(w.progress * 1.6);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = config.accentColor;
      const boxW = wWidth * scale + 20;
      const boxH = config.fontSize * scale * 0.95;
      roundRect(ctx, px - boxW / 2, py - boxH / 2, boxW * sweep, boxH, 6);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    const color = w.active ? config.textColor
      : w.hasStarted ? config.textColor
      : 'rgba(11,14,20,0.45)';
    drawStrokedText(ctx, w.word, 0, 0, { ...config, strokeWidth: Math.min(config.strokeWidth, 4) }, { color });
    ctx.restore();
    pushHitbox(hitboxOut, w, px, py, wWidth * scale, config.fontSize * 1.3 * scale);
  }, width);
}

export default {
  id: 'marker-sweep', name: 'Marker Sweep', blurb: 'Highlighter box wipes across the word', draw, wordLevel: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif', fontSize: 62, textColor: '#0B0E14', accentColor: '#FFD23F',
    strokeColor: '#0B0E14', strokeWidth: 0, position: 'bottom', shadow: false,
    wordGap: 0.40, blockOffsetX: 0, blockOffsetY: 0, wordEntryAnim: 'fade'
  }
};
