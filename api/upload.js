// Vercel Blob upload using REST API directly (no npm package needed)
// Uses BLOB_READ_WRITE_TOKEN environment variable set automatically by Vercel

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-filepath, x-access, x-filename');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return res.status(500).json({ error: 'Blob token not configured. Add BLOB_READ_WRITE_TOKEN in Vercel Environment Variables.' });

    const filepath = req.headers['x-filepath'];
    if (!filepath) return res.status(400).json({ error: 'Missing x-filepath header' });

    // Validate file type
    const allowed = ['pdf','xlsx','xls','png','jpg','jpeg','docx','eml','msg'];
    const ext = (filepath.split('.').pop() || '').toLowerCase();
    if (!allowed.includes(ext)) return res.status(400).json({ error: `File type .${ext} not allowed` });

    // Read raw body (bodyParser is off via config)
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 20 * 1024 * 1024) return res.status(413).json({ error: 'File exceeds 20MB limit' });
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    if (!body.length) return res.status(400).json({ error: 'Empty file received' });

    // Upload to Vercel Blob via REST API
    const blobResp = await fetch(`https://blob.vercel-storage.com/${filepath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': req.headers['content-type'] || 'application/octet-stream',
        'x-api-version': '7',
        'x-add-random-suffix': '0',
        'x-cache-control-max-age': '0',
      },
      body,
    });

    if (!blobResp.ok) {
      const errText = await blobResp.text();
      console.error('Blob API error:', blobResp.status, errText);
      return res.status(500).json({ error: `Blob storage error: ${blobResp.status} — ${errText.slice(0, 200)}` });
    }

    const data = await blobResp.json();

    return res.status(200).json({
      url:        data.url,
      path:       filepath,
      size:       body.length,
      uploadedAt: new Date().toISOString(),
    });

  } catch (e) {
    console.error('Upload handler error:', e);
    return res.status(500).json({ error: e.message || 'Unknown error' });
  }
};

// Tell Vercel not to parse the body — we read the raw stream
module.exports.config = { api: { bodyParser: false } };
