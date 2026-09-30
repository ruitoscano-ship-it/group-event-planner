CREATE TABLE IF NOT EXISTS ocr_events (
  id TEXT PRIMARY KEY NOT NULL,
  gathering_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT NOT NULL DEFAULT '',
  menu_card_kind TEXT NOT NULL DEFAULT '',
  line_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  client_locale TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_ocr_events_created
  ON ocr_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ocr_events_status_created
  ON ocr_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ocr_events_gathering
  ON ocr_events (gathering_id, created_at DESC);
