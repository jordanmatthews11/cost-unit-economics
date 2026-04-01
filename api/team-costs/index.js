const { getAuthUser } = require('../../lib/auth');
const db = require('../../lib/db');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.status(204).end();
    return;
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: 'Server misconfigured', code: 'GOOGLE_CLIENT_ID_MISSING' });
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
  const userId = user.sub;

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    res.status(503).json({ error: 'Server misconfigured', code: 'FIRESTORE_NOT_CONFIGURED' });
    return;
  }
  try {
    db.parseFirebaseCredential(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (parseErr) {
    res.status(503).json({
      error: parseErr.message || 'Invalid Firebase JSON',
      code: 'FIRESTORE_INVALID_JSON',
    });
    return;
  }

  const method = (req.method || '').toUpperCase();

  if (method === 'GET') {
    try {
      const unitEconomics = await db.getTeamCostsByUserId(userId);
      setCorsHeaders(res);
      res.status(200).json({ unitEconomics });
    } catch (err) {
      console.error('GET team-costs error:', err);
      res.status(500).json({ error: 'Failed to load team costs' });
    }
    return;
  }

  if (method === 'PUT') {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseErr) {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
    const { unitEconomics } = body || {};
    if (!unitEconomics || typeof unitEconomics !== 'object' || Array.isArray(unitEconomics)) {
      res.status(400).json({ error: 'unitEconomics object required' });
      return;
    }
    try {
      await db.upsertTeamCosts(userId, unitEconomics);
      setCorsHeaders(res);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('PUT team-costs error:', err);
      res.status(500).json({ error: 'Failed to save team costs' });
    }
    return;
  }

  setCorsHeaders(res);
  res.setHeader('Allow', 'GET, PUT, OPTIONS');
  res.status(405).json({ error: 'Method not allowed' });
};
