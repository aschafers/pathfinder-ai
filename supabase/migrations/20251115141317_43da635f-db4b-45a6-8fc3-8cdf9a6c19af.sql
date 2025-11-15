-- Add fields for external API polling
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS external_api_url text,
ADD COLUMN IF NOT EXISTS current_index integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS polling_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS polling_interval integer DEFAULT 5;