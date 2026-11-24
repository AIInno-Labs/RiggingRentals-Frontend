-- Auto E2E smoke: lead → quote → accept → confirm → dispatch → ePOD → return → invoice → pay/Xero
-- Run: select public.qa_e2e_hire_lifecycle();

CREATE OR REPLACE FUNCTION rental.qa_e2e_hire_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'rental', 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_catalog_id uuid;
  v_asset_id uuid;
  v_order_id uuid;
  v_item_id uuid;
  v_asg_id uuid;
  v_task_id uuid;
  v_invoice_id uuid;
  v_order_no text;
  v_period_start date;
  v_period_end date;
  v_steps jsonb := '[]'::jsonb;
  v_fail text := NULL;
  v_status text;
  v_count int;
BEGIN
  SELECT a.id, a.catalog_id INTO v_asset_id, v_catalog_id
  FROM rental.equipment_assets a
  WHERE a.status = 'available'
  ORDER BY a.serial_number
  LIMIT 1;

  IF v_asset_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No available asset for E2E');
  END IF;

  INSERT INTO rental.clients (company_name, contact_name, email, phone, credit_account, credit_limit, payment_terms_days, on_stop)
  VALUES ('E2E QA Hire Co', 'QA Bot', 'qa-e2e@example.com', '0400000000', true, 50000, 30, false)
  RETURNING id INTO v_client_id;
  v_steps := v_steps || jsonb_build_array(jsonb_build_object('step','client','ok',true));

  INSERT INTO rental.leads (source, company_name, contact_name, email, phone, notes, status, client_id)
  VALUES ('email', 'E2E QA Hire Co', 'QA Bot', 'qa-e2e@example.com', '0400000000', 'E2E seed lead', 'qualified', v_client_id);

  v_order_no := rental.next_order_number();

  INSERT INTO rental.orders (
    order_number, client_id, status, start_at, end_at,
    jobsite_name, delivery_address, purchase_order,
    delivery_required, pickup_required, quote_valid_until,
    payment_required, payment_status, security_deposit, fuel_surcharge
  ) VALUES (
    v_order_no, v_client_id, 'draft',
    now() + interval '2 days', now() + interval '16 days',
    'E2E Jobsite', '1 Test Road', 'PO-E2E-1',
    true, true, (current_date + 30),
    false, 'not_required', 500, 50
  ) RETURNING id INTO v_order_id;

  INSERT INTO rental.order_items (order_id, catalog_id, quantity, daily_rate, weekly_rate, monthly_rate, overage_rate_per_hour)
  SELECT v_order_id, c.id, 1, c.daily_rate, c.weekly_rate, c.monthly_rate, c.overage_rate_per_hour
  FROM rental.equipment_catalog c WHERE c.id = v_catalog_id
  RETURNING id INTO v_item_id;
  v_steps := v_steps || jsonb_build_array(jsonb_build_object('step','quote','ok',true,'order',v_order_no));

  UPDATE rental.orders SET
    accepted_hire_agreement_at = now(),
    hire_accepted_by = 'QA Bot',
    hire_accepted_method = 'email_reply'
  WHERE id = v_order_id;

  UPDATE rental.orders SET status = 'confirmed', charging_started_at = now() WHERE id = v_order_id;
  INSERT INTO rental.order_asset_assignments (order_item_id, asset_id, dispatch_meter, reserved_at)
  SELECT v_item_id, v_asset_id, meter_hours, now() FROM rental.equipment_assets WHERE id = v_asset_id;
  UPDATE rental.equipment_assets SET status = 'reserved' WHERE id = v_asset_id;
  UPDATE rental.orders SET status = 'pre_pick' WHERE id = v_order_id;
  INSERT INTO rental.delivery_tasks (order_id, task_type, status, scheduled_at, address, driver_notes)
  VALUES (v_order_id, 'delivery', 'scheduled', now() + interval '2 days', '1 Test Road', 'E2E delivery')
  RETURNING id INTO v_task_id;

  SELECT id INTO v_asg_id FROM rental.order_asset_assignments WHERE order_item_id = v_item_id AND asset_id = v_asset_id;
  UPDATE rental.order_asset_assignments SET
    dispatched_at = now(), cert_checked_at = now(), dispatch_meter = COALESCE(dispatch_meter, 0)
  WHERE id = v_asg_id;
  UPDATE rental.equipment_assets SET status = 'on_hire' WHERE id = v_asset_id;
  UPDATE rental.orders SET status = 'dispatched' WHERE id = v_order_id;

  UPDATE rental.delivery_tasks SET
    status = 'completed', completed_at = now(),
    pod_signed_by = 'Site Foreman', pod_notes = 'Left at compound'
  WHERE id = v_task_id;

  UPDATE rental.orders SET status = 'off_rent_pending', off_rent_at = now() WHERE id = v_order_id;
  INSERT INTO rental.delivery_tasks (order_id, task_type, status, scheduled_at, address, driver_notes)
  VALUES (v_order_id, 'pickup', 'scheduled', now(), '1 Test Road', 'E2E pickup');

  UPDATE rental.order_asset_assignments SET
    return_meter = COALESCE(dispatch_meter,0) + 12,
    inspection_notes = 'E2E dirty return',
    dirty = true, cleaning_fee = 75,
    damaged = false, missing = false,
    returned_at = now(), off_hired_at = now(),
    billing_end_at = now(), removed_from_docket = true
  WHERE id = v_asg_id;
  UPDATE rental.equipment_assets SET status = 'in_inspection', meter_hours = COALESCE(meter_hours,0) + 12 WHERE id = v_asset_id;
  UPDATE rental.orders SET status = 'returned', off_rent_at = COALESCE(off_rent_at, now()) WHERE id = v_order_id;

  SELECT start_at::date, COALESCE(off_rent_at, end_at)::date
  INTO v_period_start, v_period_end
  FROM rental.orders WHERE id = v_order_id;

  INSERT INTO rental.invoices (
    order_id, invoice_number, status, kind, period_start, period_end,
    subtotal, discount_amount, deposit_applied, gst_rate, gst_amount, total, payment_due_at
  ) VALUES (
    v_order_id, 'INV-E2E-' || substr(v_order_id::text,1,8), 'draft', 'final',
    v_period_start, v_period_end,
    1000, 0, 500, 0.10, 100, 1100, current_date + 30
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO rental.invoice_lines (invoice_id, kind, description, quantity, unit_amount, line_total, sort_order)
  VALUES
    (v_invoice_id, 'rental', 'E2E hire', 1, 1000, 1000, 1),
    (v_invoice_id, 'other', 'Cleaning fee', 1, 75, 75, 2),
    (v_invoice_id, 'deposit_credit', 'Security deposit applied', 1, -500, -500, 3);

  UPDATE rental.invoices SET status = 'approved', approved_at = now() WHERE id = v_invoice_id;
  UPDATE rental.orders SET status = 'invoiced' WHERE id = v_order_id;
  UPDATE rental.invoices SET paid_at = now(), paid_amount = total, accounting_synced_at = now(), accounting_export_ref = 'XERO-E2E'
  WHERE id = v_invoice_id;

  UPDATE rental.equipment_assets SET status = 'available' WHERE id = v_asset_id AND status = 'in_inspection';

  SELECT status INTO v_status FROM rental.orders WHERE id = v_order_id;
  IF v_status <> 'invoiced' THEN v_fail := 'order not invoiced'; END IF;

  SELECT count(*) INTO v_count FROM public.clients WHERE id = v_client_id AND credit_limit = 50000;
  IF v_count <> 1 THEN v_fail := coalesce(v_fail || '; ', '') || 'public.clients missing credit columns'; END IF;
  SELECT count(*) INTO v_count FROM public.orders WHERE id = v_order_id AND hire_accepted_by = 'QA Bot';
  IF v_count <> 1 THEN v_fail := coalesce(v_fail || '; ', '') || 'public.orders missing hire_accepted_by'; END IF;
  SELECT count(*) INTO v_count FROM public.delivery_tasks WHERE order_id = v_order_id AND pod_signed_by = 'Site Foreman';
  IF v_count <> 1 THEN v_fail := coalesce(v_fail || '; ', '') || 'public.delivery_tasks missing pod columns'; END IF;
  SELECT count(*) INTO v_count FROM public.invoices WHERE id = v_invoice_id AND accounting_synced_at IS NOT NULL;
  IF v_count <> 1 THEN v_fail := coalesce(v_fail || '; ', '') || 'public.invoices missing accounting_synced_at'; END IF;

  RETURN jsonb_build_object(
    'ok', v_fail IS NULL,
    'error', v_fail,
    'order_number', v_order_no,
    'order_id', v_order_id,
    'steps', v_steps
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'steps', v_steps);
END;
$function$;

CREATE OR REPLACE FUNCTION public.qa_e2e_hire_lifecycle()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'rental', 'public'
AS $$ SELECT rental.qa_e2e_hire_lifecycle(); $$;
