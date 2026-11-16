BEGIN;
ALTER TABLE staff_sessions ADD COLUMN last_activity_at timestamptz(3);
UPDATE staff_sessions SET last_activity_at = created_at, revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP);
ALTER TABLE staff_sessions ALTER COLUMN last_activity_at SET NOT NULL;
ALTER TABLE staff_sessions ALTER COLUMN last_activity_at SET DEFAULT CURRENT_TIMESTAMP;
COMMIT;
