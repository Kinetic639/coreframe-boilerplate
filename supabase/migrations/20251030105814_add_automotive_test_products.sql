-- =============================================
-- Add Automotive Test Products Migration
-- Adds test products from automotive vendors for car body workshop
-- Uses correct simplified products schema
-- =============================================

DO $$
DECLARE
  org_id UUID;
  branch_id UUID;
  user_id UUID;

  -- Supplier IDs
  supplier_autoczesci UUID;
  supplier_lackprofi UUID;
  supplier_profiserwis UUID;
  supplier_italtech UUID;
  supplier_blachtech UUID;
  supplier_autoelektronika UUID;
  supplier_systeme UUID;
  supplier_bhpauto UUID;

  -- Category IDs
  cat_parts UUID;
  cat_paints UUID;
  cat_tools UUID;
  cat_consumables UUID;
  cat_safety UUID;

BEGIN
  -- Get organization and branch (assuming first org/branch for testing)
  SELECT id INTO org_id FROM organizations LIMIT 1;
  SELECT id INTO branch_id FROM branches WHERE organization_id = org_id LIMIT 1;
  SELECT id INTO user_id FROM users WHERE organization_id = org_id LIMIT 1;

  IF org_id IS NULL OR branch_id IS NULL OR user_id IS NULL THEN
    RAISE EXCEPTION 'Missing organization, branch, or user data';
  END IF;

  -- Get supplier IDs by name
  SELECT id INTO supplier_autoczesci FROM suppliers WHERE name = 'Auto-Czesci Warszawa' AND organization_id = org_id;
  SELECT id INTO supplier_lackprofi FROM suppliers WHERE name = 'Lackprofi Deutschland' AND organization_id = org_id;
  SELECT id INTO supplier_profiserwis FROM suppliers WHERE name = 'ProfiSerwis' AND organization_id = org_id;
  SELECT id INTO supplier_italtech FROM suppliers WHERE name = 'ItalTech' AND organization_id = org_id;
  SELECT id INTO supplier_blachtech FROM suppliers WHERE name = 'BlacharTech' AND organization_id = org_id;
  SELECT id INTO supplier_autoelektronika FROM suppliers WHERE name = 'AutoElektronika Praha' AND organization_id = org_id;
  SELECT id INTO supplier_systeme FROM suppliers WHERE name = 'Systeme Peinture' AND organization_id = org_id;
  SELECT id INTO supplier_bhpauto FROM suppliers WHERE name = 'BHP-Auto' AND organization_id = org_id;

  -- Create product categories
  INSERT INTO product_categories (organization_id, name, description)
  VALUES (org_id, 'Czesci samochodowe', 'Auto parts and components')
  RETURNING id INTO cat_parts;

  INSERT INTO product_categories (organization_id, name, description)
  VALUES (org_id, 'Farby i lakiery', 'Paints and coatings')
  RETURNING id INTO cat_paints;

  INSERT INTO product_categories (organization_id, name, description)
  VALUES (org_id, 'Narzedzia', 'Tools and equipment')
  RETURNING id INTO cat_tools;

  INSERT INTO product_categories (organization_id, name, description)
  VALUES (org_id, 'Materialy eksploatacyjne', 'Consumables and supplies')
  RETURNING id INTO cat_consumables;

  INSERT INTO product_categories (organization_id, name, description)
  VALUES (org_id, 'Srodki BHP', 'Safety equipment')
  RETURNING id INTO cat_safety;

  -- ============================================
  -- PRODUCTS FROM AUTO-CZESCI WARSZAWA
  -- ============================================

  -- Product 1: Bumper
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Zderzak przedni VW Golf VII', 'BUMP-VW-G7-F',
    'Zderzak przedni do VW Golf VII, oryginalny, kolor czarny, gotowy do malowania',
    cat_parts, 'pcs', 450.00, 750.00,
    supplier_autoczesci, true, 2,
    0, 'active', user_id
  );

  -- Product 2: Headlight
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Reflektor lewy Audi A4 B9', 'HEAD-AUD-A4-L',
    'Reflektor przedni lewy Audi A4 B9, LED, oryginalny',
    cat_parts, 'pcs', 850.00, 1350.00,
    supplier_autoczesci, true, 1,
    0, 'active', user_id
  );

  -- Product 3: Door
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Drzwi przednie prawe BMW 3 F30', 'DOOR-BMW-F30-FR',
    'Drzwi przednie prawe BMW seria 3 F30, kompletne z szyb',
    cat_parts, 'pcs', 1200.00, 1900.00,
    supplier_autoczesci, true, 1,
    0, 'active', user_id
  );

  -- ============================================
  -- PRODUCTS FROM LACKPROFI DEUTSCHLAND
  -- ============================================

  -- Product 4: Base Paint
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Farba bazowa Spies Hecker 1L', 'PAINT-SH-BASE-1L',
    'Farba bazowa Spies Hecker Permahyd Hi-TEC, 1 litr, mixing system',
    cat_paints, 'L', 180.00, 290.00,
    supplier_lackprofi, true, 5,
    0, 'active', user_id
  );

  -- Product 5: Clear Coat
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Lakier bezbarwny 2K 5L', 'CLEAR-2K-5L',
    'Lakier bezbarwny dwuskladnikowy, high solid, 5 litrow',
    cat_paints, 'L', 320.00, 520.00,
    supplier_lackprofi, true, 3,
    0, 'active', user_id
  );

  -- Product 6: Hardener
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Utwardzacz do lakieru 2.5L', 'HARD-STD-2.5L',
    'Utwardzacz standardowy do lakierow 2K, 2.5 litra',
    cat_paints, 'L', 95.00, 155.00,
    supplier_lackprofi, true, 5,
    0, 'active', user_id
  );

  -- ============================================
  -- PRODUCTS FROM PROFISERWIS
  -- ============================================

  -- Product 7: Spray Gun
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Pistolet lakierniczy HVLP', 'GUN-HVLP-PRO',
    'Pistolet lakierniczy HVLP 1.3mm, gravity feed, profesjonalny',
    cat_tools, 'pcs', 420.00, 680.00,
    supplier_profiserwis, true, 2,
    0, 'active', user_id
  );

  -- Product 8: Air Compressor
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Kompresor 100L 3HP', 'COMP-100L-3HP',
    'Kompresor tlokowy 100L, 3HP, 10 bar, olejowy',
    cat_tools, 'pcs', 1850.00, 2900.00,
    supplier_profiserwis, true, 1,
    0, 'active', user_id
  );

  -- ============================================
  -- PRODUCTS FROM ITALTECH
  -- ============================================

  -- Product 9: Angle Grinder
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Szlifierka katowa 125mm', 'GRIND-ANG-125',
    'Szlifierka katowa 125mm, 1200W, regulacja obrotow',
    cat_tools, 'pcs', 280.00, 450.00,
    supplier_italtech, true, 3,
    0, 'active', user_id
  );

  -- ============================================
  -- PRODUCTS FROM BLACHTECH
  -- ============================================

  -- Product 10: Sandpaper Set
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Papier scierny zestaw P80-P320', 'SAND-SET-MIX',
    'Zestaw papieru sciernego na sucho, gradacje P80, P120, P180, P240, P320, 50szt/gradacja',
    cat_consumables, 'set', 85.00, 140.00,
    supplier_blachtech, true, 10,
    0, 'active', user_id
  );

  -- Product 11: Masking Tape
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Tasma maskujaca 50mm x 50m', 'TAPE-MASK-50',
    'Tasma maskujaca papierowa, temperatura do 80C, 50mm x 50m',
    cat_consumables, 'roll', 12.50, 22.00,
    supplier_blachtech, true, 20,
    0, 'active', user_id
  );

  -- ============================================
  -- PRODUCTS FROM BHP-AUTO
  -- ============================================

  -- Product 12: Safety Goggles
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Gogle ochronne antypara', 'GOGG-SAFETY-AF',
    'Gogle ochronne z powloka antypara, odporne na zarysowania, ochrona UV',
    cat_safety, 'pcs', 25.00, 45.00,
    supplier_bhpauto, true, 10,
    0, 'active', user_id
  );

  -- Product 13: Respirator Mask
  INSERT INTO products (
    organization_id, product_type, name, sku, description,
    category_id, unit, cost_price, selling_price,
    preferred_vendor_id, track_inventory, reorder_point,
    opening_stock, status, created_by
  ) VALUES (
    org_id, 'goods', 'Maska lakiernicza z filtrami', 'RESP-PAINT-PRO',
    'Maska lakiernicza polmaska, filtry A2P3, wielokrotnego uzytku',
    cat_safety, 'pcs', 180.00, 290.00,
    supplier_bhpauto, true, 5,
    0, 'active', user_id
  );

  RAISE NOTICE 'Successfully added 13 test automotive products from 6 different vendors';
  RAISE NOTICE 'Products categories: parts (3), paints (3), tools (3), consumables (2), safety (2)';
  RAISE NOTICE 'All products have zero opening stock - ready for delivery testing';

END $$;
