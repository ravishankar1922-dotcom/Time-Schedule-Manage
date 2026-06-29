import { del, list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, url, prefix } = req.body || {};

  try {
    if (action === 'delete' && url) {
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.status(200).json({ ok: true, deleted: url });
    }

    if (action === 'list' && prefix) {
      const result = await list({ prefix, token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.status(200).json({ blobs: result.blobs });
    }

    if (action === 'delete_many' && Array.isArray(req.body.urls)) {
      await del(req.body.urls, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.status(200).json({ ok: true, deleted: req.body.urls.length });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error('Blob action error:', e);
    return res.status(500).json({ error: e.message });
  }
}
