-- Ops charts: attach fleet to reseeded catalog, fill demand scatter + shop aging weeks.

-- 1) Remap non-retired assets from deactivated demo SKUs onto active rigging catalog.
WITH inactive_assets AS (
  SELECT ea.id, row_number() OVER (ORDER BY ea.serial_number, ea.id) AS rn
  FROM rental.equipment_assets ea
  JOIN rental.equipment_catalog c ON c.id = ea.catalog_id
  WHERE c.is_active = false
    AND ea.status <> 'retired'
),
active_cats AS (
  SELECT id, row_number() OVER (ORDER BY sku) AS rn,
         count(*) OVER ()::int AS n
  FROM rental.equipment_catalog
  WHERE is_active
)
UPDATE rental.equipment_assets ea
SET
  catalog_id = ac.id,
  updated_at = now()
FROM inactive_assets ia
JOIN active_cats ac
  ON ac.rn = ((ia.rn - 1) % ac.n) + 1
WHERE ea.id = ia.id;

-- 2) Align hire line catalog_id with the remapped asset so demandScatter hire_days populate.
UPDATE rental.order_items oi
SET catalog_id = ea.catalog_id
FROM rental.order_asset_assignments a
JOIN rental.equipment_assets ea ON ea.id = a.asset_id
JOIN rental.equipment_catalog c ON c.id = ea.catalog_id AND c.is_active
WHERE a.order_item_id = oi.id
  AND a.dispatched_at IS NOT NULL;

-- Keep recent dispatches inside the 90-day analytics window.
UPDATE rental.order_asset_assignments a
SET
  dispatched_at = least(
    coalesce(a.dispatched_at, now() - interval '14 days'),
    now() - interval '7 days'
  ),
  returned_at = CASE
    WHEN a.returned_at IS NULL THEN now() - interval '2 days'
    ELSE greatest(a.returned_at, coalesce(a.dispatched_at, now()) + interval '3 days')
  END
WHERE a.dispatched_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM rental.order_items oi
    JOIN rental.equipment_catalog c ON c.id = oi.catalog_id
    WHERE oi.id = a.order_item_id AND c.is_active
  );

-- 3) Spread open work orders evenly across the last 4 Mon-aligned weeks.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at ASC, id) - 1 AS rn
  FROM rental.maintenance_work_orders
  WHERE status IN ('open', 'in_progress', 'waiting_parts')
)
UPDATE rental.maintenance_work_orders m
SET
  created_at =
    date_trunc('week', now())
    - (((3 - (r.rn % 4) + 4) % 4) * interval '1 week')
    + interval '2 days'
    + ((r.rn / 4) * interval '3 hours'),
  updated_at = now()
FROM ranked r
WHERE m.id = r.id;
