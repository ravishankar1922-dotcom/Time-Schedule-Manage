const { put } = require('@vercel/blob');

// Extend max duration on Hobby plan (default is 10s, max allowed is 60s).
// This prevents silent failures on slower office network uploads.
module.exports.config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-filepath, x-filename');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return res.status(500).json({ error: 'Blob token not configured on server. Contact administrator.' });

    const filepath = req.headers['x-filepath'];
    if (!filepath) return res.status(400).json({ error: 'Missing file path. Please try selecting the file again.' });

    const allowed = ['pdf','xlsx','xls','png','jpg','jpeg','docx','eml','msg'];
    const ext = (filepath.split('.').pop() || '').toLowerCase();
    if (!allowed.includes(ext)) return res.status(400).json({ error: `File type .${ext} not allowed.` });

    // Read raw body with explicit error handling for connection drops
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 20 * 1024 * 1024) {
          return res.status(413).json({ error: 'File exceeds 20MB limit.' });
        }
        chunks.push(chunk);
      }
    } catch (streamErr) {
      console.error('Stream read error (likely dropped connection):', streamErr);
      return res.status(499).json({ error: 'Connection was interrupted while uploading. Please try again.' });
    }

    const body = Buffer.concat(chunks);
    if (!body.length) {
      return res.status(400).json({ error: 'Received an empty file (0 bytes). Please try selecting the file again.' });
    }

    // Hobby plan only supports access: 'public'
    let blob;
    try {
      blob = await put(filepath, body, {
        access: 'public',
        addRandomSuffix: false,
        token,
      });
    } catch (blobErr) {
      console.error('Vercel Blob put() error:', blobErr);
      return res.status(502).json({ error: 'Storage service error: ' + (blobErr.message || 'upload rejected by storage provider') });
    }

    if (!blob || !blob.url) {
      return res.status(502).json({ error: 'Storage upload completed but no URL was returned.' });
    }

    return res.status(200).json({
      url:         blob.url,
      downloadUrl: blob.downloadUrl,
      path:        filepath,
      size:        body.length,
      uploadedAt:  new Date().toISOString(),
    });

  } catch (e) {
    console.error('Upload handler unexpected error:', e);
    return res.status(500).json({ error: e.message || 'Unknown server error during upload.' });
  }
};
