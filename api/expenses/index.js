const { getAuthUser } = require('../../lib/auth');
const db = require('../../lib/db');

module.exports = async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const userId = user.sub;

  if (req.method === 'GET') {
    try {
      const status = req.query.status || null;
      const category = req.query.category || null;
      const rows = await db.getExpensesByUserId(userId, status, category);
      res.status(200).json(rows);
    } catch (err) {
      console.error('GET expenses error:', err);
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { vendor, amount_cents, date, status, category, notes, internal_bill_url, third_party_invoice_url } = body;
      if (!vendor || amount_cents == null || !date || !status) {
        res.status(400).json({ error: 'Missing required fields: vendor, amount_cents, date, status' });
        return;
      }
      const row = await db.createExpense({
        user_id: userId,
        vendor,
        amount_cents: Math.round(Number(amount_cents)),
        date,
        status: status === 'paid' ? 'paid' : 'pending',
        category: category || null,
        notes: notes || null,
        internal_bill_url: internal_bill_url || null,
        third_party_invoice_url: third_party_invoice_url || null,
      });
      res.status(201).json(row);
    } catch (err) {
      console.error('POST expenses error:', err);
      res.status(500).json({ error: 'Failed to create expense' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
