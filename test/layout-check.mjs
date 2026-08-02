import { createCanvas, registerFont } from 'canvas';
import highlightBox from '../js/presets/highlightBox.js';
import popKaraoke from '../js/presets/popKaraoke.js';

// Worst case: a narrow 9:16 frame, a big font, and a long 5-word line —
// exactly the kind of case that used to overflow/overlap.
const WIDTH = 480, HEIGHT = 854;

function makeWords(strings, active) {
  return strings.map((word, i) => ({
    word, start: i, end: i + 1, globalIndex: i,
    active: i === active, hasStarted: true, progress: i === active ? 0.9 : 1,
    overrideX: 0, overrideY: 0, overrideScale: 1
  }));
}

function measureRow(preset, words, config) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const hitboxOut = [];
  preset.draw(ctx, { width: WIDTH, height: HEIGHT, time: 0.9, activeWords: words, currentLineStart: 0, config, hitboxOut });
  return hitboxOut;
}

function checkNoOverlap(name, hitboxes) {
  let ok = true;
  for (let i = 0; i < hitboxes.length; i++) {
    for (let j = i + 1; j < hitboxes.length; j++) {
      const a = hitboxes[i], b = hitboxes[j];
      const dx = Math.abs(a.x - b.x);
      const overlapAllowed = (a.w + b.w) / 2 * 0.7; // allow tight-but-not-overlapping spacing
      if (dx < overlapAllowed) {
        ok = false;
        console.log(`  OVERLAP in ${name}: word ${i} (x=${a.x.toFixed(1)}, w=${a.w.toFixed(1)}) vs word ${j} (x=${b.x.toFixed(1)}, w=${b.w.toFixed(1)}) dx=${dx.toFixed(1)}`);
      }
    }
    const x = hitboxes[i].x, w = hitboxes[i].w;
    if (x - w / 2 < -10 || x + w / 2 > WIDTH + 10) {
      console.log(`  OFF-FRAME in ${name}: word ${i} spans [${(x - w/2).toFixed(1)}, ${(x + w/2).toFixed(1)}] outside [0, ${WIDTH}]`);
      ok = false;
    }
  }
  console.log(`${name}: ${ok ? 'PASS (no overlap, within frame)' : 'FAIL'}`);
  return ok;
}

const words = ['HABITS', "I'M", 'CONSTANTLY', 'AWARE', 'OF'];
let allOk = true;

{
  const config = { ...highlightBox.defaultConfig, fontSize: 52 };
  const active = makeWords(words, 0); // first word mid-"pop" (worst case for growth)
  const hb = measureRow(highlightBox, active, config);
  allOk = checkNoOverlap('highlightBox (5 words, fontSize 52, 480px frame)', hb) && allOk;
}

{
  const config = { ...popKaraoke.defaultConfig, fontSize: 54 };
  const active = makeWords(words, 2); // middle word mid-pop
  const hb = measureRow(popKaraoke, active, config);
  allOk = checkNoOverlap('popKaraoke (5 words, fontSize 54, 480px frame)', hb) && allOk;
}

process.exit(allOk ? 0 : 1);
