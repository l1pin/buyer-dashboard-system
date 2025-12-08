-- Migration: Create creative_edits table for storing edit history
-- Run this in Supabase SQL Editor

-- Create creative_edits table
CREATE TABLE IF NOT EXISTS creative_edits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creative_id UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  editor_name VARCHAR(255),
  work_types TEXT[] DEFAULT '{}',
  links TEXT[] DEFAULT '{}',
  link_titles TEXT[] DEFAULT '{}',
  comment TEXT,
  cof_rating DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_creative_edits_creative_id ON creative_edits(creative_id);
CREATE INDEX IF NOT EXISTS idx_creative_edits_user_id ON creative_edits(user_id);
CREATE INDEX IF NOT EXISTS idx_creative_edits_created_at ON creative_edits(created_at);

-- Add has_edits flag to creatives table
ALTER TABLE creatives
ADD COLUMN IF NOT EXISTS has_edits BOOLEAN DEFAULT FALSE;

-- Add link_metadata to store info about when each link was added (JSON array)
ALTER TABLE creatives
ADD COLUMN IF NOT EXISTS link_metadata JSONB DEFAULT '[]';

-- Comments
COMMENT ON TABLE creative_edits IS 'Stores edit history for creatives';
COMMENT ON COLUMN creative_edits.creative_id IS 'Reference to parent creative';
COMMENT ON COLUMN creative_edits.work_types IS 'Additional work types added in this edit';
COMMENT ON COLUMN creative_edits.links IS 'New links added in this edit';
COMMENT ON COLUMN creative_edits.link_titles IS 'Titles of new links added';
COMMENT ON COLUMN creative_edits.cof_rating IS 'COF calculated only from additional work types';
COMMENT ON COLUMN creatives.has_edits IS 'True if creative has edits';
COMMENT ON COLUMN creatives.link_metadata IS 'JSON with metadata for each link (date added, edit_id)';

-- Enable RLS
ALTER TABLE creative_edits ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for authenticated users)
CREATE POLICY "Allow all for authenticated users" ON creative_edits
  FOR ALL USING (true) WITH CHECK (true);
