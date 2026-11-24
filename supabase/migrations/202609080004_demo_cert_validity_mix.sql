-- Demo cert validity mix for Fleet console filters (expired / expiring / valid / missing).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY serial_number)::int AS rn
  FROM rental.equipment_assets
)
UPDATE rental.equipment_assets ea
SET
  certificate_type = CASE
    WHEN r.rn % 5 = 0 THEN 'NDT'
    WHEN r.rn % 4 = 0 THEN 'Proof Load'
    WHEN r.rn % 3 = 0 THEN 'Thorough Examination'
    ELSE 'LOLER'
  END,
  certificate_expires_at = CASE
    WHEN r.rn % 7 = 0 THEN (current_date - ((5 + (r.rn % 40))::int))
    WHEN r.rn % 5 = 0 THEN (current_date + ((3 + (r.rn % 25))::int))
    WHEN r.rn % 11 = 0 THEN NULL
    ELSE (current_date + ((45 + (r.rn % 200))::int))
  END,
  next_inspection_at = CASE
    WHEN r.rn % 11 = 0 THEN current_date + 14
    ELSE current_date + ((20 + (r.rn % 90))::int)
  END,
  updated_at = now()
FROM ranked r
WHERE ea.id = r.id;
