import { yForPosition, xCenter, baseFont, roundRect, pushBlockHitbox } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;
  const y = yForPosition(config, height);
  const cx0 = xCenter(width, config);
  const line = activeWords.map(w => w.word).join(' ');
  ctx.save();
  ctx.font = baseFont(config, 600);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const padX = 16, padY = 8;
  const tw = ctx.measureText(line).width;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, cx0 - tw / 2 - padX, y - config.fontSize / 2 - padY, tw + padX * 2, config.fontSize + padY * 2, 8);
  ctx.fill();
  ctx.fillStyle = config.textColor;
  ctx.fillText(line, cx0, y);
  ctx.restore();
  pushBlockHitbox(hitboxOut, cx0, y, tw + padX * 2, config.fontSize + padY * 2);
}

export default {
  id: 'minimal', name: 'Minimal Clean', blurb: 'Simple, unobtrusive single-line captions', draw, wordLevel: false,
  defaultConfig: { fontFamily: 'Inter, sans-serif', fontSize: 34, textColor: '#FFFFFF', accentColor: '#33E0C7', strokeColor: '#000000', strokeWidth: 0, position: 'bottom', shadow: false, blockOffsetX: 0, blockOffsetY: 0 }
};
