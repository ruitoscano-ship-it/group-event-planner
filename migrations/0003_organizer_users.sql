-- Organizer Google accounts + ownership for multi-event home.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  picture_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

ALTER TABLE gatherings ADD COLUMN owner_user_id TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_gatherings_owner ON gatherings (owner_user_id);
