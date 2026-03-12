const { put } = require('@vercel/blob');
const Busboy = require('busboy');
const { getAuthUser } = require('../lib/auth');

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const busboy = Busboy({ headers: req.headers });
    let filename = 'file.pdf';
    busboy.on('file', (fieldname, file, info) => {
      filename = info.filename || 'file.pdf';
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {});
    });
    busboy.on('finish', () => resolve({ buffer: Buffer.concat(chunks), filename }));
    busboy.on('error', reject);
    req.pipe(busboy);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (user.denied) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  try {
    const { buffer, filename } = await parseMultipart(req);
    if (!buffer || buffer.length === 0) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const pathname = `${user.sub}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const blob = await put(pathname, buffer, { access: 'public', addRandomSuffix: true });
    res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};
