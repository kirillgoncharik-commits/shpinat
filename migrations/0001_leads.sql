CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('application', 'contact')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact TEXT NOT NULL,
  topic TEXT NOT NULL,
  source TEXT NOT NULL,
  landing TEXT NOT NULL,
  page TEXT NOT NULL,
  cta_location TEXT NOT NULL,
  data_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  outcome TEXT NOT NULL DEFAULT '',
  notification_status TEXT NOT NULL DEFAULT 'pending',
  notification_sent_at TEXT,
  consent_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS leads_status ON leads(status);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);
