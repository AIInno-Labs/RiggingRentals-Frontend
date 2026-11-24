-- Denser Ops Insights demo: spread approved invoice weeks + age open WOs across buckets.

-- Stagger approved invoices across the last 12 weeks (Mon-aligned offsets).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY COALESCE(approved_at, created_at) DESC) AS rn
  FROM rental.invoices
  WHERE status = 'approved'
  LIMIT 12
)
UPDATE rental.invoices i
SET approved_at = (
  date_trunc('week', now()) - ((r.rn - 1) * interval '1 week') + interval '2 days'
)
FROM ranked r
WHERE i.id = r.id;

-- Age open work orders into 0–3 / 4–7 / 8–14 / 15d+ buckets (~even spread).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at ASC) AS rn,
    count(*) OVER () AS total
  FROM rental.maintenance_work_orders
  WHERE status IN ('open', 'in_progress', 'waiting_parts')
)
UPDATE rental.maintenance_work_orders m
SET created_at = CASE
  WHEN r.rn <= greatest(1, (r.total * 6) / 19) THEN now() - interval '1 day'
  WHEN r.rn <= greatest(2, (r.total * 11) / 19) THEN now() - interval '5 days'
  WHEN r.rn <= greatest(3, (r.total * 15) / 19) THEN now() - interval '10 days'
  ELSE now() - interval '20 days'
END,
updated_at = now()
FROM ranked r
WHERE m.id = r.id;
