-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Make id auto-generate even though it's TEXT
ALTER TABLE "modsec_landing"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- Set processed default to false (optional but good)
ALTER TABLE "modsec_landing"
  ALTER COLUMN "processed" SET DEFAULT false;

