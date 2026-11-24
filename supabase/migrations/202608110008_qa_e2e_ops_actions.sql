-- Ops actions smoke: maintenance Start/Complete + delivery ePOD (seed-style ids)
-- Run: select public.qa_e2e_ops_actions();

CREATE OR REPLACE FUNCTION rental.qa_e2e_ops_actions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'rental', 'public'
AS $function$
DECLARE
  v_asset_id uuid;
  v_wo_id uuid;
  v_order_id uuid;
  v_task_id uuid;
  v_status text;
  v_fail text := NULL;
  v_steps jsonb := '[]'::jsonb;
BEGIN
  -- Prefer a free asset; fall back to any non-retired
  SELECT id INTO v_asset_id
  FROM rental.equipment_assets
  WHERE status = 'available'
  ORDER BY serial_number
  LIMIT 1;

  IF v_asset_id IS NULL THEN
    SELECT id INTO v_asset_id
    FROM rental.equipment_assets
    WHERE status <> 'retired'
    ORDER BY serial_number
    LIMIT 1;
  END IF;

  IF v_asset_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No asset for ops E2E');
  END IF;

  INSERT INTO rental.maintenance_work_orders (
    asset_id, work_type, status, title, description,
    estimated_hours, parts_cost, labor_cost, due_at
  ) VALUES (
    v_asset_id, 'repair', 'open', 'E2E ops WO', 'Auto smoke',
    2, 10, 20, now() + interval '3 days'
  ) RETURNING id INTO v_wo_id;
  v_steps := v_steps || jsonb_build_array(jsonb_build_object('step','wo_open','ok',true,'id',v_wo_id));

  UPDATE rental.equipment_assets SET status = 'maintenance' WHERE id = v_asset_id;

  UPDATE rental.maintenance_work_orders
  SET status = 'in_progress'
  WHERE id = v_wo_id;
  SELECT status INTO v_status FROM rental.maintenance_work_orders WHERE id = v_wo_id;
  IF v_status <> 'in_progress' THEN
    v_fail := 'WO start failed';
  END IF;
  v_steps := v_steps || jsonb_build_array(jsonb_build_object('step','wo_start','ok',v_status = 'in_progress'));

  UPDATE rental.maintenance_work_orders
  SET status = 'completed', completed_at = now(), actual_hours = 2
  WHERE id = v_wo_id;
  UPDATE rental.equipment_assets
  SET status = 'available'
  WHERE id = v_asset_id AND status IN ('maintenance', 'in_inspection');
  SELECT status INTO v_status FROM rental.maintenance_work_orders WHERE id = v_wo_id;
  IF v_status <> 'completed' THEN
    v_fail := coalesce(v_fail || '; ', '') || 'WO complete failed';
  END IF;
  v_steps := v_steps || jsonb_build_array(jsonb_build_object('step','wo_complete','ok',v_status = 'completed'));

  -- Delivery ePOD on a throwaway order
  INSERT INTO rental.orders (
    order_number, client_id, status, start_at, end_at,
    jobsite_name, delivery_address, purchase_order
  )
  SELECT
    'RO-E2E-OPS-' || substr(gen_random_uuid()::text, 1, 8),
    c.id, 'confirmed', now() + interval '1 day', now() + interval '8 days',
    'Ops E2E', '2 Ops Rd', 'PO-OPS'
  FROM rental.clients c
  ORDER BY c.created_at NULLS LAST
  LIMIT 1
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    v_fail := coalesce(v_fail || '; ', '') || 'no client for delivery order';
  ELSE
    INSERT INTO rental.delivery_tasks (
      order_id, task_type, status, scheduled_at, address, driver_notes
    ) VALUES (
      v_order_id, 'delivery', 'scheduled', now() + interval '1 day', '2 Ops Rd', 'ops e2e'
    ) RETURNING id INTO v_task_id;

    UPDATE rental.delivery_tasks SET status = 'en_route' WHERE id = v_task_id;
    UPDATE rental.delivery_tasks SET
      status = 'completed',
      completed_at = now(),
      pod_signed_by = 'Ops QA Signer',
      pod_notes = 'Gate drop'
    WHERE id = v_task_id;

    SELECT status INTO v_status FROM rental.delivery_tasks WHERE id = v_task_id;
    IF v_status <> 'completed' THEN
      v_fail := coalesce(v_fail || '; ', '') || 'delivery complete failed';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.delivery_tasks
      WHERE id = v_task_id AND pod_signed_by = 'Ops QA Signer'
    ) THEN
      v_fail := coalesce(v_fail || '; ', '') || 'public.delivery_tasks pod missing';
    END IF;
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step','delivery_epod','ok',v_status = 'completed'));
  END IF;

  -- Seed-style id shape must round-trip (app Zod .guid accepts these)
  IF v_wo_id IS NULL OR length(v_wo_id::text) <> 36 THEN
    v_fail := coalesce(v_fail || '; ', '') || 'WO id shape bad';
  END IF;

  RETURN jsonb_build_object(
    'ok', v_fail IS NULL,
    'error', v_fail,
    'wo_id', v_wo_id,
    'task_id', v_task_id,
    'steps', v_steps
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'steps', v_steps);
END;
$function$;

CREATE OR REPLACE FUNCTION public.qa_e2e_ops_actions()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'rental', 'public'
AS $$ SELECT rental.qa_e2e_ops_actions(); $$;
