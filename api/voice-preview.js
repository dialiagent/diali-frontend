/**
 * Vercel Serverless Function — /api/voice-preview
 *
 * Proxies ElevenLabs text-to-speech so the API key stays server-side.
 * Returns an MP3 audio buffer. Cached for 7 days per voice.
 *
 * Env var required: ELEVENLABS_API_KEY
 *
 * Usage: GET /api/voice-preview?voiceId=O7LV5fxosQChiBE7l6Wz
 */

const ALLOWED_VOICES = new Set([
  'O7LV5fxosQChiBE7l6Wz', // Kim
  'tMvyQtpCVQ0DkixuYm6J', // Asher
  'Sr9Xhw1be5kyNtGEOV0y', // Brady
  'TWutjvRaJqAX89preB4e', // Evan
  'LoQnubeEKhw9RDkfeS80', // Larry
  'hGQkZQUA5RiOXIw7P9iO', // Kiora
]);

const PREVIEW_TEXT =
  "Hi, thanks for calling! I can help you schedule a service appointment or answer any questions you might have. What's going on today?";

module.exports = async (req, res) => {
  /* Only GET */
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { voiceId } = req.query;

  if (!voiceId || !ALLOWED_VOICES.has(voiceId)) {
    return res.status(400).json({ error: 'Invalid or missing voiceId' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res
      .status(503)
      .json({ error: 'Voice preview not configured — add ELEVENLABS_API_KEY in Vercel env vars' });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: PREVIEW_TEXT,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('ElevenLabs error:', response.status, errText);
      return res.status(502).json({ error: 'Voice service error' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    /* Cache aggressively — same voice + same text = same audio */
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=604800, max-age=604800'); // 7 days
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error('Voice preview error:', err);
    return res.status(500).json({ error: 'Preview failed' });
  }
};
