import { yForPosition, xCenter, drawStrokedText } from './utils.js';

let scratch = null;
function getScratch(w, h) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  return scratch;
}

function drawEllipse(ctx, cx, cy, rw, rh, feather) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  if (feather > 0) {
    ctx.filter = `blur(${feather}px)`;
  }
  ctx.fill();
  ctx.filter = 'none';
}

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;

  const c1x = width * (config.cutout1X ?? 0.50);
  const c1y = height * (config.cutout1Y ?? 0.38);
  const c1rw = (width * (config.cutout1W ?? 0.22)) / 2;
  const c1rh = (height * (config.cutout1H ?? 0.26)) / 2;
  const c1f  = config.cutout1Feather ?? 22;

  const c2x = width * (config.cutout2X ?? 0.50);
  const c2y = height * (config.cutout2Y ?? 0.70);
  const c2rw = (width * (config.cutout2W ?? 0.36)) / 2;
  const c2rh = (height * (config.cutout2H ?? 0.44)) / 2;
  const c2f  = config.cutout2Feather ?? 32;

  if (hitboxOut) {
    hitboxOut.push({ index: 'cutout1', x: c1x - c1rw, y: c1y - c1rh, w: c1rw * 2, h: c1rh * 2 });
    hitboxOut.push({ index: 'cutout2', x: c2x - c2rw, y: c2y - c2rh, w: c2rw * 2, h: c2rh * 2 });
  }

  const y   = yForPosition(config, height);
  const cx0 = xCenter(width, config);
  const upper = activeWords.map(w => ({ ...w, word: w.word.toUpperCase() }));
  // Use a slightly larger font but stay within safe bounds
  const bigConfig = { ...config, fontSize: config.fontSize * 1.15, wordGap: config.wordGap ?? 0.40 };

  // Measure total line width to know if we need to scale
  const s = getScratch(width, height);
  const sctx = s.getContext('2d');
  sctx.clearRect(0, 0, width, height);

  // Import layoutRow inline — smartDepth doesn't normally use it but needs
  // its overflow protection here.
  const spacing = bigConfig.fontSize * (bigConfig.wordGap ?? 0.40);
  sctx.font = `800 ${bigConfig.fontSize}px ${bigConfig.fontFamily}`;
  const wordWidths = upper.map(w => sctx.measureText(w.word).width);
  const totalW = wordWidths.reduce((a, b) => a + b, 0) + spacing * (upper.length - 1);
  const safeW = width * 0.92;
  const fitScale = totalW > safeW ? safeW / totalW : 1;

  // Draw each word at its fitted position
  let x = cx0 - (totalW * fitScale) / 2;
  upper.forEach((w, i) => {
    const wordCx = x + wordWidths[i] * fitScale / 2;
    sctx.save();
    sctx.translate(wordCx, y);
    sctx.scale(fitScale, fitScale);
    drawStrokedText(sctx, w.word, 0, 0, bigConfig, { color: config.textColor });
    sctx.restore();
    x += (wordWidths[i] + spacing) * fitScale;
  });

  sctx.save();
  sctx.globalCompositeOperation = 'destination-out';
  drawEllipse(sctx, c1x, c1y, c1rw, c1rh, c1f);
  sctx.restore();

  sctx.save();
  sctx.globalCompositeOperation = 'destination-out';
  drawEllipse(sctx, c2x, c2y, c2rw, c2rh, c2f);
  sctx.restore();

  ctx.drawImage(s, 0, 0);
}

export default {
  id: 'smart-depth',
  name: 'Smart Depth',
  blurb: 'Two adjustable ellipses (head + body) tuck text cleanly behind the subject',
  draw,
  wordLevel: false,
  hasCutout: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 54,
    textColor: '#FFFFFF',
    accentColor: '#33E0C7',
    strokeColor: '#0B0E14',
    strokeWidth: 0,
    position: 'center',
    shadow: false,
    blockOffsetX: 0,
    blockOffsetY: 0,
    cutout1X: 0.50, cutout1Y: 0.38, cutout1W: 0.22, cutout1H: 0.26, cutout1Feather: 22,
    cutout2X: 0.50, cutout2Y: 0.70, cutout2W: 0.36, cutout2H: 0.44, cutout2Feather: 32
  }
};
