-- Align criticalBlockers pulse KPI with /admin/catalog?cert=expired (expired certs only).
-- Parts hold / off-rent remain in Needs-you alerts, not this tile.

CREATE OR REPLACE FUNCTION public.rental_ops_analytics()
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
    'pulse', json_build_object(
      'criticalBlockers', (
        SELECT count(*) FROM rental.equipment_assets a
        WHERE a.certificate_expires_at IS NOT NULL
          AND a.certificate_expires_at < CURRENT_DATE
          AND a.status <> 'retired'
      ),
      'shopStuck7d', (
        SELECT count(*) FROM rental.maintenance_work_orders m
        WHERE m.status IN ('open','in_progress','waiting_parts')
          AND m.created_at <= (now() - interval '7 days')
      ),
      'arAtRisk', (
        SELECT count(*) FROM rental.invoices i
        WHERE i.status = 'approved'
          AND i.paid_at IS NULL
          AND i.payment_due_at IS NOT NULL
          AND i.payment_due_at < CURRENT_DATE
      ),
      'draftInvoices', (
        SELECT count(*) FROM rental.invoices WHERE status = 'draft'
      ),
      'fleetOnHire', (
        SELECT count(*) FROM rental.equipment_assets WHERE status IN ('on_hire','reserved')
      ),
      'utilizationPct', (
        SELECT CASE WHEN total = 0 THEN 0
          ELSE round(((on_hire + insp)::numeric / total) * 1000) / 10 END
        FROM (
          SELECT
            (SELECT count(*) FROM rental.equipment_assets WHERE status <> 'retired') AS total,
            (SELECT count(*) FROM rental.equipment_assets WHERE status IN ('on_hire','reserved')) AS on_hire,
            (SELECT count(*) FROM rental.equipment_assets WHERE status = 'in_inspection') AS insp
        ) u
      ),
      'pipelineOpen', (
        SELECT count(*) FROM rental.orders
        WHERE status IN ('draft','returned')
      ),
      'available', (SELECT count(*) FROM rental.equipment_assets WHERE status = 'available'),
      'totalAssets', (SELECT count(*) FROM rental.equipment_assets WHERE status <> 'retired')
    ),

    'revenueByWeek', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.week_start)
      FROM (
        SELECT
          to_char(date_trunc('week', COALESCE(i.approved_at, i.created_at)), 'DD Mon') AS label,
          date_trunc('week', COALESCE(i.approved_at, i.created_at))::date AS week_start,
          round(sum(i.total)::numeric, 2) AS total
        FROM rental.invoices i
        WHERE i.status = 'approved'
          AND COALESCE(i.approved_at, i.created_at) >= (now() - interval '84 days')
        GROUP BY 1, 2
        ORDER BY 2
      ) t
    ), '[]'::json),

    'invoiceStatus', COALESCE((
      SELECT json_agg(json_build_object('name', s.label, 'value', s.cnt))
      FROM (
        SELECT 'Draft' AS label, count(*)::int AS cnt FROM rental.invoices WHERE status = 'draft'
        UNION ALL
        SELECT 'Approved unpaid', count(*)::int FROM rental.invoices
          WHERE status = 'approved' AND paid_at IS NULL
        UNION ALL
        SELECT 'Paid', count(*)::int FROM rental.invoices
          WHERE status = 'approved' AND paid_at IS NOT NULL
        UNION ALL
        SELECT 'Void', count(*)::int FROM rental.invoices WHERE status = 'void'
      ) s
      WHERE s.cnt > 0
    ), '[]'::json),

    'pipelineBars', COALESCE((
      SELECT json_agg(json_build_object('name', p.label, 'count', p.cnt) ORDER BY p.ord)
      FROM (
        SELECT 1 AS ord, 'Quotes' AS label, count(*)::int AS cnt FROM rental.orders WHERE status = 'draft'
        UNION ALL
        SELECT 2, 'On rent', count(*)::int FROM rental.orders WHERE status IN ('dispatched','off_rent_pending')
        UNION ALL
        SELECT 3, 'Returned', count(*)::int FROM rental.orders WHERE status = 'returned'
        UNION ALL
        SELECT 4, 'Invoiced', count(*)::int FROM rental.orders WHERE status = 'invoiced'
      ) p
    ), '[]'::json),

    'topClients', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          c.id,
          c.company_name AS name,
          count(DISTINCT o.id)::int AS orders,
          round(COALESCE(sum(i.total), 0)::numeric, 2) AS billed
        FROM rental.clients c
        JOIN rental.orders o ON o.client_id = c.id
        JOIN rental.invoices i ON i.order_id = o.id
          AND i.status = 'approved'
          AND COALESCE(i.approved_at, i.created_at) >= (now() - interval '90 days')
        GROUP BY c.id, c.company_name
        ORDER BY billed DESC
        LIMIT 8
      ) t
    ), '[]'::json),

    'topEquipment', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          cat.id,
          cat.sku,
          cat.name,
          count(DISTINCT a.id)::int AS hire_events,
          COALESCE(sum(
            GREATEST(
              1,
              (COALESCE(a.returned_at::date, CURRENT_DATE) - COALESCE(a.dispatched_at::date, a.created_at::date))
            )
          ), 0)::int AS hire_days,
          round(COALESCE(sum(
            CASE WHEN il.kind = 'rental' THEN il.line_total ELSE 0 END
          ), 0)::numeric, 2) AS revenue
        FROM rental.equipment_catalog cat
        LEFT JOIN rental.order_items oi ON oi.catalog_id = cat.id
        LEFT JOIN rental.order_asset_assignments a ON a.order_item_id = oi.id
          AND a.dispatched_at IS NOT NULL
          AND a.dispatched_at >= (now() - interval '90 days')
        LEFT JOIN rental.invoices inv ON inv.order_id = oi.order_id AND inv.status = 'approved'
        LEFT JOIN rental.invoice_lines il ON il.invoice_id = inv.id
          AND il.description ILIKE '%' || cat.sku || '%'
        WHERE cat.is_active
        GROUP BY cat.id, cat.sku, cat.name
        HAVING count(DISTINCT a.id) > 0
        ORDER BY hire_days DESC NULLS LAST, hire_events DESC
        LIMIT 8
      ) t
    ), '[]'::json),

    'revenueByCategory', COALESCE((
      SELECT json_agg(json_build_object('name', t.name, 'size', t.size))
      FROM (
        SELECT
          cat.name,
          round(COALESCE(sum(il.line_total), 0)::numeric, 2) AS size
        FROM rental.equipment_catalog cat
        JOIN rental.order_items oi ON oi.catalog_id = cat.id
        JOIN rental.invoices inv ON inv.order_id = oi.order_id AND inv.status = 'approved'
        JOIN rental.invoice_lines il ON il.invoice_id = inv.id AND il.kind = 'rental'
        WHERE COALESCE(inv.approved_at, inv.created_at) >= (now() - interval '90 days')
        GROUP BY cat.id, cat.name
        HAVING sum(il.line_total) > 0
        ORDER BY size DESC
        LIMIT 12
      ) t
    ), '[]'::json),

    'demandScatter', COALESCE((
      SELECT json_agg(json_build_object(
        'name', x.name,
        'x', x.hire_days,
        'y', x.down_days,
        'z', x.assets
      ))
      FROM (
        SELECT *
        FROM (
          SELECT
            cat.name,
            COALESCE((
              SELECT sum(
                GREATEST(1, (COALESCE(a.returned_at::date, CURRENT_DATE) - COALESCE(a.dispatched_at::date, a.created_at::date)))
              )::int
              FROM rental.order_items oi
              JOIN rental.order_asset_assignments a ON a.order_item_id = oi.id
              WHERE oi.catalog_id = cat.id
                AND a.dispatched_at IS NOT NULL
                AND a.dispatched_at >= (now() - interval '90 days')
            ), 0) AS hire_days,
            COALESCE((
              SELECT sum(
                GREATEST(1, (CURRENT_DATE - m.created_at::date))
              )::int
              FROM rental.equipment_assets ea
              JOIN rental.maintenance_work_orders m ON m.asset_id = ea.id
              WHERE ea.catalog_id = cat.id
                AND m.status IN ('open','in_progress','waiting_parts')
            ), 0) AS down_days,
            (SELECT count(*)::int FROM rental.equipment_assets ea
              WHERE ea.catalog_id = cat.id AND ea.status <> 'retired') AS assets
          FROM rental.equipment_catalog cat
          WHERE cat.is_active
        ) t
        WHERE t.hire_days > 0 OR t.down_days > 0
        ORDER BY t.hire_days DESC
        LIMIT 24
      ) x
    ), '[]'::json),

    'shopAgingBuckets', json_build_object(
      'd0_3', (SELECT count(*) FROM rental.maintenance_work_orders m
        WHERE m.status IN ('open','in_progress','waiting_parts')
          AND m.created_at > (now() - interval '4 days')),
      'd4_7', (SELECT count(*) FROM rental.maintenance_work_orders m
        WHERE m.status IN ('open','in_progress','waiting_parts')
          AND m.created_at <= (now() - interval '4 days')
          AND m.created_at > (now() - interval '8 days')),
      'd8_14', (SELECT count(*) FROM rental.maintenance_work_orders m
        WHERE m.status IN ('open','in_progress','waiting_parts')
          AND m.created_at <= (now() - interval '8 days')
          AND m.created_at > (now() - interval '15 days')),
      'd15', (SELECT count(*) FROM rental.maintenance_work_orders m
        WHERE m.status IN ('open','in_progress','waiting_parts')
          AND m.created_at <= (now() - interval '15 days'))
    ),

    'shopOpenedByWeek', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.week_start)
      FROM (
        SELECT
          to_char(date_trunc('week', m.created_at), 'DD Mon') AS label,
          date_trunc('week', m.created_at)::date AS week_start,
          count(*)::int AS total
        FROM rental.maintenance_work_orders m
        WHERE m.status IN ('open','in_progress','waiting_parts')
        GROUP BY 1, 2
        ORDER BY 2
      ) t
    ), '[]'::json),

    'shopAgingRows', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          m.id,
          ea.serial_number,
          COALESCE(cat.sku, '-') AS sku,
          m.status,
          m.title,
          GREATEST(0, (CURRENT_DATE - m.created_at::date))::int AS days_open,
          '/workshop/repairs'::text AS href
        FROM rental.maintenance_work_orders m
        JOIN rental.equipment_assets ea ON ea.id = m.asset_id
        LEFT JOIN rental.equipment_catalog cat ON cat.id = ea.catalog_id
        WHERE m.status IN ('open','in_progress','waiting_parts')
        ORDER BY m.created_at ASC
        LIMIT 5
      ) t
    ), '[]'::json)

  ) INTO result;

  RETURN result;
END;
$function$;
