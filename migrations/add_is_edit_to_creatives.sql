-- Migration: Add is_edit column to creatives table
-- Run this in Supabase SQL Editor

-- Add is_edit column with default FALSE
ALTER TABLE creatives
ADD COLUMN IF NOT EXISTS is_edit BOOLEAN DEFAULT FALSE;

-- Add parent_creative_id to link edits to original creative
ALTER TABLE creatives
ADD COLUMN IF NOT EXISTS parent_creative_id UUID REFERENCES creatives(id);

-- Add link_type column for edit creatives ('new' or 'reupload')
ALTER TABLE creatives
ADD COLUMN IF NOT EXISTS link_type VARCHAR(20) DEFAULT NULL;

-- Update existing records to have is_edit = FALSE (safety measure)
UPDATE creatives SET is_edit = FALSE WHERE is_edit IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN creatives.is_edit IS 'Indicates if this creative is an edit/revision of another creative';
COMMENT ON COLUMN creatives.parent_creative_id IS 'References the parent creative this is an edit of';
COMMENT ON COLUMN creatives.link_type IS 'Type of links for edit creatives: new (новые ссылки) or reupload (перезалил по старым)';

-- Create index for faster queries on is_edit
CREATE INDEX IF NOT EXISTS idx_creatives_is_edit ON creatives(is_edit);
CREATE INDEX IF NOT EXISTS idx_creatives_parent_creative_id ON creatives(parent_creative_id);
