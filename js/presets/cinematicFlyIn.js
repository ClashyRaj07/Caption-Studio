import { clamp01, yForPosition, xCenter, drawStrokedText, layoutRow } from './utils.js';

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;

  const cx = xCenter(width, config);
  const cy = yForPosition(config, height);
  const now = f.time ?? 0;

  if (hitboxOut) {
    ctx.font = `bold ${config.fontSize}px ${config.fontFamily}`;
    const line = activeWords.map(w => w.word).join(' ').toUpperCase();
    const m = ctx.measureText(line);
    const totalW = m.width + (config.fontSize * (config.wordGap ?? 0.22)) * (activeWords.length - 1);
    hitboxOut.push({ index: 'block', x: cx, y: cy, w: totalW, h: config.fontSize * 1.4 });
  }

  const upperWords = activeWords.map(w => ({ ...w, word: w.word.toUpperCase() }));
  layoutRow(ctx, upperWords, config, cx, cy, (w, wordCx, wordCy, wordW, fitScale) => {
    const txt = w.word.toUpperCase();
    const wStart = w.start, wEnd = w.end;
    const duration = wEnd - wStart;
    const localT = Math.max(0, Math.min(1, (now - wStart) / Math.max(duration, 0.15)));

    const flyProgress = easeOutBack(Math.min(1, localT * 2.5));
    const fadeProgress = easeOutExpo(Math.min(1, localT * 1.5));

    const startScale = 3.5, endScale = 1.0;
    const scale = startScale - (startScale - endScale) * flyProgress;
    
    const activeScale = w.active ? 1 + 0.15 * Math.sin(Math.min(1, clamp01(w.progress * 4)) * Math.PI) : 1;
    const finalScale = scale * fitScale * activeScale;

    const startAlpha = 0, endAlpha = 1;
    const alpha = startAlpha + (endAlpha - startAlpha) * fadeProgress;
    const zOffset = (1 - flyProgress) * 80;

    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(wordCx, wordCy + zOffset);
    ctx.scale(finalScale, finalScale);
    
    const drawColor = w.active ? (config.highlightTextColor || config.accentColor) : config.textColor;
    drawStrokedText(ctx, txt, 0, config.fontSize * 0.35, config, { color: drawColor, size: config.fontSize });
    ctx.restore();
  }, width);
}

export default {
  id: 'cinematic-flyin',
  name: 'Cinematic Fly-In',
  blurb: 'Words explode from deep z-space toward camera with overshoot easing',
  draw,
  wordLevel: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 64,
    textColor: '#FFFFFF',
    accentColor: '#33E0C7',
    strokeColor: '#0B0E14',
    strokeWidth: 6,
    position: 'center',
    shadow: true,
    blockOffsetX: 0,
    blockOffsetY: 0,
    wordGap: 0.22
  }
};
