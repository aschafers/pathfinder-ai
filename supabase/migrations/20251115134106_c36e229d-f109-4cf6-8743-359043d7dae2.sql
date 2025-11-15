-- Make seismogram-images bucket public so images can be accessed by AI models
UPDATE storage.buckets 
SET public = true 
WHERE id = 'seismogram-images';