-- =============================================
-- Phase 1: Enhanced Movement Types Migration
-- Adds Polish compliance, SAP-style codes, and e-commerce support
-- =============================================

-- ============================================
-- STEP 1: ADD NEW COLUMNS TO MOVEMENT_TYPES
-- ============================================

-- Add new columns (if they don't exist)
DO $$
BEGIN
  -- Category column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='category') THEN
    ALTER TABLE movement_types ADD COLUMN category TEXT;
  END IF;

  -- Polish names
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='name_pl') THEN
    ALTER TABLE movement_types ADD COLUMN name_pl TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='name_en') THEN
    ALTER TABLE movement_types ADD COLUMN name_en TEXT;
  END IF;

  -- Polish document type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='polish_document_type') THEN
    ALTER TABLE movement_types ADD COLUMN polish_document_type TEXT;
  END IF;

  -- Location requirements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='requires_source_location') THEN
    ALTER TABLE movement_types ADD COLUMN requires_source_location BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='requires_destination_location') THEN
    ALTER TABLE movement_types ADD COLUMN requires_destination_location BOOLEAN DEFAULT false;
  END IF;

  -- Reference requirements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='requires_reference') THEN
    ALTER TABLE movement_types ADD COLUMN requires_reference BOOLEAN DEFAULT false;
  END IF;

  -- Manual entry
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='allows_manual_entry') THEN
    ALTER TABLE movement_types ADD COLUMN allows_manual_entry BOOLEAN DEFAULT true;
  END IF;

  -- Document generation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='generates_document') THEN
    ALTER TABLE movement_types ADD COLUMN generates_document BOOLEAN DEFAULT true;
  END IF;

  -- Cost impact
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='cost_impact') THEN
    ALTER TABLE movement_types ADD COLUMN cost_impact TEXT;
  END IF;

  -- Accounting entry
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='accounting_entry') THEN
    ALTER TABLE movement_types ADD COLUMN accounting_entry JSONB;
  END IF;

  -- Metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='metadata') THEN
    ALTER TABLE movement_types ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;

  -- Updated at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='movement_types' AND column_name='updated_at') THEN
    ALTER TABLE movement_types ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add constraints
ALTER TABLE movement_types DROP CONSTRAINT IF EXISTS movement_types_category_check;
ALTER TABLE movement_types ADD CONSTRAINT movement_types_category_check
  CHECK (category IN ('receipt', 'issue', 'transfer', 'adjustment', 'reservation', 'ecommerce'));

ALTER TABLE movement_types DROP CONSTRAINT IF EXISTS movement_types_cost_impact_check;
ALTER TABLE movement_types ADD CONSTRAINT movement_types_cost_impact_check
  CHECK (cost_impact IN ('increase', 'decrease', 'neutral'));

-- ============================================
-- STEP 2: UPDATE EXISTING MOVEMENT TYPES
-- ============================================

-- Categorize existing movement types
UPDATE movement_types SET category = 'receipt'
WHERE code IN ('initial', 'purchase', 'return_customer', 'production_output');

UPDATE movement_types SET category = 'issue'
WHERE code IN ('sale', 'return_supplier', 'damaged', 'production_consume');

UPDATE movement_types SET category = 'transfer'
WHERE code IN ('transfer_out', 'transfer_in');

UPDATE movement_types SET category = 'adjustment'
WHERE code IN ('adjustment_positive', 'adjustment_negative', 'audit_adjustment');

UPDATE movement_types SET category = 'reservation'
WHERE code IN ('reservation', 'reservation_release');

-- Add Polish names for existing types
UPDATE movement_types SET
  name_pl = 'Stan początkowy',
  name_en = 'Initial Stock',
  polish_document_type = 'PZ',
  cost_impact = 'increase',
  requires_destination_location = true,
  generates_document = true
WHERE code = 'initial';

UPDATE movement_types SET
  name_pl = 'Zakup',
  name_en = 'Purchase',
  polish_document_type = 'PZ',
  cost_impact = 'increase',
  requires_destination_location = true,
  requires_reference = true,
  generates_document = true
WHERE code = 'purchase';

UPDATE movement_types SET
  name_pl = 'Sprzedaż',
  name_en = 'Sale',
  polish_document_type = 'WZ',
  cost_impact = 'decrease',
  requires_source_location = true,
  requires_reference = true,
  generates_document = true
WHERE code = 'sale';

UPDATE movement_types SET
  name_pl = 'Korekta dodatnia',
  name_en = 'Positive Adjustment',
  polish_document_type = 'KP',
  cost_impact = 'increase',
  requires_destination_location = true,
  generates_document = true
WHERE code = 'adjustment_positive';

UPDATE movement_types SET
  name_pl = 'Korekta ujemna',
  name_en = 'Negative Adjustment',
  polish_document_type = 'KN',
  cost_impact = 'decrease',
  requires_source_location = true,
  generates_document = true
WHERE code = 'adjustment_negative';

UPDATE movement_types SET
  name_pl = 'Szkody/Straty',
  name_en = 'Damaged/Lost',
  polish_document_type = 'RW-S',
  cost_impact = 'decrease',
  requires_source_location = true,
  generates_document = true
WHERE code = 'damaged';

UPDATE movement_types SET
  name_pl = 'Przesunięcie WY',
  name_en = 'Transfer Out',
  polish_document_type = 'MM-W',
  cost_impact = 'neutral',
  requires_source_location = true,
  generates_document = true
WHERE code = 'transfer_out';

UPDATE movement_types SET
  name_pl = 'Przesunięcie PR',
  name_en = 'Transfer In',
  polish_document_type = 'MM-P',
  cost_impact = 'neutral',
  requires_destination_location = true,
  generates_document = true
WHERE code = 'transfer_in';

UPDATE movement_types SET
  name_pl = 'Zwrot od klienta',
  name_en = 'Customer Return',
  polish_document_type = 'PZ-ZK',
  cost_impact = 'increase',
  requires_destination_location = true,
  generates_document = true
WHERE code = 'return_customer';

UPDATE movement_types SET
  name_pl = 'Zwrot do dostawcy',
  name_en = 'Supplier Return',
  polish_document_type = 'WZ-ZD',
  cost_impact = 'decrease',
  requires_source_location = true,
  generates_document = true
WHERE code = 'return_supplier';

UPDATE movement_types SET
  name_pl = 'Zużycie produkcyjne',
  name_en = 'Production Consumed',
  polish_document_type = 'RW-P',
  cost_impact = 'decrease',
  requires_source_location = true,
  generates_document = true
WHERE code = 'production_consume';

UPDATE movement_types SET
  name_pl = 'Produkcja',
  name_en = 'Production Output',
  polish_document_type = 'PZ-P',
  cost_impact = 'increase',
  requires_destination_location = true,
  generates_document = true
WHERE code = 'production_output';

UPDATE movement_types SET
  name_pl = 'Rezerwacja',
  name_en = 'Reservation',
  cost_impact = 'neutral',
  generates_document = false
WHERE code = 'reservation';

UPDATE movement_types SET
  name_pl = 'Zwolnienie rezerwacji',
  name_en = 'Reservation Released',
  cost_impact = 'neutral',
  generates_document = false
WHERE code = 'reservation_release';

UPDATE movement_types SET
  name_pl = 'Korekta inwentaryzacyjna',
  name_en = 'Audit Adjustment',
  polish_document_type = 'INW',
  cost_impact = 'neutral',
  generates_document = true
WHERE code = 'audit_adjustment';

-- ============================================
-- STEP 3: INSERT NEW MOVEMENT TYPES (SAP-STYLE CODES)
-- ============================================

-- Receipts (100-199)
INSERT INTO movement_types (code, category, name, name_pl, name_en, polish_document_type, affects_stock, requires_approval, requires_destination_location, requires_reference, generates_document, cost_impact, is_system)
VALUES
  ('101', 'receipt', 'GR from PO', 'Przyjęcie z zamówienia', 'Goods Receipt from PO', 'PZ', 1, false, true, true, true, 'increase', true),
  ('102', 'receipt', 'GR Reversal', 'Korekta PZ', 'GR Reversal', 'PZ-K', -1, true, false, true, true, 'decrease', true),
  ('103', 'receipt', 'Customer Return', 'Zwrot od klienta', 'Customer Return Receipt', 'PZ-ZK', 1, false, true, false, true, 'increase', true),
  ('104', 'receipt', 'Production Output', 'Produkcja wyroby gotowe', 'Production Output', 'PZ-P', 1, false, true, false, true, 'increase', true),
  ('105', 'receipt', 'Initial Stock', 'Stan początkowy', 'Initial Stock', 'PZ-I', 1, true, true, false, true, 'increase', true)
ON CONFLICT (code) DO NOTHING;

-- Issues (200-299)
INSERT INTO movement_types (code, category, name, name_pl, name_en, polish_document_type, affects_stock, requires_approval, requires_source_location, requires_reference, generates_document, cost_impact, is_system)
VALUES
  ('201', 'issue', 'GI for Sale', 'Wydanie na sprzedaż', 'Goods Issue for Sale', 'WZ', -1, false, true, true, true, 'decrease', true),
  ('202', 'issue', 'GI Reversal', 'Korekta WZ', 'GI Reversal', 'WZ-K', 1, true, false, true, true, 'increase', true),
  ('203', 'issue', 'Return to Supplier', 'Zwrot do dostawcy', 'Return to Supplier', 'WZ-ZD', -1, false, true, false, true, 'decrease', true),
  ('204', 'issue', 'Production Consumption', 'Zużycie materiałów', 'Production Consumption', 'RW-P', -1, false, true, false, true, 'decrease', true),
  ('205', 'issue', 'Cost Center Issue', 'Wydanie MPK', 'Issue to Cost Center', 'RW', -1, true, true, false, true, 'decrease', true),
  ('206', 'issue', 'Waste/Damage', 'Szkody i straty', 'Waste/Damage', 'RW-S', -1, true, true, false, true, 'decrease', true)
ON CONFLICT (code) DO NOTHING;

-- Transfers (300-399)
INSERT INTO movement_types (code, category, name, name_pl, name_en, polish_document_type, affects_stock, requires_approval, requires_source_location, requires_destination_location, generates_document, cost_impact, is_system)
VALUES
  ('301', 'transfer', 'Transfer Out', 'Przesunięcie WY', 'Transfer Out', 'MM-W', -1, false, true, false, true, 'neutral', true),
  ('302', 'transfer', 'Transfer In', 'Przesunięcie PR', 'Transfer In', 'MM-P', 1, false, false, true, true, 'neutral', true),
  ('303', 'transfer', 'Intra-Location', 'Przesunięcie wewnętrzne', 'Intra-Location Move', 'MM-L', 0, false, true, true, false, 'neutral', true),
  ('311', 'transfer', 'Inter-Branch Out', 'Transfer między oddziały WY', 'Inter-Branch Out', 'MM-O', -1, true, true, false, true, 'neutral', true),
  ('312', 'transfer', 'Inter-Branch In', 'Transfer między oddziały PR', 'Inter-Branch In', 'MM-O', 1, false, false, true, true, 'neutral', true)
ON CONFLICT (code) DO NOTHING;

-- Adjustments (400-499)
INSERT INTO movement_types (code, category, name, name_pl, name_en, polish_document_type, affects_stock, requires_approval, generates_document, cost_impact, is_system)
VALUES
  ('401', 'adjustment', 'Positive Adjustment', 'Korekta dodatnia', 'Positive Adjustment', 'KP', 1, true, true, 'increase', true),
  ('402', 'adjustment', 'Negative Adjustment', 'Korekta ujemna', 'Negative Adjustment', 'KN', -1, true, true, 'decrease', true),
  ('403', 'adjustment', 'Audit Adjustment', 'Korekta inwentaryzacyjna', 'Audit Adjustment', 'INW', 0, true, true, 'neutral', true),
  ('411', 'adjustment', 'Quality Reclassification', 'Zmiana statusu jakości', 'Quality Reclassification', 'MM-Q', 0, false, false, 'neutral', true)
ON CONFLICT (code) DO NOTHING;

-- Reservations (500-599)
INSERT INTO movement_types (code, category, name, name_pl, name_en, affects_stock, requires_approval, generates_document, cost_impact, is_system)
VALUES
  ('501', 'reservation', 'Reservation', 'Rezerwacja', 'Stock Reservation', 0, false, false, 'neutral', true),
  ('502', 'reservation', 'Reservation Release', 'Zwolnienie rezerwacji', 'Reservation Release', 0, false, false, 'neutral', true)
ON CONFLICT (code) DO NOTHING;

-- E-commerce (600-699)
INSERT INTO movement_types (code, category, name, name_pl, name_en, polish_document_type, affects_stock, requires_approval, requires_source_location, requires_reference, generates_document, allows_manual_entry, cost_impact, is_system)
VALUES
  ('601', 'ecommerce', 'Shopify Order', 'Zamówienie Shopify', 'Shopify Order', 'WZ-S', -1, false, true, true, true, false, 'decrease', true),
  ('602', 'ecommerce', 'WooCommerce Order', 'Zamówienie WooCommerce', 'WooCommerce Order', 'WZ-W', -1, false, true, true, true, false, 'decrease', true),
  ('603', 'ecommerce', 'Allegro Order', 'Zamówienie Allegro', 'Allegro Order', 'WZ-A', -1, false, true, true, true, false, 'decrease', true),
  ('611', 'ecommerce', 'Shopify Return', 'Zwrot Shopify', 'Shopify Return', 'PZ-S', 1, false, false, true, true, false, 'increase', true),
  ('612', 'ecommerce', 'WooCommerce Return', 'Zwrot WooCommerce', 'WooCommerce Return', 'PZ-W', 1, false, false, true, true, false, 'increase', true),
  ('613', 'ecommerce', 'Allegro Return', 'Zwrot Allegro', 'Allegro Return', 'PZ-A', 1, false, false, true, true, false, 'increase', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_movement_types_category ON movement_types(category);
CREATE INDEX IF NOT EXISTS idx_movement_types_polish_doc ON movement_types(polish_document_type) WHERE polish_document_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movement_types_manual_entry ON movement_types(allows_manual_entry) WHERE allows_manual_entry = true;

-- ============================================
-- STEP 5: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to get movement types by category
CREATE OR REPLACE FUNCTION get_movement_types_by_category(p_category TEXT)
RETURNS TABLE (
  id UUID,
  code TEXT,
  category TEXT,
  name TEXT,
  name_pl TEXT,
  name_en TEXT,
  polish_document_type TEXT,
  affects_stock INTEGER,
  requires_approval BOOLEAN,
  requires_source_location BOOLEAN,
  requires_destination_location BOOLEAN,
  requires_reference BOOLEAN,
  allows_manual_entry BOOLEAN,
  generates_document BOOLEAN,
  cost_impact TEXT,
  is_system BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id, code, category, name, name_pl, name_en, polish_document_type,
    affects_stock, requires_approval, requires_source_location,
    requires_destination_location, requires_reference, allows_manual_entry,
    generates_document, cost_impact, is_system
  FROM movement_types
  WHERE movement_types.category = p_category
  ORDER BY code;
$$;

-- Function to validate movement type requirements
CREATE OR REPLACE FUNCTION validate_movement_requirements(
  p_movement_type_code TEXT,
  p_has_source_location BOOLEAN,
  p_has_destination_location BOOLEAN,
  p_has_reference BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_type RECORD;
BEGIN
  SELECT * INTO v_type
  FROM movement_types
  WHERE code = p_movement_type_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement type % not found', p_movement_type_code;
  END IF;

  -- Check source location requirement
  IF v_type.requires_source_location AND NOT p_has_source_location THEN
    RAISE EXCEPTION 'Movement type % requires source location', p_movement_type_code;
  END IF;

  -- Check destination location requirement
  IF v_type.requires_destination_location AND NOT p_has_destination_location THEN
    RAISE EXCEPTION 'Movement type % requires destination location', p_movement_type_code;
  END IF;

  -- Check reference requirement
  IF v_type.requires_reference AND NOT p_has_reference THEN
    RAISE EXCEPTION 'Movement type % requires reference', p_movement_type_code;
  END IF;

  RETURN TRUE;
END;
$$;

-- ============================================
-- STEP 6: UPDATE TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_movement_types_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_movement_types_updated_at ON movement_types;
CREATE TRIGGER trigger_update_movement_types_updated_at
  BEFORE UPDATE ON movement_types
  FOR EACH ROW
  EXECUTE FUNCTION update_movement_types_updated_at();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Count movement types by category
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM movement_types;
  RAISE NOTICE 'Total movement types: %', v_count;

  SELECT COUNT(*) INTO v_count FROM movement_types WHERE category = 'receipt';
  RAISE NOTICE 'Receipt types: %', v_count;

  SELECT COUNT(*) INTO v_count FROM movement_types WHERE category = 'issue';
  RAISE NOTICE 'Issue types: %', v_count;

  SELECT COUNT(*) INTO v_count FROM movement_types WHERE category = 'transfer';
  RAISE NOTICE 'Transfer types: %', v_count;

  SELECT COUNT(*) INTO v_count FROM movement_types WHERE category = 'adjustment';
  RAISE NOTICE 'Adjustment types: %', v_count;

  SELECT COUNT(*) INTO v_count FROM movement_types WHERE category = 'reservation';
  RAISE NOTICE 'Reservation types: %', v_count;

  SELECT COUNT(*) INTO v_count FROM movement_types WHERE category = 'ecommerce';
  RAISE NOTICE 'E-commerce types: %', v_count;
END $$;

-- =============================================
-- Migration Complete
-- =============================================
