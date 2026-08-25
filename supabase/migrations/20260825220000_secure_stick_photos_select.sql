CREATE POLICY "Admins can read stick photos"
ON storage.objects
FOR SELECT
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