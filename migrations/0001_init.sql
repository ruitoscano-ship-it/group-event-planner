-- Gatherings stored as JSON documents for flexible menu/attendee shapes.
CREATE TABLE IF NOT EXISTS gatherings (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gatherings_updated ON gatherings (updated_at DESC);
