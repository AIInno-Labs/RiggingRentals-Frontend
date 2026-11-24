-- Spread OPS chart demo invoices evenly across the last 6 Mon-aligned weeks
-- so the billed-revenue bar chart always has 6 visible bars.
WITH ops AS (
  SELECT id, row_number() OVER (ORDER BY invoice_number) - 1 AS rn
  FROM rental.invoices
  WHERE invoice_number LIKE 'INV-OPS-CHART-%'
),
weeks AS (
  SELECT
    n,
    date_trunc('week', now()) - ((5 - n) * interval '1 week') + interval '2 days' AS approved_at
  FROM generate_series(0, 5) AS n
)
UPDATE rental.invoices i
SET
  approved_at = w.approved_at,
  updated_at = now()
FROM ops o
JOIN weeks w ON w.n = o.rn
WHERE i.id = o.id;
