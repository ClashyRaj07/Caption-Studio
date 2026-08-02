import { yForPosition, xCenter, drawFittedLine, pushBlockHitbox } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;

  const cx = xCenter(width, config);
  const cy = yForPosition(config, height);
  const time = f.time ?? 0;

  const line = activeWords.map(w => w.word).join(' ').toUpperCase();
  const sizeMult = 1.15;
  const size = config.fontSize * sizeMult;

  if (hitboxOut) {
    ctx.font = `bold ${size}px ${config.fontFamily}`;
    const tw = Math.min(ctx.measureText(line).width, width * 0.92);
    pushBlockHitbox(hitboxOut, cx, cy, tw, size * 1.4);
  }

  const shadowLen = 55;
  const shadowAngle = Math.PI / 4 + Math.sin(time * 0.4) * 0.15;

  // Long shadow segments
  const steps = 40;
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    const sx = cx + Math.cos(shadowAngle) * shadowLen * t;
    const sy = cy + Math.sin(shadowAngle) * shadowLen * t + size * 0.35;
    const alpha = 0.18 * (1 - t * 0.6);

    ctx.save();
    ctx.globalAlpha = alpha;
    drawFittedLine(ctx, line, sx, sy, { ...config, strokeWidth: 0 }, sizeMult, width, { color: config.strokeColor || '#000000' });
    ctx.restore();
  }

  // Main text
  drawFittedLine(ctx, line, cx, cy + size * 0.35, config, sizeMult, width, { color: config.textColor });

  // Soft outer glow behind text
  ctx.save();
  ctx.shadowColor = config.accentColor || '#33E0C7';
  ctx.shadowBlur = 25;
  ctx.globalAlpha = 0.3;
  drawFittedLine(ctx, line, cx, cy + size * 0.35, config, sizeMult, width, { color: config.accentColor || '#33E0C7' });
  ctx.restore();
}

export default {
  id: 'depth-shadow',
  name: 'Depth Shadow',
  blurb: 'Long cinematic cast shadow stretching across the frame with subtle angle drift',
  draw,
  wordLevel: false,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 56,
    textColor: '#FFFFFF',
    accentColor: '#33E0C7',
    strokeColor: '#0B0E14',
    strokeWidth: 5,
    position: 'center',
    shadow: true,
    wordGap: 0.40,
    blockOffsetX: 0,
    blockOffsetY: 0
  }
};
