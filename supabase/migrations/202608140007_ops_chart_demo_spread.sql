-- Spread billed revenue across more weeks + re-age open WOs for Ops Insights lists.

-- Insert up to 6 modest approved demo invoices on orders that lack invoices (idempotent).
WITH targets AS (
  SELECT o.id AS order_id, row_number() OVER (ORDER BY o.updated_at DESC) AS rn
  FROM rental.orders o
  WHERE o.status IN ('returned', 'invoiced')
    AND NOT EXISTS (SELECT 1 FROM rental.invoices i WHERE i.order_id = o.id)
  LIMIT 6
),
seed AS (
  SELECT *
  FROM (
    VALUES
      (1, 'INV-OPS-CHART-01', 800.00::numeric, 80.00::numeric, 880.00::numeric),
      (2, 'INV-OPS-CHART-02', 1200.00, 120.00, 1320.00),
      (3, 'INV-OPS-CHART-03', 950.00, 95.00, 1045.00),
      (4, 'INV-OPS-CHART-04', 1800.00, 180.00, 1980.00),
      (5, 'INV-OPS-CHART-05', 2200.00, 220.00, 2420.00),
      (6, 'INV-OPS-CHART-06', 1500.00, 150.00, 1650.00)
  ) AS v(rn, invoice_number, subtotal, gst_amount, total)
)
INSERT INTO rental.invoices (
  order_id,
  invoice_number,
  status,
  kind,
  subtotal,
  discount_amount,
  deposit_applied,
  gst_rate,
  gst_amount,
  total,
  notes,
  approved_at,
  created_at,
  updated_at
)
SELECT
  t.order_id,
  s.invoice_number,
  'approved',
  'final',
  s.subtotal,
  0,
  0,
  0.10,
  s.gst_amount,
  s.total,
  'Ops chart demo seed',
  date_trunc('week', now()) - ((s.rn - 1) * interval '1 week') + interval '3 days',
  now(),
  now()
FROM targets t
JOIN seed s ON s.rn = t.rn
WHERE NOT EXISTS (
  SELECT 1 FROM rental.invoices x WHERE x.invoice_number = s.invoice_number
);

-- Restagger approved invoices across the last 12 weeks (Mon-aligned).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY COALESCE(approved_at, created_at) DESC) AS rn
  FROM rental.invoices
  WHERE status = 'approved'
)
UPDATE rental.invoices i
SET approved_at = (
  date_trunc('week', now())
  - (((r.rn - 1) % 12) * interval '1 week')
  + interval '2 days'
),
updated_at = now()
FROM ranked r
WHERE i.id = r.id;

-- Age open work orders into 0–3 / 4–7 / 8–14 / 15d+ (~6 / 5 / 4 / 4 of 19).
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
