import { clamp01, easeOutBack, drawStrokedText, pushHitbox } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  const current = activeWords.find(w => w.active) || activeWords[activeWords.length - 1];
  if (!current) return;
  const t = clamp01(current.progress * 2.6);
  const scale = (0.6 + 0.5 * easeOutBack(Math.min(t, 1))) * current.overrideScale;
  const cx = width / 2 + (config.blockOffsetX || 0) + current.overrideX;
  const cy = height / 2 + (config.blockOffsetY || 0) + current.overrideY;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  drawStrokedText(ctx, current.word.toUpperCase(), 0, 0, { ...config, fontSize: config.fontSize * 1.7 }, { color: config.textColor });
  ctx.restore();
  pushHitbox(hitboxOut, current, cx, cy, config.fontSize * 3.4 * scale, config.fontSize * 2 * scale);
}

export default {
  id: 'big-word-pop', name: 'Big Word Pop', blurb: 'One dominant word at a time, TikTok-style', draw, wordLevel: true,
  defaultConfig: { fontFamily: 'Space Grotesk, sans-serif', fontSize: 52, textColor: '#FFFFFF', accentColor: '#FF3D81', strokeColor: '#0B0E14', strokeWidth: 10, position: 'center', shadow: false, wordGap: 0.40, blockOffsetX: 0, blockOffsetY: 0 }
};
