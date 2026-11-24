-- Scrub leftover plant serial prefixes now that assets sit on active catalog SKUs.
WITH prefixes(prefix) AS (
  VALUES
    ('ART-60'), ('BACK-580'), ('BOOM-80'), ('COMP-185'), ('COMP-375'),
    ('DIST-400'), ('EXC-320'), ('FAN-42'), ('FORK-5K'), ('FORK-8K'),
    ('GEN-100'), ('GEN-500'), ('HOIST-2T'), ('LIGHT-4K'), ('LIGHT-8K'),
    ('PUMP-6IN'), ('ROLL-84'), ('SCI-19'), ('SCI-32'), ('SKID-275'),
    ('TRENCH-6'), ('VAC-EXC'), ('WELD-400')
),
matched AS (
  SELECT
    ea.id,
    ea.serial_number AS old_serial,
    c.sku || substr(ea.serial_number, length(p.prefix) + 1) AS new_serial,
    row_number() OVER (
      PARTITION BY ea.id
      ORDER BY length(p.prefix) DESC
    ) AS pref_rank
  FROM rental.equipment_assets ea
  JOIN rental.equipment_catalog c ON c.id = ea.catalog_id
  JOIN prefixes p ON ea.serial_number ILIKE p.prefix || '-%'
),
planned AS (
  SELECT
    id,
    old_serial,
    new_serial,
    row_number() OVER (PARTITION BY new_serial ORDER BY id) AS dup_rank
  FROM matched
  WHERE pref_rank = 1
)
UPDATE rental.equipment_assets ea
SET
  serial_number = CASE
    WHEN p.dup_rank = 1
      AND NOT EXISTS (
        SELECT 1
        FROM rental.equipment_assets x
        WHERE x.serial_number = p.new_serial
          AND x.id <> p.id
      )
    THEN p.new_serial
    ELSE p.new_serial || '-' || substr(replace(p.id::text, '-', ''), 1, 4)
  END,
  updated_at = now()
FROM planned p
WHERE ea.id = p.id
  AND ea.serial_number = p.old_serial;
