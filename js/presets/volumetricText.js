import { yForPosition, xCenter, drawFittedLine, pushBlockHitbox } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;

  const cx = xCenter(width, config);
  const cy = yForPosition(config, height);

  const line = activeWords.map(w => w.word).join(' ').toUpperCase();
  const sizeMult = 1.15;
  const size = config.fontSize * sizeMult;

  if (hitboxOut) {
    ctx.font = `bold ${size}px ${config.fontFamily}`;
    const tw = Math.min(ctx.measureText(line).width, width * 0.92);
    pushBlockHitbox(hitboxOut, cx, cy, tw, size * 1.3);
  }

  const extrusion = 14;
  const lightDir = { x: 0.5, y: -0.8 };
  const lightLen = Math.sqrt(lightDir.x**2 + lightDir.y**2);
  lightDir.x /= lightLen; lightDir.y /= lightLen;

  // Extruded shadow / side faces
  for (let i = extrusion; i >= 1; i--) {
    const depth = i / extrusion;
    const shade = Math.max(0.08, 0.35 * (1 - depth) * Math.max(0, -lightDir.y));
    ctx.save();
    ctx.globalAlpha = shade;
    drawFittedLine(ctx, line, cx + i * 0.7, cy + i * 0.9 + size * 0.35, { ...config, strokeWidth: 0 }, sizeMult, width, { color: config.strokeColor || '#000000' });
    ctx.restore();
  }

  // Top face (slightly lighter)
  ctx.save();
  ctx.globalAlpha = 0.12;
  drawFittedLine(ctx, line, cx + extrusion * 0.35, cy + extrusion * 0.45 + size * 0.35, { ...config, strokeWidth: 0 }, sizeMult, width, { color: config.accentColor || '#33E0C7' });
  ctx.restore();

  // Main face
  drawFittedLine(ctx, line, cx, cy + size * 0.35, config, sizeMult, width, { color: config.textColor });

  // Specular edge highlight
  ctx.save();
  ctx.globalAlpha = 0.25;
  drawFittedLine(ctx, line, cx, cy + size * 0.35, { ...config, strokeColor: config.accentColor || '#33E0C7', strokeWidth: 1.5 }, sizeMult, width, { color: 'transparent' });
  ctx.restore();
}

export default {
  id: 'volumetric-text',
  name: 'Volumetric',
  blurb: '3D extruded text with simulated lighting on side faces and specular edge',
  draw,
  wordLevel: false,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 56,
    textColor: '#FFFFFF',
    accentColor: '#33E0C7',
    strokeColor: '#0B0E14',
    strokeWidth: 5,
    position: 'center',
    shadow: true,
    wordGap: 0.40,
    blockOffsetX: 0,
    blockOffsetY: 0
  }
};
