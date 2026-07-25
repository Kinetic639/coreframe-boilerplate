ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS registration_enabled boolean NOT NULL DEFAULT true;
