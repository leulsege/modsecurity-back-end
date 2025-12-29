-- 1) Add the column (no PK yet) - if it doesn't exist as bigint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'modsec_landing' 
    AND column_name = 'id' 
    AND data_type = 'bigint'
  ) THEN
    -- Drop existing id column if it's TEXT
    ALTER TABLE public.modsec_landing DROP COLUMN IF EXISTS id;
    
    -- Add new BIGINT id column
    ALTER TABLE public.modsec_landing
    ADD COLUMN id BIGINT;
  END IF;
END $$;

-- 2) Create a sequence for it
CREATE SEQUENCE IF NOT EXISTS public.modsec_landing_id_seq;

-- 3) Backfill existing rows
UPDATE public.modsec_landing
SET id = nextval('public.modsec_landing_id_seq')
WHERE id IS NULL;

-- 4) Set default for future inserts
ALTER TABLE public.modsec_landing
ALTER COLUMN id SET DEFAULT nextval('public.modsec_landing_id_seq');

-- 5) Enforce not null + primary key
ALTER TABLE public.modsec_landing
ALTER COLUMN id SET NOT NULL;

-- Drop existing primary key constraint if it exists
ALTER TABLE public.modsec_landing
DROP CONSTRAINT IF EXISTS modsec_landing_pkey;

-- Add new primary key constraint
ALTER TABLE public.modsec_landing
ADD CONSTRAINT modsec_landing_pkey PRIMARY KEY (id);

