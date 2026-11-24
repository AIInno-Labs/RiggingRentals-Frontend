-- Unique cert numbers + certificate file columns + storage bucket.

ALTER TABLE rental.equipment_assets
  ADD COLUMN IF NOT EXISTS certificate_file_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS certificate_file_name text NOT NULL DEFAULT '';

-- One unique cert # per asset (demo cleanup of shared CERT-C3000000).
UPDATE rental.equipment_assets
SET
  certificate_number = 'CERT-' || replace(serial_number, ' ', '-'),
  updated_at = now()
WHERE certificate_number = 'CERT-C3000000'
   OR certificate_number IS NULL
   OR certificate_number = '';

-- Storage bucket for certificate PDFs/images (private).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rental-certificates',
  'rental-certificates',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "rental_certificates_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "rental_certificates_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "rental_certificates_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "rental_certificates_delete_auth" ON storage.objects;

CREATE POLICY "rental_certificates_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rental-certificates');

CREATE POLICY "rental_certificates_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rental-certificates');

CREATE POLICY "rental_certificates_update_auth"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'rental-certificates')
  WITH CHECK (bucket_id = 'rental-certificates');

CREATE POLICY "rental_certificates_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rental-certificates');
