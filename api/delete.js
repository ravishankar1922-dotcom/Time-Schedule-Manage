// Vercel Blob delete/list using REST API directly

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(500).json({ error: 'Blob token not configured' });

  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', c => data += c);
      req.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
      req.on('error', reject);
    });

    const { action, url, urls, prefix } = body;

    if (action === 'delete' && url) {
      const r = await fetch(url + '?action=delete', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'x-api-version': '7' }
      });
      return res.status(200).json({ ok: r.ok });
    }

    if (action === 'delete_many' && Array.isArray(urls)) {
      await Promise.all(urls.map(u =>
        fetch(u + '?action=delete', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}`, 'x-api-version': '7' }
        })
      ));
      return res.status(200).json({ ok: true, deleted: urls.length });
    }

    if (action === 'list') {
      const params = new URLSearchParams({ prefix: prefix || '', limit: '100' });
      const r = await fetch(`https://blob.vercel-storage.com?${params}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'x-api-version': '7' }
      });
      const data2 = await r.json();
      return res.status(200).json({ blobs: data2.blobs || [] });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error('Delete handler error:', e);
    return res.status(500).json({ error: e.message });
  }
};
