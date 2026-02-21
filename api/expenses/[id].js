const { getAuthUser } = require('../../lib/auth');
const db = require('../../lib/db');

function getIdFromRequest(req) {
  const raw = req.url || req.originalUrl || '';
  if (!raw) return null;
  let pathname;
  try {
    pathname = raw.startsWith('http') ? new URL(raw).pathname : new URL(raw, 'http://localhost').pathname;
  } catch {
    pathname = raw.split('?')[0];
  }
  const match = pathname.match(/\/api\/expenses\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

module.exports = async function handler(req, res) {
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
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const id = getIdFromRequest(req);
  if (!id) {
    res.status(400).json({ error: 'Invalid expense id' });
    return;
  }

  if (req.method === 'PATCH') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const data = {};
      if (body.vendor !== undefined) data.vendor = body.vendor;
      if (body.amount_cents !== undefined) data.amount_cents = Math.round(Number(body.amount_cents));
      if (body.date !== undefined) data.date = body.date;
      if (body.status !== undefined) data.status = body.status === 'paid' ? 'paid' : 'pending';
      if (body.category !== undefined) data.category = body.category;
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.internal_bill_url !== undefined) data.internal_bill_url = body.internal_bill_url;
      if (body.third_party_invoice_url !== undefined) data.third_party_invoice_url = body.third_party_invoice_url;
      const row = await db.updateExpense(id, user.sub, data);
      if (!row) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }
      res.status(200).json(row);
    } catch (err) {
      console.error('PATCH expense error:', err);
      res.status(500).json({ error: 'Failed to update expense' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const deleted = await db.deleteExpense(id, user.sub);
      if (!deleted) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }
      res.status(204).end();
    } catch (err) {
      console.error('DELETE expense error:', err);
      res.status(500).json({ error: 'Failed to delete expense' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
