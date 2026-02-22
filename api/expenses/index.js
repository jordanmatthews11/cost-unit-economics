const { getAuthUser } = require('../../lib/auth');
const db = require('../../lib/db');

function getPathname(req) {
  const raw = req.url || req.originalUrl || '';
  if (!raw) return '';
  try {
    if (raw.startsWith('http')) return new URL(raw).pathname;
    return new URL(raw, 'http://localhost').pathname;
  } catch {
    return raw.split('?')[0];
  }
}

/** Extract expense ID from path segments or query. Supports /api/expenses/:id, /expenses/:id, and single-segment path. */
function getExpenseId(req) {
  const pathname = getPathname(req);
  const segments = (pathname || '')
    .split('/')
    .map((s) => s.split('?')[0])
    .filter(Boolean);
  const expensesIdx = segments.indexOf('expenses');
  if (expensesIdx >= 0 && segments[expensesIdx + 1]) {
    try {
      return decodeURIComponent(segments[expensesIdx + 1]);
    } catch {
      return null;
    }
  }
  const regexMatch = (pathname || '').match(/\/expenses\/([^/?#]+)/);
  if (regexMatch) {
    try {
      return decodeURIComponent(regexMatch[1]);
    } catch {
      return null;
    }
  }
  if (segments.length === 1 && segments[0]) {
    try {
      return decodeURIComponent(segments[0]);
    } catch {
      return null;
    }
  }
  const q = req.query || {};
  const idFromQuery = q.id || q.expenseId;
  if (idFromQuery && typeof idFromQuery === 'string') {
    try {
      return decodeURIComponent(idFromQuery);
    } catch {
      return null;
    }
  }
  return null;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async function handler(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: 'Server misconfigured', code: 'GOOGLE_CLIENT_ID_MISSING' });
    return;
  }
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
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
  const expenseId = getExpenseId(req);
  const pathname = getPathname(req);
  if (method === 'DELETE' || method === 'PATCH' || method === 'OPTIONS') {
    console.log('[expenses index]', method, 'pathname=', pathname, 'expenseId=', expenseId ? '***' : null);
  }

  // /api/expenses/:id — handle DELETE, PATCH, OPTIONS inline so it works when this function receives the request
  if (expenseId && (method === 'DELETE' || method === 'PATCH' || method === 'OPTIONS')) {
    if (method === 'OPTIONS') {
      setCorsHeaders(res);
      res.status(204).end();
      return;
    }
    if (method === 'DELETE') {
      try {
        const deleted = await db.deleteExpense(expenseId, userId);
        if (!deleted) {
          res.status(404).json({ error: 'Expense not found' });
          return;
        }
        setCorsHeaders(res);
        res.status(204).end();
      } catch (err) {
        console.error('DELETE expense error:', err);
        res.status(500).json({ error: 'Failed to delete expense' });
      }
      return;
    }
    if (method === 'PATCH') {
      try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const data = {};
        if (body && body.vendor !== undefined) data.vendor = body.vendor;
        if (body && body.amount_cents !== undefined) data.amount_cents = Math.round(Number(body.amount_cents));
        if (body && body.date !== undefined) data.date = body.date;
        if (body && body.status !== undefined) data.status = body.status === 'paid' ? 'paid' : 'pending';
        if (body && body.category !== undefined) data.category = body.category;
        if (body && body.notes !== undefined) data.notes = body.notes;
        if (body && body.internal_bill_url !== undefined) data.internal_bill_url = body.internal_bill_url;
        if (body && body.third_party_invoice_url !== undefined) data.third_party_invoice_url = body.third_party_invoice_url;
        const row = await db.updateExpense(expenseId, userId, data);
        if (!row) {
          res.status(404).json({ error: 'Expense not found' });
          return;
        }
        setCorsHeaders(res);
        res.status(200).json(row);
      } catch (err) {
        console.error('PATCH expense error:', err);
        res.status(500).json({ error: 'Failed to update expense' });
      }
      return;
    }
  }

  if (req.method === 'GET') {
    try {
      const status = req.query.status || null;
      const category = req.query.category || null;
      const year = req.query.year || null;
      let month = req.query.month;
      if (month == null) month = null;
      else if (Array.isArray(month)) month = month.filter((m) => m != null && String(m).trim() !== '').map((m) => String(m).trim());
      else month = [String(month).trim()].filter(Boolean);
      if (month && month.length === 0) month = null;
      const vendor = req.query.vendor || null;
      const rows = await db.getExpensesByUserId(userId, status, category, year, month, vendor);
      res.status(200).json(rows);
    } catch (err) {
      console.error('GET expenses error:', err);
      const msg = (err && err.message) ? String(err.message) : '';
      const details = (err && err.details) ? String(err.details) : '';
      const full = msg + details;
      const indexMatch = full.match(/https:\/\/console\.firebase\.google\.com[^\s'"]+/);
      if (full.includes('requires an index') && indexMatch) {
        res.status(503).json({
          error: 'Firestore index required. Create it using the link.',
          code: 'FIRESTORE_INDEX_REQUIRED',
          indexUrl: indexMatch[0],
        });
        return;
      }
      const payload = { error: 'Failed to fetch expenses' };
      if (process.env.NODE_ENV !== 'production' && err && err.message) {
        payload.detail = err.message;
      }
      res.status(500).json(payload);
    }
    return;
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseErr) {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
    const { vendor, amount_cents, date, status, category, notes, internal_bill_url, third_party_invoice_url } = body || {};
    if (!String(vendor).trim() || amount_cents == null || !date || !status) {
      res.status(400).json({ error: 'Missing required fields: vendor, amount_cents, date, status' });
      return;
    }
    const amountNum = Math.round(Number(amount_cents));
    if (!Number.isFinite(amountNum)) {
      res.status(400).json({ error: 'amount_cents must be a number' });
      return;
    }
    const dateStr = String(date).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      return;
    }
    try {
      const row = await db.createExpense({
        user_id: userId,
        vendor: String(vendor).trim(),
        amount_cents: amountNum,
        date: dateStr,
        status: status === 'paid' ? 'paid' : 'pending',
        category: category || null,
        notes: notes || null,
        internal_bill_url: internal_bill_url || null,
        third_party_invoice_url: third_party_invoice_url || null,
      });
      res.status(201).json(row);
    } catch (err) {
      console.error('POST expenses error:', err);
      const msg = (err && err.message) ? String(err.message) : '';
      const details = (err && err.details) ? String(err.details) : '';
      const full = msg + details;
      const indexMatch = full.match(/https:\/\/console\.firebase\.google\.com[^\s'"]+/);
      if (full.includes('requires an index') && indexMatch) {
        res.status(503).json({
          error: 'Firestore index required. Create it using the link.',
          code: 'FIRESTORE_INDEX_REQUIRED',
          indexUrl: indexMatch[0],
        });
        return;
      }
      const payload = { error: 'Failed to create expense' };
      if (process.env.NODE_ENV !== 'production' && err && err.message) {
        payload.detail = err.message;
      }
      res.status(500).json(payload);
    }
    return;
  }

  setCorsHeaders(res);
  res.setHeader('Allow', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.status(405).json({ error: 'Method not allowed' });
};
