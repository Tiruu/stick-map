-- Secure stick photo storage configuration

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'stick-photos',
  'stick-photos',
  true,
  5242880,
  ARRAY['image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can upload stick photos"
ON storage.objects;

CREATE POLICY "Authenticated users can upload stick photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'stick-photos'
  AND name LIKE 'sticks/%'
);

DROP POLICY IF EXISTS "Admins can delete stick photos"
ON storage.objects;

CREATE POLICY "Admins can delete stick photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'stick-photos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);