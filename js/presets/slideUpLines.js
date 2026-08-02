import { clamp01, easeOutBack, yForPosition, xCenter, baseFont, drawStrokedText, pushBlockHitbox } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;
  const y = yForPosition(config, height);
  const cx0 = xCenter(width, config);
  const line = activeWords.map(w => w.word).join(' ');
  const t = clamp01((f.time - f.currentLineStart) / 0.35);
  const dy = (1 - easeOutBack(t)) * 30;
  const alpha = clamp01(t * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  drawStrokedText(ctx, line, cx0, y + dy, config, { color: config.textColor });
  ctx.restore();
  ctx.font = baseFont(config, 800);
  const tw = ctx.measureText(line).width;
  pushBlockHitbox(hitboxOut, cx0, y, tw, config.fontSize * 1.3);
}

export default {
  id: 'slide-fade', name: 'Slide Up Lines', blurb: 'Whole lines glide up between phrases', draw, wordLevel: false,
  defaultConfig: { fontFamily: 'Space Grotesk, sans-serif', fontSize: 46, textColor: '#FFFFFF', accentColor: '#33E0C7', strokeColor: '#0B0E14', strokeWidth: 6, position: 'bottom', shadow: true, blockOffsetX: 0, blockOffsetY: 0 }
};
