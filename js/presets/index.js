import popKaraoke from './popKaraoke.js';
import highlightBox from './highlightBox.js';
import typewriter from './typewriter.js';
import bounce from './bounce.js';
import slideUpLines from './slideUpLines.js';
import neonGlow from './neonGlow.js';
import minimalClean from './minimalClean.js';
import markerSweep from './markerSweep.js';
import bigWordPop from './bigWordPop.js';
import gradientWave from './gradientWave.js';
import glitchShift from './glitchShift.js';
import depthReveal from './depthReveal.js';
import smartDepth from './smartDepth.js';
import parallaxDepth from './parallaxDepth.js';
import glassDepth from './glassDepth.js';
import cinematicFlyIn from './cinematicFlyIn.js';
import volumetricText from './volumetricText.js';
import depthShadow from './depthShadow.js';
import chyronStrip from './chyronStrip.js';
import filmBurn from './filmBurn.js';
import inkStamp from './inkStamp.js';

export const PRESETS = [
  highlightBox,
  popKaraoke,
  typewriter,
  bounce,
  slideUpLines,
  neonGlow,
  minimalClean,
  markerSweep,
  bigWordPop,
  gradientWave,
  glitchShift,
  depthReveal,
  smartDepth,
  parallaxDepth,
  glassDepth,
  cinematicFlyIn,
  volumetricText,
  depthShadow,
  chyronStrip,
  filmBurn,
  inkStamp
];

export function getPreset(id) {
  return PRESETS.find(p => p.id === id) || PRESETS[0];
}
