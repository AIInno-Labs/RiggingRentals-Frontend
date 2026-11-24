-- Point overlapping demo orders at active catalog + confirm a few for next-14d pressure.
WITH active AS (
  SELECT id, sku, category, row_number() OVER (ORDER BY sku) AS rn
  FROM rental.equipment_catalog
  WHERE is_active
),
targets AS (
  SELECT oi.id AS item_id, o.id AS order_id, o.order_number,
         row_number() OVER (ORDER BY o.order_number, oi.id) AS rn
  FROM rental.order_items oi
  JOIN rental.orders o ON o.id = oi.order_id
  WHERE o.status IN ('draft','confirmed','pre_pick','dispatched','off_rent_pending')
    AND o.start_at <= now() + interval '14 days'
    AND coalesce(o.off_rent_at, o.end_at) >= now()
)
UPDATE rental.order_items oi
SET
  catalog_id = a.id,
  category = a.category,
  quantity = CASE
    WHEN t.rn IN (1, 2) THEN 5
    WHEN t.rn IN (3, 4) THEN 4
    ELSE greatest(oi.quantity, 2)
  END
FROM targets t
JOIN active a ON a.rn = ((t.rn - 1) % (SELECT count(*)::int FROM active)) + 1
WHERE oi.id = t.item_id;

UPDATE rental.orders
SET status = 'confirmed', updated_at = now()
WHERE order_number IN ('RO-209316', 'RO-209315', 'RO-209313', 'RO-209311')
  AND status = 'draft';

UPDATE rental.orders
SET
  start_at = date_trunc('day', now()) + interval '2 days',
  end_at = date_trunc('day', now()) + interval '10 days',
  updated_at = now()
WHERE order_number IN ('RO-209316', 'RO-209315', 'RO-209313', 'RO-209311', 'RO-209314');
