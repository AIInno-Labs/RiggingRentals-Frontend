-- Align fleet KPI totals with donut slices (exclude retired; split reserved).
CREATE OR REPLACE FUNCTION public.rental_dashboard_bundle()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'rental', 'public'
AS $function$
DECLARE
  result json;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF NOT rental.has_role(ARRAY['sales','workshop','finance']::rental.app_role[]) THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'kpis', json_build_object(
      'totalAssets', (SELECT count(*) FROM rental.equipment_assets WHERE status <> 'retired'),
      'available', (SELECT count(*) FROM rental.equipment_assets WHERE status = 'available'),
      'onHire', (SELECT count(*) FROM rental.equipment_assets WHERE status IN ('on_hire','reserved')),
      'inMaintenance', (SELECT count(*) FROM rental.equipment_assets WHERE status = 'maintenance'),
      'inInspection', (SELECT count(*) FROM rental.equipment_assets WHERE status = 'in_inspection'),
      'openOrders', (SELECT count(*) FROM rental.orders WHERE status IN ('confirmed','pre_pick','dispatched','off_rent_pending')),
      'offRentPending', (SELECT count(*) FROM rental.orders WHERE status = 'off_rent_pending'),
      'openWorkOrders', (SELECT count(*) FROM rental.maintenance_work_orders WHERE status IN ('open','in_progress','waiting_parts')),
      'scheduledDeliveries', (SELECT count(*) FROM rental.delivery_tasks WHERE status IN ('scheduled','en_route')),
      'draftInvoiceTotal', COALESCE((SELECT sum(total) FROM rental.invoices WHERE status = 'draft'), 0),
      'approvedInvoiceTotal', COALESCE((SELECT sum(total) FROM rental.invoices WHERE status = 'approved'), 0),
      'certsExpiringSoon', (SELECT count(*) FROM rental.equipment_assets WHERE certificate_expires_at IS NOT NULL AND certificate_expires_at <= (CURRENT_DATE + 30) AND status <> 'retired'),
      'certsExpired', (SELECT count(*) FROM rental.equipment_assets WHERE certificate_expires_at IS NOT NULL AND certificate_expires_at < CURRENT_DATE AND status <> 'retired')
    ),
    'fleetDonut', json_build_array(
      json_build_object('key', 'onHire', 'label', 'On hire', 'count', (SELECT count(*) FROM rental.equipment_assets WHERE status = 'on_hire')),
      json_build_object('key', 'reserved', 'label', 'Reserved', 'count', (SELECT count(*) FROM rental.equipment_assets WHERE status = 'reserved')),
      json_build_object('key', 'available', 'label', 'Available', 'count', (SELECT count(*) FROM rental.equipment_assets WHERE status = 'available')),
      json_build_object('key', 'inspection', 'label', 'Inspection', 'count', (SELECT count(*) FROM rental.equipment_assets WHERE status = 'in_inspection')),
      json_build_object('key', 'maintenance', 'label', 'Maintenance', 'count', (SELECT count(*) FROM rental.equipment_assets WHERE status = 'maintenance'))
    ),
    'pipelineDonut', json_build_array(
      json_build_object('key', 'pending', 'label', 'Quotes pending', 'count', (SELECT count(*) FROM rental.orders WHERE status = 'draft')),
      json_build_object('key', 'rented', 'label', 'On rent', 'count', (SELECT count(*) FROM rental.orders WHERE status IN ('dispatched','off_rent_pending'))),
      json_build_object('key', 'returned', 'label', 'Returned awaiting invoice', 'count', (SELECT count(*) FROM rental.orders WHERE status = 'returned')),
      json_build_object('key', 'invoiced', 'label', 'Invoiced', 'count', (SELECT count(*) FROM rental.orders WHERE status = 'invoiced'))
    ),
    'recentOrders', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT o.id, o.order_number, o.status, o.jobsite_name, c.company_name
        FROM rental.orders o
        JOIN rental.clients c ON c.id = o.client_id
        ORDER BY o.updated_at DESC
        LIMIT 8
      ) t
    ), '[]'::json),
    'alerts', COALESCE((
      SELECT json_agg(json_build_object(
        'severity', x.severity,
        'title', x.title,
        'detail', x.detail,
        'href', x.href
      ) ORDER BY x.rank DESC, x.seq)
      FROM (
        SELECT * FROM (
          SELECT 'critical'::text AS severity, 'Certificate expired'::text AS title,
            a.serial_number || ' · ' || COALESCE(NULLIF(a.certificate_number,''),'no cert #') || ' expired ' || to_char(a.certificate_expires_at, 'DD Mon YYYY') AS detail,
            '/admin/catalog'::text AS href, 110 AS rank, 0 AS seq
          FROM rental.equipment_assets a
          WHERE a.certificate_expires_at IS NOT NULL AND a.certificate_expires_at < CURRENT_DATE AND a.status <> 'retired'

          UNION ALL
          SELECT 'high', 'Certificate expiring soon',
            a.serial_number || ' · expires ' || to_char(a.certificate_expires_at, 'DD Mon YYYY'),
            '/admin/catalog', 85, 1
          FROM rental.equipment_assets a
          WHERE a.certificate_expires_at IS NOT NULL
            AND a.certificate_expires_at >= CURRENT_DATE
            AND a.certificate_expires_at <= CURRENT_DATE + 30
            AND a.status <> 'retired'

          UNION ALL
          SELECT 'critical', 'Off-rent awaiting pickup',
            o.order_number || ' · ' || c.company_name || ' · ' || COALESCE(NULLIF(o.jobsite_name,''),'jobsite'),
            '/workshop', 100, 2
          FROM rental.orders o
          JOIN rental.clients c ON c.id = o.client_id
          WHERE o.status = 'off_rent_pending'

          UNION ALL
          SELECT 'critical', 'Parts hold on work order',
            m.title || ' · due ' || COALESCE(to_char(m.due_at AT TIME ZONE 'UTC', 'Mon DD'), 'ASAP'),
            '/admin/maintenance', 95, 3
          FROM rental.maintenance_work_orders m
          WHERE m.status = 'waiting_parts'

          UNION ALL
          SELECT 'high', 'Asset down in maintenance',
            a.serial_number || ' · ' || cat.sku || ' ' || cat.name,
            '/admin/maintenance', 80, 4
          FROM rental.equipment_assets a
          JOIN rental.equipment_catalog cat ON cat.id = a.catalog_id
          WHERE a.status = 'maintenance'

          UNION ALL
          SELECT 'medium', 'Draft invoice needs approval',
            i.invoice_number || ' · $' || trim(to_char(i.total, '9999990.00')) || ' · ' || i.kind::text,
            '/billing', 55, 5
          FROM rental.invoices i
          WHERE i.status = 'draft'

          UNION ALL
          SELECT 'medium', 'Inspection bay backlog',
            a.serial_number || ' waiting turnaround',
            '/workshop', 60, 6
          FROM rental.equipment_assets a
          WHERE a.status = 'in_inspection'
        ) raw
        ORDER BY rank DESC, seq
        LIMIT 14
      ) x
    ), '[]'::json),
    'statusMix', COALESCE((
      SELECT json_agg(json_build_object('status', s.status, 'count', s.cnt))
      FROM (
        SELECT status::text AS status, count(*)::int AS cnt
        FROM rental.equipment_assets
        WHERE status <> 'retired'
        GROUP BY status
        ORDER BY count(*) DESC
      ) s
    ), '[]'::json),
    'pipelineMix', COALESCE((
      SELECT json_agg(json_build_object('status', s.status, 'count', s.cnt))
      FROM (
        SELECT status::text AS status, count(*)::int AS cnt
        FROM rental.orders
        WHERE status <> 'cancelled'
        GROUP BY status
        ORDER BY count(*) DESC
      ) s
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$function$;
