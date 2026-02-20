const { sql } = require('@vercel/postgres');

async function getExpensesByUserId(userId, statusFilter = null, categoryFilter = null) {
  if (statusFilter && categoryFilter) {
    const { rows } = await sql`
      SELECT id, user_id, vendor, amount_cents, date, status, category, notes,
             internal_bill_url, third_party_invoice_url, created_at, updated_at
      FROM expenses
      WHERE user_id = ${userId} AND status = ${statusFilter} AND category ILIKE ${'%' + categoryFilter + '%'}
      ORDER BY date DESC
    `;
    return rows;
  }
  if (statusFilter) {
    const { rows } = await sql`
      SELECT id, user_id, vendor, amount_cents, date, status, category, notes,
             internal_bill_url, third_party_invoice_url, created_at, updated_at
      FROM expenses
      WHERE user_id = ${userId} AND status = ${statusFilter}
      ORDER BY date DESC
    `;
    return rows;
  }
  if (categoryFilter) {
    const { rows } = await sql`
      SELECT id, user_id, vendor, amount_cents, date, status, category, notes,
             internal_bill_url, third_party_invoice_url, created_at, updated_at
      FROM expenses
      WHERE user_id = ${userId} AND category ILIKE ${'%' + categoryFilter + '%'}
      ORDER BY date DESC
    `;
    return rows;
  }
  const { rows } = await sql`
    SELECT id, user_id, vendor, amount_cents, date, status, category, notes,
           internal_bill_url, third_party_invoice_url, created_at, updated_at
    FROM expenses
    WHERE user_id = ${userId}
    ORDER BY date DESC
  `;
  return rows;
}

async function createExpense(data) {
  const { rows } = await sql`
    INSERT INTO expenses (user_id, vendor, amount_cents, date, status, category, notes, internal_bill_url, third_party_invoice_url)
    VALUES (${data.user_id}, ${data.vendor}, ${data.amount_cents}, ${data.date}, ${data.status}, ${data.category || null}, ${data.notes || null}, ${data.internal_bill_url || null}, ${data.third_party_invoice_url || null})
    RETURNING id, user_id, vendor, amount_cents, date, status, category, notes, internal_bill_url, third_party_invoice_url, created_at, updated_at
  `;
  return rows[0];
}

async function getExpenseById(id, userId) {
  const { rows } = await sql`
    SELECT id, user_id, vendor, amount_cents, date, status, category, notes,
           internal_bill_url, third_party_invoice_url, created_at, updated_at
    FROM expenses
    WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows[0] || null;
}

async function updateExpense(id, userId, data) {
  const existing = await getExpenseById(id, userId);
  if (!existing) return null;
  const vendor = data.vendor !== undefined ? data.vendor : existing.vendor;
  const amount_cents = data.amount_cents !== undefined ? data.amount_cents : existing.amount_cents;
  const date = data.date !== undefined ? data.date : existing.date;
  const status = data.status !== undefined ? data.status : existing.status;
  const category = data.category !== undefined ? data.category : existing.category;
  const notes = data.notes !== undefined ? data.notes : existing.notes;
  const internal_bill_url = data.internal_bill_url !== undefined ? data.internal_bill_url : existing.internal_bill_url;
  const third_party_invoice_url = data.third_party_invoice_url !== undefined ? data.third_party_invoice_url : existing.third_party_invoice_url;
  const { rows } = await sql`
    UPDATE expenses
    SET vendor = ${vendor}, amount_cents = ${amount_cents}, date = ${date}, status = ${status},
        category = ${category}, notes = ${notes}, internal_bill_url = ${internal_bill_url}, third_party_invoice_url = ${third_party_invoice_url}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, user_id, vendor, amount_cents, date, status, category, notes, internal_bill_url, third_party_invoice_url, created_at, updated_at
  `;
  return rows[0] || null;
}

async function deleteExpense(id, userId) {
  const { rowCount } = await sql`
    DELETE FROM expenses WHERE id = ${id} AND user_id = ${userId}
  `;
  return rowCount > 0;
}

module.exports = {
  getExpensesByUserId,
  createExpense,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
