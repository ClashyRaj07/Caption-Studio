import { yForPosition, xCenter, drawStrokedText } from './utils.js';

let scratch = null;
function getScratch(w, h) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  return scratch;
}

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;

  const cx = width * (config.portalX ?? 0.50);
  const cy = height * (config.portalY ?? 0.52);
  const radius = Math.min(width, height) * (config.portalRadius ?? 0.28);
  const feather = config.portalFeather ?? 35;
  const time = f.time ?? 0;

  if (hitboxOut) {
    hitboxOut.push({ index: 'portal', x: cx - radius, y: cy - radius, w: radius*2, h: radius*2 });
  }

  const line = activeWords.map(w => w.word).join(' ').toUpperCase();
  const size = config.fontSize * 1.1;
  const textY = yForPosition(config, height);
  const textX = xCenter(width, config);

  const s = getScratch(width, height);
  const sctx = s.getContext('2d');
  sctx.clearRect(0, 0, width, height);

  // Draw text on scratch
  drawStrokedText(sctx, line, textX, textY, { ...config, fontSize: size }, { color: config.textColor });

  // Erase circular portal (text inside circle is hidden → video shows through)
  sctx.save();
  sctx.globalCompositeOperation = 'destination-out';
  sctx.beginPath();
  sctx.arc(cx, cy, radius, 0, Math.PI * 2);
  sctx.fillStyle = '#FFFFFF';
  if (feather > 0) sctx.filter = `blur(${feather}px)`;
  sctx.fill();
  sctx.filter = 'none';
  sctx.restore();

  // Orbiting ring accent
  const orbitAngle = time * 0.7;
  const ringR = radius + 12;
  ctx.save();
  ctx.strokeStyle = config.accentColor || '#33E0C7';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, orbitAngle, orbitAngle + Math.PI * 1.3);
  ctx.stroke();

  // Orbiting dot
  const dotX = cx + Math.cos(orbitAngle + Math.PI * 1.3) * ringR;
  const dotY = cy + Math.sin(orbitAngle + Math.PI * 1.3) * ringR;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
  ctx.fillStyle = config.accentColor || '#33E0C7';
  ctx.fill();
  ctx.restore();

  // Composite text
  ctx.drawImage(s, 0, 0);
}

export default {
  id: 'portal-depth',
  name: 'Portal Depth',
  blurb: 'Circular portal mask hides text behind the subject; orbiting accent ring',
  draw,
  wordLevel: false,
  hasCutout: true,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 60,
    textColor: '#FFFFFF',
    accentColor: '#33E0C7',
    strokeColor: '#0B0E14',
    strokeWidth: 4,
    position: 'center',
    shadow: true,
    blockOffsetX: 0,
    blockOffsetY: 0,
    portalX: 0.50,
    portalY: 0.52,
    portalRadius: 0.28,
    portalFeather: 35
  }
};
