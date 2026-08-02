import { yForPosition, xCenter, baseFont, pushHitbox, layoutRow } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, time, hitboxOut } = f;
  if (!activeWords.length) return;
  const y = yForPosition(config, height);
  layoutRow(ctx, activeWords, config, xCenter(width, config), y, (w, cx, cy, wWidth, fitScale) => {
    const bob = Math.sin(time * 5 + w.globalIndex) * 5;
    const px = cx + w.overrideX, py = cy + w.overrideY + bob;
    const scale = w.overrideScale * fitScale * (w.active ? 1.08 : 1);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    ctx.font = baseFont(config, 800);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const hue = (time * 60 + w.globalIndex * 30) % 360;
    const grad = ctx.createLinearGradient(-wWidth / 2, 0, wWidth / 2, 0);
    grad.addColorStop(0, `hsl(${hue},90%,65%)`);
    grad.addColorStop(1, `hsl(${(hue + 80) % 360},90%,65%)`);
    if (config.strokeWidth > 0) {
      ctx.lineWidth = config.strokeWidth; ctx.strokeStyle = config.strokeColor; ctx.lineJoin = 'round';
      ctx.strokeText(w.word, 0, 0);
    }
    ctx.fillStyle = grad;
    ctx.fillText(w.word, 0, 0);
    ctx.restore();
    pushHitbox(hitboxOut, w, px, py, wWidth * scale, config.fontSize * 1.3 * scale);
  }, width);
}

export default {
  id: 'gradient-wave', name: 'Gradient Wave', blurb: 'Shifting color gradient across each word', draw, wordLevel: true,
  defaultConfig: { fontFamily: 'Space Grotesk, sans-serif', fontSize: 62, textColor: '#FFFFFF', accentColor: '#33E0C7', strokeColor: '#0B0E14', strokeWidth: 5, position: 'bottom', shadow: false, wordGap: 0.40, blockOffsetX: 0, blockOffsetY: 0 }
};
