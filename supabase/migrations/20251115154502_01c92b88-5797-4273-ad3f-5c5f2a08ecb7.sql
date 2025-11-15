-- Create project-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images to their project folder
CREATE POLICY "Users can upload project images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to project images
CREATE POLICY "Public can view project images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'project-images');