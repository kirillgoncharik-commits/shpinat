-- 0001 was applied when provisioning the empty production database.
-- SQLite ALTER is run exactly once by the migration tracker.
ALTER TABLE leads ADD COLUMN notification_attempted_at TEXT;
