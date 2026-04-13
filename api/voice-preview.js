/**
 * Vercel Serverless Function — /api/voice-preview
 *
 * Fetches the ElevenLabs preview_url for a voice (pre-recorded sample)
 * and redirects to it. No TTS credits consumed — works on free tier.
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
    /* Fetch voice metadata — includes a preview_url with a pre-recorded sample */
    const response = await fetch(
      `https://api.elevenlabs.io/v1/voices/${voiceId}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': apiKey },
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('ElevenLabs error:', response.status, errText);
      return res.status(502).json({ error: 'Voice service error' });
    }

    const data = await response.json();
    const previewUrl = data.preview_url;

    if (!previewUrl) {
      return res.status(404).json({ error: 'No preview available for this voice' });
    }

    /* Redirect to the CDN-hosted sample — fast, free, cacheable */
    res.setHeader('Cache-Control', 'public, s-maxage=604800, max-age=604800'); // 7 days
    return res.redirect(302, previewUrl);
  } catch (err) {
    console.error('Voice preview error:', err);
    return res.status(500).json({ error: 'Preview failed' });
  }
};
