-- Run this once in your Postgres SQL console (Vercel Postgres: Storage → DB → Query; Neon: SQL Editor).
-- See README "Database setup" for full steps. Creates the expenses table required for Bills & Expenses.
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  vendor TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  category TEXT,
  notes TEXT,
  internal_bill_url TEXT,
  third_party_invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
