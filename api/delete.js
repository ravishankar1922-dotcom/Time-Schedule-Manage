const { del, list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', c => data += c);
      req.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
      req.on('error', reject);
    });

    const { action, url, urls, prefix } = body;
    const opts = { token: process.env.BLOB_READ_WRITE_TOKEN };

    if (action === 'delete' && url) {
      await del(url, opts);
      return res.status(200).json({ ok: true });
    }
    if (action === 'delete_many' && Array.isArray(urls)) {
      await del(urls, opts);
      return res.status(200).json({ ok: true, deleted: urls.length });
    }
    if (action === 'list') {
      const result = await list({ prefix: prefix || '', ...opts });
      return res.status(200).json({ blobs: result.blobs });
    }
    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error('Blob action error:', e);
    return res.status(500).json({ error: e.message });
  }
};
