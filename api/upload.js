const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-filepath, x-filename');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return res.status(500).json({ error: 'Blob token not configured. Contact your administrator.' });

    const rawpath = req.headers['x-filepath'];
    if (!rawpath) return res.status(400).json({ error: 'Missing file path header.' });

    // Sanitise path — convert spaces and unsafe chars to underscores
    const filepath = rawpath.split('/').map(seg =>
      seg.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_')
    ).join('/');

    const allowed = ['pdf','xlsx','xls','png','jpg','jpeg','docx','eml','msg'];
    const ext = (filepath.split('.').pop() || '').toLowerCase();
    if (!allowed.includes(ext)) {
      return res.status(400).json({ error: `File type .${ext} not allowed.` });
    }

    // Read raw body stream
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
      return res.status(499).json({ error: 'Connection interrupted. Please try again.' });
    }

    const body = Buffer.concat(chunks);
    if (!body.length) {
      return res.status(400).json({ error: 'Empty file received. Please select a valid file.' });
    }

    // Upload to Vercel Blob (Hobby plan = public access only)
    let blob;
    try {
      blob = await put(filepath, body, {
        access: 'public',
        addRandomSuffix: false,
        token,
      });
    } catch (blobErr) {
      console.error('Blob put error:', blobErr);
      return res.status(502).json({ error: 'Storage error: ' + (blobErr.message || 'upload rejected') });
    }

    if (!blob || !blob.url) {
      return res.status(502).json({ error: 'Upload completed but no URL returned.' });
    }

    return res.status(200).json({
      url:         blob.url,
      downloadUrl: blob.downloadUrl || blob.url,
      path:        filepath,
      size:        body.length,
      uploadedAt:  new Date().toISOString(),
    });

  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: e.message || 'Unknown server error.' });
  }
};

// Vercel config — must be exported separately after handler
module.exports.config = {
  api: { bodyParser: false },
};
