const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-filepath, x-filename');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const filepath = req.headers['x-filepath'];
    if (!filepath) return res.status(400).json({ error: 'Missing x-filepath header' });

    const allowed = ['pdf','xlsx','xls','png','jpg','jpeg','docx','eml','msg'];
    const ext = (filepath.split('.').pop() || '').toLowerCase();
    if (!allowed.includes(ext)) return res.status(400).json({ error: `File type .${ext} not allowed` });

    // Read raw body
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 20 * 1024 * 1024) return res.status(413).json({ error: 'File exceeds 20MB' });
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    if (!body.length) return res.status(400).json({ error: 'Empty file' });

    // Hobby plan only supports access: 'public'
    const blob = await put(filepath, body, {
      access: 'public',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({
      url:         blob.url,
      downloadUrl: blob.downloadUrl,
      path:        filepath,
      size:        body.length,
      uploadedAt:  new Date().toISOString(),
    });

  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: e.message || 'Unknown error' });
  }
};

module.exports.config = { api: { bodyParser: false } };
