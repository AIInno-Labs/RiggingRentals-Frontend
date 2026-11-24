-- Demo top-up: ensure open pre_pick jobs can be packed without changing catalog pricing.
-- Idempotent: only inserts missing serials; only backfills short pre_pick assignments.

-- 1) Extend BEAM-MOD-B3 if it still expires on the old demo cliff date.
UPDATE rental.equipment_assets
SET
  certificate_expires_at = current_date + 120,
  next_inspection_at = coalesce(next_inspection_at, current_date + 90),
  updated_at = now()
WHERE serial_number = 'BEAM-MOD-B3'
  AND certificate_expires_at IS NOT NULL
  AND certificate_expires_at <= date '2026-09-16';

-- 2) Top up available units for BEAM-MOD (target 5 available) and HOIST-CHAIN-E (target 3 available).
WITH targets AS (
  SELECT * FROM (VALUES
    -- Enough for open pre_pick qty plus a spare after reservation backfill.
    ('BEAM-MOD', 5, 'BEAM-MOD-D'),
    ('HOIST-CHAIN-E', 3, 'HOIST-CHAIN-E-B')
  ) AS t(sku, target_available, serial_prefix)
),
catalog AS (
  SELECT c.id AS catalog_id, t.sku, t.target_available, t.serial_prefix
  FROM targets t
  JOIN rental.equipment_catalog c ON c.sku = t.sku
),
avail AS (
  SELECT
    cat.catalog_id,
    cat.sku,
    cat.target_available,
    cat.serial_prefix,
    count(*) FILTER (WHERE ea.status = 'available')::int AS available_now
  FROM catalog cat
  LEFT JOIN rental.equipment_assets ea ON ea.catalog_id = cat.catalog_id
  GROUP BY cat.catalog_id, cat.sku, cat.target_available, cat.serial_prefix
),
need AS (
  SELECT
    catalog_id,
    sku,
    serial_prefix,
    greatest(target_available - available_now, 0) AS to_add
  FROM avail
),
to_insert AS (
  SELECT
    n.catalog_id,
    n.serial_prefix || gs::text AS serial_number,
    gs
  FROM need n
  CROSS JOIN LATERAL generate_series(1, n.to_add) AS gs
)
INSERT INTO rental.equipment_assets (
  catalog_id,
  serial_number,
  meter_hours,
  status,
  notes,
  certificate_number,
  certificate_type,
  certificate_expires_at,
  next_inspection_at
)
SELECT
  ti.catalog_id,
  ti.serial_number,
  (50 + ti.gs * 10)::numeric,
  'available',
  'Demo fleet top-up for open jobs',
  'CERT-' || replace(ti.serial_number, ' ', '-'),
  'LOLER',
  current_date + 180,
  current_date + 90
FROM to_insert ti
WHERE NOT EXISTS (
  SELECT 1
  FROM rental.equipment_assets x
  WHERE x.serial_number = ti.serial_number
);

-- 3) Backfill missing pre_pick assignments (assigned count < line quantity).
DO $$
DECLARE
  rec record;
  need_n int;
  asset_rec record;
  filled int;
BEGIN
  FOR rec IN
    SELECT
      oi.id AS order_item_id,
      oi.catalog_id,
      oi.quantity,
      coalesce(
        (
          SELECT count(*)::int
          FROM rental.order_asset_assignments a
          WHERE a.order_item_id = oi.id
        ),
        0
      ) AS assigned
    FROM rental.orders o
    JOIN rental.order_items oi ON oi.order_id = o.id
    WHERE o.status = 'pre_pick'
      AND oi.catalog_id IS NOT NULL
  LOOP
    need_n := greatest(rec.quantity - rec.assigned, 0);
    filled := 0;
    WHILE filled < need_n LOOP
      SELECT ea.id, ea.meter_hours
      INTO asset_rec
      FROM rental.equipment_assets ea
      WHERE ea.catalog_id = rec.catalog_id
        AND ea.status = 'available'
        AND (ea.certificate_expires_at IS NULL OR ea.certificate_expires_at >= current_date)
        AND NOT EXISTS (
          SELECT 1
          FROM rental.order_asset_assignments a
          WHERE a.asset_id = ea.id
        )
      ORDER BY ea.serial_number
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

      EXIT WHEN asset_rec.id IS NULL;

      INSERT INTO rental.order_asset_assignments (
        order_item_id,
        asset_id,
        dispatch_meter,
        reserved_at
      )
      VALUES (
        rec.order_item_id,
        asset_rec.id,
        coalesce(asset_rec.meter_hours, 0),
        now()
      );

      UPDATE rental.equipment_assets
      SET status = 'reserved', updated_at = now()
      WHERE id = asset_rec.id
        AND status = 'available';

      filled := filled + 1;
    END LOOP;
  END LOOP;
END $$;
