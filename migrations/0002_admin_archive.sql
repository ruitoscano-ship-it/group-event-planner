-- Soft-archive support for admin maintenance.
ALTER TABLE gatherings ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_gatherings_archived ON gatherings (archived_at);
CREATE INDEX IF NOT EXISTS idx_gatherings_created ON gatherings (created_at DESC);
