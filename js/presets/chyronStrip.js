// chyronStrip.js — Lower-third newsroom-style caption bar
// Slides in from left with a gradient fill, clean typography.
import { clamp01, easeOutBack, yForPosition, xCenter, baseFont, drawStrokedText, pushBlockHitbox } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut, time } = f;
  if (!activeWords.length) return;

  const lineText = activeWords.map(w => w.word).join(' ');
  // Find which word is currently spoken
  const activeWord = activeWords.find(w => w.active);

  // === Bar geometry ===
  const barH = config.fontSize * 2.2;
  const baseY = yForPosition(config, height);
  const barY = baseY - barH / 2;

  // Slide-in: first word's progress drives the whole bar entrance
  const firstWord = activeWords[0];
  const lineProgress = clamp01((time - firstWord.start) / 0.35);
  const slideIn = easeOutBack(lineProgress);
  const barW = width * 0.88;
  const barX = xCenter(width, config) - barW / 2;

  // Clip to slide-in progress
  ctx.save();
  ctx.beginPath();
  ctx.rect(barX, barY, barW * slideIn, barH);
  ctx.clip();

  // Main gradient bar
  const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
  grad.addColorStop(0, config.accentColor);
  grad.addColorStop(0.35, config.bgColor || '#0B0E14');
  grad.addColorStop(1, 'rgba(11,14,20,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(barX, barY, barW, barH);

  // Accent left stripe
  ctx.fillStyle = config.accentColor;
  ctx.fillRect(barX, barY, config.fontSize * 0.22, barH);

  ctx.restore();

  // === Text ===
  ctx.save();
  ctx.font = baseFont(config, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const textX = barX + config.fontSize * 0.55;
  const textY = baseY;

  // Render each word with active highlight
  let curX = textX;
  activeWords.forEach((w) => {
    const wordW = ctx.measureText(w.word).width;
    const gap = ctx.measureText(' ').width * (config.wordGap ?? 1.0);
    if (lineProgress > 0.3) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (lineProgress - 0.3) / 0.4);
      if (w.active) {
        ctx.fillStyle = config.highlightTextColor || '#FFD23F';
        ctx.shadowColor = config.highlightTextColor || '#FFD23F';
        ctx.shadowBlur = 12;
      } else {
        ctx.fillStyle = w.hasStarted ? config.textColor : 'rgba(255,255,255,0.45)';
      }
      ctx.fillText(w.word, curX, textY);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    curX += wordW + gap;
  });
  ctx.restore();

  pushBlockHitbox(hitboxOut, xCenter(width, config), baseY, barW, barH);
}

export default {
  id: 'chyron-strip',
  name: 'Chyron Strip',
  blurb: 'Newsroom lower-third bar slides in with active word highlight',
  draw,
  wordLevel: false,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 50,
    textColor: '#FFFFFF',
    accentColor: '#FF3D81',
    highlightTextColor: '#FFD23F',
    bgColor: '#0B0E14',
    strokeColor: '#0B0E14',
    strokeWidth: 0,
    position: 'bottom',
    shadow: false,
    wordGap: 0.60,
    blockOffsetX: 0,
    blockOffsetY: 0
  }
};
