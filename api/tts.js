const { EdgeTTS } = require('@andresaya/edge-tts');

const DEFAULT_VOICE = 'fil-PH-AngeloNeural';

const EDGE_VOICES = [
  { shortName: 'fil-PH-AngeloNeural', label: 'Angelo — Filipino Male (Tagalog)', locale: 'fil-PH', gender: 'Male', engine: 'edge' },
  { shortName: 'fil-PH-BlessicaNeural', label: 'Blessica — Filipino Female (Tagalog)', locale: 'fil-PH', gender: 'Female', engine: 'edge' }
];

const GOOGLE_VOICES = [
  { shortName: 'fil-PH-Standard-A', label: 'Google Tagalog Female 1 (Standard)', locale: 'fil-PH', gender: 'Female', engine: 'google', tier: 'Standard' },
  { shortName: 'fil-PH-Standard-B', label: 'Google Tagalog Female 2 (Standard)', locale: 'fil-PH', gender: 'Female', engine: 'google', tier: 'Standard' },
  { shortName: 'fil-PH-Standard-C', label: 'Google Tagalog Male 1 (Standard)', locale: 'fil-PH', gender: 'Male', engine: 'google', tier: 'Standard' },
  { shortName: 'fil-PH-Standard-D', label: 'Google Tagalog Male 2 (Standard)', locale: 'fil-PH', gender: 'Male', engine: 'google', tier: 'Standard' },
  { shortName: 'fil-PH-Wavenet-A', label: 'Google Tagalog Female 1 (WaveNet)', locale: 'fil-PH', gender: 'Female', engine: 'google', tier: 'WaveNet' },
  { shortName: 'fil-PH-Wavenet-B', label: 'Google Tagalog Female 2 (WaveNet)', locale: 'fil-PH', gender: 'Female', engine: 'google', tier: 'WaveNet' },
  { shortName: 'fil-PH-Wavenet-C', label: 'Google Tagalog Male 1 (WaveNet)', locale: 'fil-PH', gender: 'Male', engine: 'google', tier: 'WaveNet' },
  { shortName: 'fil-PH-Wavenet-D', label: 'Google Tagalog Male 2 (WaveNet)', locale: 'fil-PH', gender: 'Male', engine: 'google', tier: 'WaveNet' },
  { shortName: 'fil-PH-Neural2-A', label: 'Google Tagalog Female (Neural2)', locale: 'fil-PH', gender: 'Female', engine: 'google', tier: 'Neural2' },
  { shortName: 'fil-PH-Neural2-D', label: 'Google Tagalog Male (Neural2)', locale: 'fil-PH', gender: 'Male', engine: 'google', tier: 'Neural2' }
];

const clamp = (min, max, v) => Math.max(min, Math.min(max, v));

function num(v, d, min, max) {
  const x = parseFloat(v);
  if (isNaN(x)) return d;
  return clamp(min, max, x);
}

async function googleSynthesize(text, voice, pitch, rate, volume, key) {
  const speakingRate = clamp(0.25, 4, 1 + rate / 100);
  const pitchSemis = clamp(-20, 20, pitch / 4);
  const volumeGainDb = clamp(-96, 16, (volume - 100) * 0.3);
  const resp = await fetch(
    'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(key),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'fil-PH', name: voice },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate,
          pitch: String(pitchSemis),
          volumeGainDb
        }
      })
    }
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Google TTS ' + resp.status + ': ' + errText.slice(0, 300));
  }
  const json = await resp.json();
  if (!json.audioContent) throw new Error('Google TTS: empty audio.');
  return Buffer.from(json.audioContent, 'base64');
}

module.exports = async function handler(req, res) {
  const googleKey = process.env.GOOGLE_TTS_API_KEY || '';
  const VOICES = EDGE_VOICES.concat(googleKey ? GOOGLE_VOICES : []);

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      ok: true,
      service: 'edge-tts+google',
      google: !!googleKey,
      defaultVoice: DEFAULT_VOICE,
      voices: VOICES
    });
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
  const meta = VOICES.find(v => v.shortName === voice);
  if (!meta) {
    return res.status(400).json({ error: 'Unsupported voice: ' + voice });
  }

  const pitch = num(body.pitch, 0, -100, 100);
  const rate = num(body.rate, 0, -100, 200);
  const volume = num(body.volume, 0, -100, 100);

  let audio;
  if (meta.engine === 'google') {
    try {
      audio = await googleSynthesize(text, voice, pitch, rate, volume, googleKey);
    } catch (e) {
      return res.status(500).json({ error: 'Google synthesis failed: ' + (e && e.message ? e.message : String(e)) });
    }
  } else {
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
    try {
      audio = tts.toBuffer();
    } catch (e) {
      return res.status(500).json({ error: 'No audio generated.' });
    }
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', audio.length);
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.status(200);
  return res.end(audio);
};