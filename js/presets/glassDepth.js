import { yForPosition, xCenter, drawFittedLine, pushBlockHitbox } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;

  const cx = xCenter(width, config);
  const cy = yForPosition(config, height);
  const time = f.time ?? 0;

  const line = activeWords.map(w => w.word).join(' ').toUpperCase();
  const sizeMult = 1.0;
  const size = config.fontSize * sizeMult;

  // Measure fitted width for the glass panel
  ctx.font = `800 ${size}px ${config.fontFamily}`;
  const measured = ctx.measureText(line).width;
  const safeW = width * 0.92;
  const fittedW = Math.min(measured, safeW);
  const th = size * 1.4;
  const pad = 28;

  if (hitboxOut) {
    pushBlockHitbox(hitboxOut, cx, cy, fittedW + pad * 2, th);
  }

  const floatX = Math.sin(time * 1.2) * 4;
  const floatY = Math.cos(time * 0.9) * 3;
  const bx = cx - fittedW / 2 - pad + floatX;
  const by = cy - th / 2 + floatY;

  // Frosted blur background
  ctx.save();
  ctx.filter = 'blur(20px) brightness(1.2)';
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(bx, by, fittedW + pad * 2, th, 20);
  ctx.fill();
  ctx.restore();

  // Inner glow edge
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx + 1, by + 1, fittedW + pad * 2 - 2, th - 2, 18);
  ctx.stroke();
  ctx.restore();

  // Text — fitted to canvas width
  drawFittedLine(ctx, line, cx + floatX, cy + floatY + size * 0.35, config, sizeMult, width, {
    color: config.textColor
  });

  // Specular highlight (top edge glint)
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(bx + 8, by + 2, fittedW + pad * 2 - 16, 3, 2);
  ctx.fill();
  ctx.restore();
}

export default {
  id: 'glass-depth',
  name: 'Glass Depth',
  blurb: 'Frosted glass panel with specular highlight and soft float',
  draw,
  wordLevel: false,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 56,
    textColor: '#FFFFFF',
    accentColor: '#33E0C7',
    strokeColor: '#0B0E14',
    strokeWidth: 4,
    position: 'center',
    shadow: true,
    wordGap: 0.40,
    blockOffsetX: 0,
    blockOffsetY: 0
  }
};
