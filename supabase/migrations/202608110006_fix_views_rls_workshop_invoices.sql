-- Refresh public views + workshop invoice draft RLS + E2E smoke FN
-- Applied remotely: fix_views_rls_and_e2e_smoke, qa_e2e_hire_lifecycle_fn_v2

CREATE OR REPLACE VIEW public.clients AS SELECT * FROM rental.clients;
CREATE OR REPLACE VIEW public.orders AS SELECT * FROM rental.orders;
CREATE OR REPLACE VIEW public.delivery_tasks AS SELECT * FROM rental.delivery_tasks;
CREATE OR REPLACE VIEW public.invoices AS SELECT * FROM rental.invoices;
CREATE OR REPLACE VIEW public.order_asset_assignments AS SELECT * FROM rental.order_asset_assignments;
CREATE OR REPLACE VIEW public.leads AS SELECT * FROM rental.leads;
CREATE OR REPLACE VIEW public.equipment_assets AS SELECT * FROM rental.equipment_assets;
CREATE OR REPLACE VIEW public.invoice_lines AS SELECT * FROM rental.invoice_lines;
CREATE OR REPLACE VIEW public.order_items AS SELECT * FROM rental.order_items;
CREATE OR REPLACE VIEW public.equipment_catalog AS SELECT * FROM rental.equipment_catalog;
CREATE OR REPLACE VIEW public.generated_documents AS SELECT * FROM rental.generated_documents;
CREATE OR REPLACE VIEW public.communications AS SELECT * FROM rental.communications;
CREATE OR REPLACE VIEW public.maintenance_work_orders AS SELECT * FROM rental.maintenance_work_orders;
CREATE OR REPLACE VIEW public.order_attachments AS SELECT * FROM rental.order_attachments;

-- Workshop may insert draft invoices when closing returns
DROP POLICY IF EXISTS invoices_workshop_draft_insert ON rental.invoices;
CREATE POLICY invoices_workshop_draft_insert ON rental.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'draft'
    AND rental.has_role(ARRAY['workshop'::rental.app_role, 'sales'::rental.app_role, 'finance'::rental.app_role])
  );

DROP POLICY IF EXISTS invoices_workshop_select ON rental.invoices;
CREATE POLICY invoices_workshop_select ON rental.invoices
  FOR SELECT TO authenticated
  USING (rental.has_role(ARRAY['workshop'::rental.app_role]));

DROP POLICY IF EXISTS invoice_lines_workshop_insert ON rental.invoice_lines;
CREATE POLICY invoice_lines_workshop_insert ON rental.invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    rental.has_role(ARRAY['workshop'::rental.app_role, 'sales'::rental.app_role, 'finance'::rental.app_role])
    AND EXISTS (
      SELECT 1 FROM rental.invoices i
      WHERE i.id = invoice_id AND i.status = 'draft'
    )
  );

DROP POLICY IF EXISTS invoice_lines_workshop_select ON rental.invoice_lines;
CREATE POLICY invoice_lines_workshop_select ON rental.invoice_lines
  FOR SELECT TO authenticated
  USING (rental.has_role(ARRAY['workshop'::rental.app_role]));
