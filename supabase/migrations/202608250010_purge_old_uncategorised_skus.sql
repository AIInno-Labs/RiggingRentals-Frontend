-- Purge inactive Uncategorised plant SKUs: remap FKs + invoice text, then DELETE.

CREATE TABLE IF NOT EXISTS rental._purge_sku_map (
  old_sku text PRIMARY KEY,
  old_name text NOT NULL,
  new_sku text NOT NULL
);

TRUNCATE rental._purge_sku_map;

INSERT INTO rental._purge_sku_map (old_sku, old_name, new_sku) VALUES
  ('ART-60', '60ft Articulating Boom', 'CAGE-2P'),
  ('BACK-580', 'Backhoe Loader', 'JACK-TOUGH'),
  ('BOOM-80', '80ft Straight Boom Lift', 'GANTRY-PORT'),
  ('COMP-185', '185 CFM Air Compressor', 'STAND-STOOL'),
  ('COMP-375', '375 CFM Air Compressor', 'STAND-STOOL'),
  ('DIST-400', '400A Power Distribution Panel', 'LOFT-RIG'),
  ('EXC-320', '320 Excavator', 'JACK-TOUGH'),
  ('FAN-42', '42in Industrial Fan', 'STAND-STOOL'),
  ('FORK-5K', '5K Warehouse Forklift', 'SKATE-LOAD'),
  ('FORK-8K', '8K Telehandler', 'SKATE-AIR'),
  ('GEN-100', '100kW Diesel Generator', 'TEST-STEEL'),
  ('GEN-500', '500 kVA Diesel Generator', 'TEST-ELEV'),
  ('HOIST-2T', '2-Ton Electric Chain Hoist', 'HOIST-CHAIN-E'),
  ('LIGHT-4K', '4-Light Tower', 'STAND-STOOL'),
  ('LIGHT-8K', '8-Light Tower', 'LOFT-RIG'),
  ('PUMP-6IN', '6in Trash Pump', 'WATER-BAG'),
  ('ROLL-84', '84in Smooth Drum Roller', 'SKATE-LOAD'),
  ('SCI-19', '19ft Electric Scissor Lift', 'CAGE-1P'),
  ('SCI-32', '32ft Scissor Lift', 'CAGE-2P'),
  ('SKID-275', 'Skid Steer Loader', 'WINCH-AIR'),
  ('Test', 'Test', 'SLING-WEB'),
  ('Test3', 'Test3', 'SLING-ROUND'),
  ('TRENCH-6', '6ft Trencher', 'WINCH-TIRFOR'),
  ('VAC-EXC', 'Vacuum Excavator', 'JACK-TOE'),
  ('WELD-400', '400A Diesel Welder', 'BEAM-LIFT');

-- Catch any leftover inactive / Uncategorised SKUs not in the explicit map.
WITH leftovers AS (
  SELECT
    c.sku AS old_sku,
    c.name AS old_name,
    row_number() OVER (ORDER BY c.sku) AS rn
  FROM rental.equipment_catalog c
  WHERE (
      c.is_active = false
      OR c.category IS NULL
      OR btrim(c.category) = ''
      OR c.category ILIKE 'uncategor%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM rental._purge_sku_map m WHERE m.old_sku = c.sku
    )
),
active AS (
  SELECT sku, row_number() OVER (ORDER BY sku) AS rn,
         count(*) OVER ()::int AS n
  FROM rental.equipment_catalog
  WHERE is_active
)
INSERT INTO rental._purge_sku_map (old_sku, old_name, new_sku)
SELECT l.old_sku, l.old_name, a.sku
FROM leftovers l
JOIN active a ON a.rn = ((l.rn - 1) % a.n) + 1;

CREATE TABLE IF NOT EXISTS rental._purge_id_map (
  old_id uuid PRIMARY KEY,
  old_sku text NOT NULL,
  old_name text NOT NULL,
  new_id uuid NOT NULL,
  new_sku text NOT NULL,
  new_name text NOT NULL,
  new_category text NOT NULL
);

TRUNCATE rental._purge_id_map;

INSERT INTO rental._purge_id_map (
  old_id, old_sku, old_name, new_id, new_sku, new_name, new_category
)
SELECT
  oldc.id,
  oldc.sku,
  oldc.name,
  newc.id,
  newc.sku,
  newc.name,
  newc.category
FROM rental._purge_sku_map m
JOIN rental.equipment_catalog oldc ON oldc.sku = m.old_sku
JOIN rental.equipment_catalog newc
  ON newc.sku = m.new_sku AND newc.is_active;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM rental._purge_sku_map m
    WHERE NOT EXISTS (
      SELECT 1 FROM rental.equipment_catalog c
      WHERE c.sku = m.new_sku AND c.is_active
    )
  ) THEN
    RAISE EXCEPTION 'purge_old_skus: new_sku target missing or inactive';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rental.equipment_catalog c
    WHERE (
        c.is_active = false
        OR c.category IS NULL
        OR btrim(c.category) = ''
        OR c.category ILIKE 'uncategor%'
      )
      AND NOT EXISTS (
        SELECT 1 FROM rental._purge_id_map m WHERE m.old_id = c.id
      )
  ) THEN
    RAISE EXCEPTION 'purge_old_skus: purge candidate missing from id map';
  END IF;
END $$;

-- Remap order_items (keep rates/money).
UPDATE rental.order_items oi
SET
  catalog_id = m.new_id,
  category = m.new_category
FROM rental._purge_id_map m
WHERE oi.catalog_id = m.old_id;

UPDATE rental.order_items oi
SET category = c.category
FROM rental.equipment_catalog c
WHERE oi.catalog_id = c.id
  AND c.is_active
  AND (
    oi.category IS NULL
    OR btrim(oi.category) = ''
    OR oi.category ILIKE 'uncategor%'
  );

-- Remap assets + scrub old SKU prefixes from serials.
UPDATE rental.equipment_assets ea
SET
  catalog_id = m.new_id,
  serial_number = CASE
    WHEN ea.serial_number ILIKE m.old_sku || '-%'
      OR ea.serial_number ILIKE m.old_sku || '%'
    THEN m.new_sku || substr(ea.serial_number, length(m.old_sku) + 1)
    ELSE ea.serial_number
  END,
  updated_at = now()
FROM rental._purge_id_map m
WHERE ea.catalog_id = m.old_id;

-- Rewrite invoice line descriptions (money unchanged).
UPDATE rental.invoice_lines il
SET description = replace(
  replace(il.description, m.old_sku || ' ' || m.old_name, m.new_sku || ' ' || m.new_name),
  m.old_sku,
  m.new_sku
)
FROM rental._purge_id_map m
WHERE il.description ILIKE '%' || m.old_sku || '%'
   OR il.description ILIKE '%' || m.old_name || '%';

UPDATE rental.invoice_lines il
SET description = replace(il.description, m.old_name, m.new_name)
FROM rental._purge_id_map m
WHERE position(m.old_name IN il.description) > 0;

DO $$
DECLARE
  oi_left int;
  ea_left int;
BEGIN
  SELECT count(*) INTO oi_left
  FROM rental.order_items oi
  JOIN rental.equipment_catalog c ON c.id = oi.catalog_id
  WHERE c.is_active = false
     OR c.category IS NULL
     OR btrim(c.category) = ''
     OR c.category ILIKE 'uncategor%';

  SELECT count(*) INTO ea_left
  FROM rental.equipment_assets ea
  JOIN rental.equipment_catalog c ON c.id = ea.catalog_id
  WHERE c.is_active = false
     OR c.category IS NULL
     OR btrim(c.category) = ''
     OR c.category ILIKE 'uncategor%';

  IF oi_left > 0 OR ea_left > 0 THEN
    RAISE EXCEPTION
      'purge_old_skus: still have % order_items and % assets on old catalog',
      oi_left, ea_left;
  END IF;
END $$;

DELETE FROM rental.equipment_catalog c
WHERE c.is_active = false
   OR c.category IS NULL
   OR btrim(c.category) = ''
   OR c.category ILIKE 'uncategor%';

DROP TABLE IF EXISTS rental._purge_id_map;
DROP TABLE IF EXISTS rental._purge_sku_map;

CREATE OR REPLACE VIEW public.equipment_catalog AS
  SELECT * FROM rental.equipment_catalog;
