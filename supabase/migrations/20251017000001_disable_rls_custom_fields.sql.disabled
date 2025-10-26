-- Disable RLS on custom fields tables
-- RLS will be enabled later with proper policies

DO $$
BEGIN
  -- Disable RLS on product_custom_field_definitions
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_custom_field_definitions') THEN
    ALTER TABLE product_custom_field_definitions DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on product_custom_field_definitions';
  END IF;

  -- Disable RLS on product_custom_field_values
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_custom_field_values') THEN
    ALTER TABLE product_custom_field_values DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on product_custom_field_values';
  END IF;
END $$;
