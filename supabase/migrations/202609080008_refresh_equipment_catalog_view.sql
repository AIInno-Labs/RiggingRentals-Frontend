-- Expose dimensions (and any newer columns) on the public catalog mirror.
CREATE OR REPLACE VIEW public.equipment_catalog AS
SELECT * FROM rental.equipment_catalog;
