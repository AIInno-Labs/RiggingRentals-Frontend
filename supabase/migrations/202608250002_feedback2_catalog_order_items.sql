-- Feedback 2: catalog category + draft category-only order lines.
ALTER TABLE rental.equipment_catalog
  ADD COLUMN IF NOT EXISTS category text;

UPDATE rental.equipment_catalog
SET category = 'Uncategorised'
WHERE category IS NULL OR btrim(category) = '';

ALTER TABLE rental.equipment_catalog
  ALTER COLUMN category SET DEFAULT 'Uncategorised',
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE rental.order_items
  ALTER COLUMN catalog_id DROP NOT NULL;

ALTER TABLE rental.order_items
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rate_override boolean NOT NULL DEFAULT false;

UPDATE rental.order_items oi
SET category = COALESCE(c.category, '')
FROM rental.equipment_catalog c
WHERE oi.catalog_id = c.id
  AND (oi.category IS NULL OR oi.category = '');

CREATE OR REPLACE VIEW public.equipment_catalog AS SELECT * FROM rental.equipment_catalog;
CREATE OR REPLACE VIEW public.order_items AS SELECT * FROM rental.order_items;
