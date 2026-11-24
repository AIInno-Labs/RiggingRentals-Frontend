-- MVP: credit hold, hire acceptance audit, missing gear, ePOD, accounting sync
-- Applied remotely as mvp_credit_acceptance_epod_accounting

ALTER TABLE rental.clients
  ADD COLUMN IF NOT EXISTS credit_limit numeric NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  ADD COLUMN IF NOT EXISTS on_stop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS on_stop_reason text NOT NULL DEFAULT '';

ALTER TABLE rental.orders
  ADD COLUMN IF NOT EXISTS hire_accepted_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hire_accepted_method text NOT NULL DEFAULT '';

ALTER TABLE rental.order_asset_assignments
  ADD COLUMN IF NOT EXISTS missing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missing_fee numeric NOT NULL DEFAULT 0 CHECK (missing_fee >= 0);

ALTER TABLE rental.delivery_tasks
  ADD COLUMN IF NOT EXISTS pod_signed_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pod_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pod_photo_url text NOT NULL DEFAULT '';

ALTER TABLE rental.invoices
  ADD COLUMN IF NOT EXISTS accounting_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS accounting_export_ref text NOT NULL DEFAULT '';
