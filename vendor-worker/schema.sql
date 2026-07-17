-- D1 schema for the vendor activation service
CREATE TABLE IF NOT EXISTS licenses (
  key TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter',
  max_fingerprints INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',       -- active | suspended | revoked
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_key TEXT NOT NULL REFERENCES licenses(key) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  deployment_domain TEXT,
  ip TEXT,
  user_agent TEXT,
  first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (license_key, fingerprint)
);

CREATE TABLE IF NOT EXISTS rejections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_key TEXT NOT NULL,
  attempted_fingerprint TEXT NOT NULL,
  attempted_domain TEXT,
  ip TEXT,
  ts INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_activations_key ON activations(license_key);
