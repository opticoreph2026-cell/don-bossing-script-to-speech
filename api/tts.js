const { EdgeTTS } = require('@andresaya/edge-tts');

const DEFAULT_VOICE = 'fil-PH-AngeloNeural';
const VOICES = [
  'fil-PH-AngeloNeural',
  'fil-PH-BlessicaNeural'
];

const clamp = (min, max, v) => Math.max(min, Math.min(max, v));

function num(v, d, min, max) {
  const x = parseFloat(v);
  if (isNaN(x)) return d;
  return clamp(min, max, x);
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ ok: true, service: 'edge-tts', defaultVoice: DEFAULT_VOICE, voices: VOICES });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  const text = String(body.text || '').trim().slice(0, 400);
  if (!text) {
    return res.status(400).json({ error: 'text is required.' });
  }

  const voice = String(body.voice || DEFAULT_VOICE);
  if (!VOICES.includes(voice)) {
    return res.status(400).json({ error: 'Unsupported voice: ' + voice });
  }

  const pitch = num(body.pitch, 0, -100, 100);
  const rate = num(body.rate, 0, -100, 200);
  const volume = num(body.volume, 0, -100, 100);

  let tts;
  try {
    tts = new EdgeTTS();
    await tts.synthesize(text, voice, {
      pitch,
      rate,
      volume,
      outputFormat: 'audio-24khz-96kbitrate-mono-mp3'
    });
  } catch (e) {
    return res.status(500).json({ error: 'Synthesis failed: ' + (e && e.message ? e.message : String(e)) });
  }

  let audio;
  try {
    audio = tts.toBuffer();
  } catch (e) {
    return res.status(500).json({ error: 'No audio generated.' });
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', audio.length);
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.status(200);
  return res.end(audio);
};
