import { yForPosition, xCenter, drawFittedLine, pushBlockHitbox } from './utils.js';

// Reused scratch canvas — avoids allocating a new offscreen canvas every frame.
let scratch = null;
function getScratch(w, h) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  return scratch;
}

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;

  const cutoutX = config.cutoutX ?? 0.5;
  const cutoutY = config.cutoutY ?? 0.55;
  const cutoutW = config.cutoutWidth ?? 0.5;
  const cutoutH = config.cutoutHeight ?? 0.85;
  const feather = config.cutoutFeather ?? 30;

  const cx = width * cutoutX;
  const cy = height * cutoutY;
  const cw = width * cutoutW;
  const ch = height * cutoutH;

  if (hitboxOut) {
    hitboxOut.push({ index: 'cutout', x: cx, y: cy, w: cw, h: ch });
  }

  if (!activeWords.length) return;

  const y = yForPosition(config, height);
  const cx0 = xCenter(width, config);
  const line = activeWords.map(w => w.word).join(' ').toUpperCase();

  const s = getScratch(width, height);
  const sctx = s.getContext('2d');
  sctx.clearRect(0, 0, width, height);

  // Render text with overflow protection (1.15x size, fits to canvas width)
  drawFittedLine(sctx, line, cx0, y, config, 1.15, width, { color: config.textColor });

  sctx.save();
  sctx.globalCompositeOperation = 'destination-out';
  if (feather > 0) sctx.filter = `blur(${feather}px)`;
  sctx.fillStyle = '#FFFFFF';
  sctx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
  sctx.restore();

  ctx.drawImage(s, 0, 0);
}

export default {
  id: 'depth-reveal',
  name: 'Depth Reveal',
  blurb: 'Big bold text tucked behind the subject with a feathered cutout layer',
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
    wordGap: 0.40,
    blockOffsetX: 0,
    blockOffsetY: 0,
    cutoutX: 0.5,
    cutoutY: 0.55,
    cutoutWidth: 0.5,
    cutoutHeight: 0.85,
    cutoutFeather: 30
  }
};
