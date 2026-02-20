const admin = require('firebase-admin');

const EXPENSES = 'expenses';

function parseFirebaseCredential(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let jsonStr = trimmed;
  if (trimmed.startsWith('eyJ')) {
    try {
      jsonStr = Buffer.from(trimmed, 'base64').toString('utf8');
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON: invalid base64');
    }
  }
  try {
    const cred = JSON.parse(jsonStr);
    if (cred.private_key && typeof cred.private_key === 'string') {
      cred.private_key = cred.private_key.replace(/\\n/g, '\n');
    }
    return cred;
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON (paste entire file; use one line or base64 to avoid newline issues)');
  }
}

function getFirestore() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
    const cred = parseFirebaseCredential(raw);
    if (!cred) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin.firestore();
}

function docToRow(id, data) {
  const created = data.created_at && data.created_at.toDate ? data.created_at.toDate() : null;
  const updated = data.updated_at && data.updated_at.toDate ? data.updated_at.toDate() : null;
  return {
    id,
    user_id: data.user_id,
    vendor: data.vendor,
    amount_cents: data.amount_cents,
    date: data.date,
    status: data.status,
    category: data.category ?? null,
    notes: data.notes ?? null,
    internal_bill_url: data.internal_bill_url ?? null,
    third_party_invoice_url: data.third_party_invoice_url ?? null,
    created_at: created ? created.toISOString() : null,
    updated_at: updated ? updated.toISOString() : null,
  };
}

async function getExpensesByUserId(userId, statusFilter = null, categoryFilter = null, yearFilter = null, monthFilter = null, vendorFilter = null) {
  const firestore = getFirestore();
  const q = firestore
    .collection(EXPENSES)
    .where('user_id', '==', userId)
    .orderBy('date', 'desc');

  const snap = await q.get();
  let rows = snap.docs.map((doc) => docToRow(doc.id, doc.data()));

  if (statusFilter && statusFilter.trim()) {
    rows = rows.filter((r) => (r.status || '').toLowerCase() === statusFilter.trim().toLowerCase());
  }
  if (categoryFilter && categoryFilter.trim()) {
    const lower = categoryFilter.trim().toLowerCase();
    rows = rows.filter((r) => (r.category || '').toLowerCase().includes(lower));
  }
  if (yearFilter && yearFilter.trim()) {
    const year = yearFilter.trim();
    rows = rows.filter((r) => (r.date || '').slice(0, 4) === year);
  }
  if (monthFilter && monthFilter.trim()) {
    const month = monthFilter.trim();
    const monthPadded = month.length === 1 ? '0' + month : month;
    rows = rows.filter((r) => (r.date || '').slice(5, 7) === monthPadded);
  }
  if (vendorFilter && vendorFilter.trim()) {
    const lower = vendorFilter.trim().toLowerCase();
    rows = rows.filter((r) => (r.vendor || '').toLowerCase().includes(lower));
  }

  return rows;
}

async function createExpense(data) {
  const firestore = getFirestore();
  const ref = firestore.collection(EXPENSES).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const payload = {
    user_id: data.user_id,
    vendor: data.vendor,
    amount_cents: data.amount_cents,
    date: data.date,
    status: data.status,
    category: data.category ?? null,
    notes: data.notes ?? null,
    internal_bill_url: data.internal_bill_url ?? null,
    third_party_invoice_url: data.third_party_invoice_url ?? null,
    created_at: now,
    updated_at: now,
  };
  await ref.set(payload);
  const snap = await ref.get();
  return docToRow(snap.id, snap.data());
}

async function getExpenseById(id, userId) {
  const firestore = getFirestore();
  const snap = await firestore.collection(EXPENSES).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.user_id !== userId) return null;
  return docToRow(snap.id, data);
}

async function updateExpense(id, userId, data) {
  const existing = await getExpenseById(id, userId);
  if (!existing) return null;
  const firestore = getFirestore();
  const ref = firestore.collection(EXPENSES).doc(id);
  const updates = {
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (data.vendor !== undefined) updates.vendor = data.vendor;
  if (data.amount_cents !== undefined) updates.amount_cents = data.amount_cents;
  if (data.date !== undefined) updates.date = data.date;
  if (data.status !== undefined) updates.status = data.status;
  if (data.category !== undefined) updates.category = data.category;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.internal_bill_url !== undefined) updates.internal_bill_url = data.internal_bill_url;
  if (data.third_party_invoice_url !== undefined) updates.third_party_invoice_url = data.third_party_invoice_url;
  await ref.update(updates);
  const snap = await ref.get();
  return docToRow(snap.id, snap.data());
}

async function deleteExpense(id, userId) {
  const existing = await getExpenseById(id, userId);
  if (!existing) return false;
  const firestore = getFirestore();
  await firestore.collection(EXPENSES).doc(id).delete();
  return true;
}

module.exports = {
  parseFirebaseCredential,
  getExpensesByUserId,
  createExpense,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
