import { clamp01, yForPosition, xCenter, baseFont, roundRect, drawStrokedText, pushBlockHitbox } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, time, hitboxOut } = f;
  if (!activeWords.length) return;
  const y = yForPosition(config, height);
  const cx0 = xCenter(width, config);
  const line = activeWords.map(w => w.word).join(' ');
  const lastWord = activeWords[activeWords.length - 1];
  let visibleChars = 0, charCount = 0;
  for (const w of activeWords) {
    if (time >= w.start) {
      const wp = clamp01((time - w.start) / Math.max(0.001, w.end - w.start));
      visibleChars = charCount + Math.round(w.word.length * (w.end <= time ? 1 : wp));
    }
    charCount += w.word.length + 1;
  }
  const shown = line.slice(0, visibleChars);
  ctx.font = baseFont(config, 700);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const boxPad = 18;
  const textW = ctx.measureText(shown + '_').width;
  ctx.fillStyle = 'rgba(10,12,18,0.72)';
  const boxH = config.fontSize * 1.6;
  roundRect(ctx, cx0 - textW / 2 - boxPad, y - boxH / 2, textW + boxPad * 2, boxH, 10);
  ctx.fill();
  drawStrokedText(ctx, shown, cx0, y, { ...config, strokeWidth: 0 }, { color: config.textColor });
  if (Math.floor(time * 2.5) % 2 === 0 && lastWord.end > time) {
    ctx.fillStyle = config.accentColor;
    ctx.fillRect(cx0 + textW / 2 - 6, y - config.fontSize * 0.4, 4, config.fontSize * 0.8);
  }
  pushBlockHitbox(hitboxOut, cx0, y, textW + boxPad * 2, boxH);
}

export default {
  id: 'typewriter', name: 'Typewriter Mono', blurb: 'Types itself out, blinking cursor', draw, wordLevel: false,
  defaultConfig: { fontFamily: 'JetBrains Mono, monospace', fontSize: 38, textColor: '#EDEFF4', accentColor: '#33E0C7', strokeColor: '#000000', strokeWidth: 0, position: 'bottom', shadow: false, blockOffsetX: 0, blockOffsetY: 0 }
};
