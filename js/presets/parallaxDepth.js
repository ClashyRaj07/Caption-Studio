import { yForPosition, xCenter, drawFittedLine, pushBlockHitbox } from './utils.js';

function draw(ctx, f) {
  const { width, height, activeWords, config, hitboxOut } = f;
  if (!activeWords.length) return;

  const cx = xCenter(width, config);
  const cy = yForPosition(config, height);
  const time = f.time ?? 0;

  const line = activeWords.map(w => w.word).join(' ').toUpperCase();
  const sizeMult = 1.0;
  const size = config.fontSize * sizeMult;

  if (hitboxOut) {
    ctx.font = `800 ${size}px ${config.fontFamily}`;
    const tw = Math.min(ctx.measureText(line).width, width * 0.92);
    pushBlockHitbox(hitboxOut, cx, cy, tw, size * 1.4);
  }

  const layers = [
    { z: 0.30, alpha: 0.20, color: config.strokeColor || '#000000', sizeMult: 0.70, yOff: 18 },
    { z: 0.55, alpha: 0.45, color: config.strokeColor || '#000000', sizeMult: 0.85, yOff: 10 },
    { z: 0.80, alpha: 0.75, color: config.textColor,               sizeMult: 0.95, yOff: 4  },
    { z: 1.00, alpha: 1.00, color: config.textColor,               sizeMult: 1.00, yOff: 0  },
  ];

  for (const layer of layers) {
    const parallaxX = Math.sin(time * 0.8 + layer.z * 3) * (12 * layer.z);
    const parallaxY = Math.cos(time * 0.6 + layer.z * 2) * (6 * layer.z);
    ctx.save();
    ctx.globalAlpha = layer.alpha;
    drawFittedLine(ctx, line, cx + parallaxX, cy + parallaxY + layer.yOff,
      { ...config, strokeWidth: config.strokeWidth * layer.z },
      layer.sizeMult, width, { color: layer.color });
    ctx.restore();
  }
}

export default {
  id: 'parallax-depth',
  name: 'Parallax Depth',
  blurb: 'Text floats in 3D space with 4 parallax layers and gentle drift',
  draw,
  wordLevel: false,
  defaultConfig: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 56,
    textColor: '#FFFFFF',
    accentColor: '#33E0C7',
    strokeColor: '#0B0E14',
    strokeWidth: 6,
    position: 'center',
    shadow: true,
    wordGap: 0.40,
    blockOffsetX: 0,
    blockOffsetY: 0
  }
};
