// exporter.js
// Renders the final captioned video entirely in-browser using WebCodecs
// (VideoEncoder/AudioEncoder) and muxes it into an .mp4 with mp4-muxer.
// No server, no upload, no cost — this is why export can be free.
//
// Requires a WebCodecs-capable browser (current Chrome / Edge on desktop).

import * as Mp4Muxer from 'https://esm.sh/mp4-muxer@5';

export function isExportSupported() {
  return typeof window.VideoEncoder === 'function' &&
         typeof window.AudioEncoder === 'function' &&
         typeof window.VideoFrame === 'function';
}

/**
 * @param {Object} opts
 * @param {HTMLVideoElement} opts.videoEl - source video (metadata loaded)
 * @param {File} opts.videoFile - original file (used to decode audio)
 * @param {Function} opts.drawFrame - (ctx, {width,height,time}) => void | Promise<void>, draws caption overlay for a given time
 * @param {number} [opts.fps]
 * @param {Function} [opts.onProgress] - (fraction 0..1, label) => void
 */
export async function exportCaptionedVideo({ videoEl, videoFile, drawFrame, fps = 30, onProgress }) {
  if (!isExportSupported()) {
    throw new Error('This browser doesn\u2019t support the WebCodecs export pipeline. Use a recent desktop Chrome or Edge.');
  }

  const width = videoEl.videoWidth;
  const height = videoEl.videoHeight;
  const duration = videoEl.duration;
  const totalFrames = Math.ceil(duration * fps);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 44100 },
    fastStart: 'in-memory'
  });

  // ---------- Video encoder ----------
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => console.error('VideoEncoder error', e)
  });
  videoEncoder.configure({
    codec: 'avc1.640028',
    width,
    height,
    bitrate: Math.min(16_000_000, Math.max(4_000_000, width * height * 6)),
    framerate: fps
  });

  // ---------- Audio: decode original track, re-encode as AAC ----------
  onProgress?.(0, 'Decoding audio\u2026');
  const audioBuffer = await videoFile.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new AudioCtx();
  let decodedAudio = null;
  try {
    decodedAudio = await decodeCtx.decodeAudioData(audioBuffer.slice(0));
  } catch (e) {
    console.warn('No usable audio track found, exporting silent video.', e);
  } finally {
    decodeCtx.close();
  }

  let audioEncoder = null;
  if (decodedAudio) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: e => console.error('AudioEncoder error', e)
    });
    audioEncoder.configure({
      codec: 'mp4a.40.2',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitrate: 160_000
    });
  }

  // ---------- Frame-by-frame render loop ----------
  onProgress?.(0, 'Rendering frames\u2026');
  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    await seekTo(videoEl, Math.min(t, duration - 1 / fps));

    ctx.drawImage(videoEl, 0, 0, width, height);
    await drawFrame(ctx, { width, height, time: t });

    const frame = new VideoFrame(canvas, { timestamp: Math.round(t * 1_000_000) });
    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();

    if (i % 5 === 0) onProgress?.(i / totalFrames, `Rendering frame ${i + 1} / ${totalFrames}`);
    // yield to the event loop so the UI stays responsive
    if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
  }
  await videoEncoder.flush();
  videoEncoder.close();

  // ---------- Encode audio ----------
  if (audioEncoder && decodedAudio) {
    onProgress?.(0.9, 'Encoding audio track\u2026');
    await encodeAudioBuffer(decodedAudio, audioEncoder);
    await audioEncoder.flush();
    audioEncoder.close();
  }

  onProgress?.(0.98, 'Packaging .mp4\u2026');
  muxer.finalize();
  const { buffer } = muxer.target;
  onProgress?.(1, 'Done');
  return new Blob([buffer], { type: 'video/mp4' });
}

function seekTo(videoEl, time) {
  return new Promise(resolve => {
    const onSeeked = () => {
      videoEl.removeEventListener('seeked', onSeeked);
      resolve();
    };
    videoEl.addEventListener('seeked', onSeeked);
    videoEl.currentTime = time;
  });
}

async function encodeAudioBuffer(audioBuffer, audioEncoder) {
  // Resample/mix to 44.1kHz stereo to match the encoder config.
  const targetRate = 44100;
  const channels = 2;
  const offline = new OfflineAudioContext(channels, Math.ceil(audioBuffer.duration * targetRate), targetRate);
  const src = offline.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();

  const chunkSize = 4096;
  const totalSamples = rendered.length;
  const ch0 = rendered.getChannelData(0);
  const ch1 = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : ch0;

  for (let offset = 0; offset < totalSamples; offset += chunkSize) {
    const len = Math.min(chunkSize, totalSamples - offset);
    const interleaved = new Float32Array(len * channels);
    for (let i = 0; i < len; i++) {
      interleaved[i * 2] = ch0[offset + i];
      interleaved[i * 2 + 1] = ch1[offset + i];
    }
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: targetRate,
      numberOfFrames: len,
      numberOfChannels: channels,
      timestamp: Math.round((offset / targetRate) * 1_000_000),
      data: interleaved
    });
    audioEncoder.encode(audioData);
    audioData.close();
  }
}
