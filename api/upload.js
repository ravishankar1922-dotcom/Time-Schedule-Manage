import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-filepath, x-access');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Path comes from client: attachments/TSL/AP/2026/06/actId/proof_v1.pdf
    const filepath = req.headers['x-filepath'];
    const access   = req.headers['x-access'] || 'private';

    if (!filepath) return res.status(400).json({ error: 'Missing x-filepath header' });

    // Allowed file types
    const allowed = ['pdf','xlsx','xls','png','jpg','jpeg','docx','eml','msg'];
    const ext = filepath.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) return res.status(400).json({ error: `File type .${ext} not allowed` });

    // Max 20MB — read raw body
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 20 * 1024 * 1024) return res.status(413).json({ error: 'File exceeds 20MB limit' });
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    const blob = await put(filepath, body, {
      access,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });

    return res.status(200).json({
      url:      blob.url,
      path:     blob.pathname,
      size:     body.length,
      uploadedAt: new Date().toISOString(),
    });

  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: e.message });
  }
}
