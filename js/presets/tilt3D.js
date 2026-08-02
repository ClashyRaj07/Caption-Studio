import { yForPosition, xCenter, drawStrokedText } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;

  const cx   = xCenter(width, config);
  const cy   = yForPosition(config, height);
  const time = f.time ?? 0;
  const floatY = Math.sin(time * 1.6) * 6;

  ctx.font = `bold ${config.fontSize}px ${config.fontFamily}`;

  const gap = config.fontSize * 0.25;
  const wordData = activeWords.map((w) => {
    const txt = w.word.toUpperCase();
    const m = ctx.measureText(txt);
    return { txt, w: m.width, h: config.fontSize, word: w };
  });

  const totalW = wordData.reduce((s, d) => s + d.w, 0) + gap * (wordData.length - 1);
  let cursorX = cx - totalW / 2;

  if (hitboxOut) {
    const blockH = config.fontSize * 1.4;
    hitboxOut.push({ index: 'block', x: cx - totalW/2, y: cy - blockH/2 + floatY, w: totalW, h: blockH });
  }

  // Shadow layers (back-to-front)
  const shadowLayers = 10, shadowDepth = 28, shadowColor = config.strokeColor || '#000000';
  for (let layer = shadowLayers; layer >= 1; layer--) {
    const depth = (layer / shadowLayers) * shadowDepth;
    const alpha = 0.06 * (1 - layer / shadowLayers);
    let sx = cursorX;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = shadowColor;
    for (const d of wordData) {
      const dist = (sx + d.w/2 - cx) / (totalW/2 + 0.001);
      const rotY = dist * 0.35, scale = Math.cos(rotY), skew = Math.sin(rotY) * 12;
      ctx.save();
      ctx.translate(sx + d.w/2, cy + floatY + depth);
      ctx.scale(scale, 1);
      ctx.transform(1, 0, skew/d.w, 1, 0, 0);
      ctx.fillText(d.txt, -d.w/2, d.h * 0.35);
      ctx.restore();
      sx += d.w + gap;
    }
    ctx.restore();
  }

  // Main words
  let mx = cursorX;
  for (const d of wordData) {
    const dist = (mx + d.w/2 - cx) / (totalW/2 + 0.001);
    const rotY = dist * 0.35, scale = Math.cos(rotY), skew = Math.sin(rotY) * 12;
    ctx.save();
    ctx.translate(mx + d.w/2, cy + floatY);
    ctx.scale(scale, 1);
    ctx.transform(1, 0, skew/d.w, 1, 0, 0);
    drawStrokedText(ctx, d.txt, -d.w/2, d.h * 0.35, config, { color: config.textColor });
    ctx.restore();
    mx += d.w + gap;
  }
}

export default {
  id: 'tilt-3d',
  name: '3D Tilt',
  blurb: 'Words sit on a curved 3D ribbon with layered shadows and perspective skew',
  draw,
  wordLevel: false,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 58,
    textColor: '#FFFFFF',
    accentColor: '#33E0C7',
    strokeColor: '#0B0E14',
    strokeWidth: 5,
    position: 'center',
    shadow: true,
    blockOffsetX: 0,
    blockOffsetY: 0
  }
};
