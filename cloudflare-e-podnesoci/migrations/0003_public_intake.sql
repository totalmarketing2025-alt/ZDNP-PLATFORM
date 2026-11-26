-- Encrypted public intake and one-time tracking codes for staging.
ALTER TABLE cases ADD COLUMN tracking_token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS cases_tracking_token_hash
  ON cases(tracking_token_hash) WHERE tracking_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS case_submissions(
  case_id TEXT PRIMARY KEY REFERENCES cases(id),
  payload_ciphertext TEXT NOT NULL,
  payload_iv TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Keep only keyed HMAC fingerprints, never the visitor IP address itself.
CREATE TABLE IF NOT EXISTS public_intake_limits(
  fingerprint TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
