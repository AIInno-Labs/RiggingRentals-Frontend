-- Refresh public mirror so PostgREST exposes certificate_file_* columns.
CREATE OR REPLACE VIEW public.equipment_assets AS
SELECT * FROM rental.equipment_assets;
