// groq.js
// Audio processing and speech transcription handlers.

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const TARGET_SAMPLE_RATE = 16000;

/**
 * Pulls the audio track out of a video File, downmixes to mono 16kHz,
 * and returns a WAV Blob.
 */
export async function extractAudioAsWav(videoFile, onProgress) {
  onProgress?.('Reading video file\u2026');
  const arrayBuffer = await videoFile.arrayBuffer();

  onProgress?.('Decoding audio track\u2026');
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new AudioCtx();
  let decoded;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    decodeCtx.close();
  }

  onProgress?.('Preparing audio for transcription\u2026');
  const duration = decoded.duration;
  const offline = new OfflineAudioContext(1, Math.ceil(duration * TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();

  const wavBlob = encodeWav(rendered);
  return { wavBlob, duration };
}

function encodeWav(audioBuffer) {
  const samples = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

/**
 * Sends extracted audio to speech-to-text endpoint and returns word timestamps.
 */
export async function transcribeWithGroq(wavBlob, apiKey, { model = 'whisper-large-v3', onProgress } = {}) {
  if (!apiKey) throw new Error('Missing API key.');

  const form = new FormData();
  form.append('file', wavBlob, 'audio.wav');
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');

  onProgress?.('Uploading audio\u2026');
  let res;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });
  } catch (err) {
    throw new Error('Could not reach transcription service. Check your connection or ad-blocker.');
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { }
    if (res.status === 401) throw new Error('API key rejected. Double-check it in Settings.');
    if (res.status === 413) throw new Error('That clip is too large. Try a shorter video.');
    if (res.status === 429) throw new Error('Rate limit hit. Wait a moment and try again.');
    throw new Error(`Transcription failed (${res.status}). ${detail}`);
  }

  onProgress?.('Processing transcript\u2026');
  const data = await res.json();

  let words = (data.words || []).map(w => ({
    word: (w.word || '').trim(),
    start: w.start,
    end: w.end
  })).filter(w => w.word.length > 0);

  if (!words.length && Array.isArray(data.segments)) {
    for (const seg of data.segments) {
      const segWords = seg.text.trim().split(/\s+/).filter(Boolean);
      if (!segWords.length) continue;
      const span = (seg.end - seg.start) / segWords.length;
      segWords.forEach((w, i) => {
        words.push({ word: w, start: seg.start + i * span, end: seg.start + (i + 1) * span });
      });
    }
  }

  const fullText = words.map(w => w.word).join(' ');
  return { words, fullText };
}

/**
 * Transliterates Devanagari Hindi words into natural Roman Hinglish script with spelling corrections.
 */
export async function convertWordsToHinglishWithGroqLLaMA(words, apiKey, onProgress) {
  if (!words.length || !apiKey) return words;
  onProgress?.('Refining Hinglish captions\u2026');

  const BATCH_SIZE = 20;
  const resultWords = words.map(w => ({ ...w }));

  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const chunk = words.slice(i, i + BATCH_SIZE);
    const hindiWords = chunk.map(w => w.word);

    const prompt = `You are a professional Hindi-to-Hinglish transliterator and spelling corrector for video captions.
Convert the given JSON array of Hindi words into natural, professional, typo-free Hinglish using Roman/Latin alphabet.

STRICT RULES:
1. You MUST return a JSON array of EXACTLY ${hindiWords.length} items. Each item at index i must correspond 1:1 to the input word at index i.
2. Convert Hindi Devanagari words into standard, clean Roman Hinglish (e.g. "तो" -> "To", "आपको" -> "aapko", "पता" -> "pata", "होगा" -> "hoga", "ढूंढ" -> "dhoondh", "महलों" -> "mahalon").
3. Fix basic spelling mistakes & phonetic typos, converting phonetically spelled English terms to correct English spellings (e.g. "chainej"/"चाइनीज" -> "chinese", "rashiyan"/"रशियन" -> "russian", "gais"/"गैस" -> "guys", "hakar"/"हैकर्स" -> "hackers", "aplication"/"एप्लीकेशन" -> "application", "mod"/"मॉड" -> "mod").
4. Keep all standard English, technical, and brand names (e.g. "application", "OTT", "Netflix", "Amazon", "Prime", "Apple", "TV", "streaming", "website", "domain", "lol") in correct English spelling.
5. Return ONLY a JSON object with key "hinglishWords" containing an array of strings of EXACTLY ${hindiWords.length} items.

Input JSON: ${JSON.stringify(hindiWords)}`;

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You convert Hindi Devanagari word arrays into clean Roman Hinglish script and correct any spelling mistakes. Always return a JSON array matching exact input length.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawContent = data.choices?.[0]?.message?.content || '';
        let arr = null;
        try {
          const parsed = JSON.parse(rawContent);
          arr = parsed.hinglishWords || parsed.words || parsed.result || (Array.isArray(parsed) ? parsed : null);
        } catch { }

        if (Array.isArray(arr) && arr.length > 0) {
          const limit = Math.min(chunk.length, arr.length);
          for (let j = 0; j < limit; j++) {
            const val = arr[j];
            if (val && typeof val === 'string' && val.trim()) {
              resultWords[i + j].word = val.trim();
            }
          }
        }
      }
    } catch (err) {
      console.warn('Hinglish refinement failed for batch:', err);
    }
  }

  return resultWords;
}

/**
 * Transcribes audio for Hinglish mode and applies caption refinement.
 */
export async function transcribeWithAssemblyAI(wavBlob, apiKey, { onProgress, groqApiKey = '' } = {}) {
  if (!apiKey) throw new Error('Missing Hinglish API key. Please add it in Settings.');

  onProgress?.('Uploading media file\u2026');
  let uploadRes;
  try {
    uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: { 'Authorization': apiKey },
      body: wavBlob
    });
  } catch (err) {
    throw new Error('Could not reach transcription service. Check connection or CORS settings.');
  }

  if (!uploadRes.ok) {
    let detail = '';
    try { detail = (await uploadRes.json())?.error || ''; } catch { }
    if (uploadRes.status === 401) throw new Error('API key rejected. Double-check it in Settings.');
    throw new Error(`Media upload failed (${uploadRes.status}). ${detail}`);
  }

  const { upload_url } = await uploadRes.json();
  if (!upload_url) throw new Error('Media upload failed: No URL returned.');

  onProgress?.('Analyzing speech\u2026');
  let transcriptRes;
  try {
    transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speech_models: ['universal-3-5-pro'],
        language_code: 'hi',
        disfluencies: true,
        punctuate: true,
        format_text: true
      })
    });
  } catch (err) {
    throw new Error('Failed to submit transcription request.');
  }

  if (!transcriptRes.ok) {
    let detail = '';
    try { detail = (await transcriptRes.json())?.error || ''; } catch { }
    throw new Error(`Transcription failed (${transcriptRes.status}). ${detail}`);
  }

  const { id } = await transcriptRes.json();

  onProgress?.('Generating transcript\u2026');
  let status = 'queued';
  let data = null;

  while (status === 'queued' || status === 'processing') {
    await new Promise(resolve => setTimeout(resolve, 1500));
    let pollRes;
    try {
      pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { 'Authorization': apiKey }
      });
    } catch (err) {
      throw new Error('Connection lost while waiting for transcription.');
    }
    if (!pollRes.ok) throw new Error(`Status poll failed (${pollRes.status})`);
    data = await pollRes.json();
    status = data.status;
    if (status === 'error') {
      throw new Error(`Transcription error: ${data.error || 'Unknown error'}`);
    }
  }

  let words = (data.words || []).map(w => ({
    word: (w.text || '').trim(),
    start: w.start / 1000,
    end: w.end / 1000
  })).filter(w => w.word.length > 0);

  if (groqApiKey) {
    words = await convertWordsToHinglishWithGroqLLaMA(words, groqApiKey, onProgress);
  }

  const fullText = words.map(w => w.word).join(' ');
  return { words, fullText };
}
