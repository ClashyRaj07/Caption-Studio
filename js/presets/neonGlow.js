// Neon Glow — ALL words visible from phrase start, multi-line auto-wrapping at 100% font size.
import { clamp01, yForPosition, xCenter, baseFont, pushHitbox, layoutRow } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, time, hitboxOut } = f;
  if (!activeWords.length) return;
  const y = yForPosition(config, height);
  layoutRow(ctx, activeWords, config, xCenter(width, config), y, (w, cx, cy, wWidth, fitScale) => {
    const pulse = w.active ? 0.7 + 0.3 * Math.sin(time * 14) : 0;
    const px = cx + w.overrideX, py = cy + w.overrideY;
    const scale = w.overrideScale * fitScale;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = baseFont(config, 800);
    ctx.shadowColor = config.accentColor;
    ctx.shadowBlur = w.active ? 22 + 14 * pulse : (w.hasStarted ? 5 : 2);
    const color = w.active ? config.accentColor
      : w.hasStarted ? config.textColor
      : 'rgba(237,239,244,0.4)';
    ctx.fillStyle = color;
    ctx.fillText(w.word, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
    pushHitbox(hitboxOut, w, px, py, wWidth * scale, config.fontSize * 1.3 * scale);
  }, width);
}

export default {
  id: 'neon-glow', name: 'Neon Glow', blurb: 'Glowing pulse on the active word', draw, wordLevel: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif', fontSize: 62, textColor: '#EDEFF4', accentColor: '#FF3D81',
    strokeColor: '#0B0E14', strokeWidth: 0, position: 'bottom', shadow: false,
    wordGap: 0.40, blockOffsetX: 0, blockOffsetY: 0, wordEntryAnim: 'fade'
  }
};
