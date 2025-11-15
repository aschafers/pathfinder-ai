-- Create storage bucket for seismogram images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seismogram-images',
  'seismogram-images',
  false,
  10485760, -- 10MB max
  ARRAY['image/jpeg', 'image/png', 'image/tiff', 'image/jpg']
);

-- RLS policies for seismogram images bucket
CREATE POLICY "Users can upload their own seismogram images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'seismogram-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own seismogram images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'seismogram-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own seismogram images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'seismogram-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own seismogram images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'seismogram-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);