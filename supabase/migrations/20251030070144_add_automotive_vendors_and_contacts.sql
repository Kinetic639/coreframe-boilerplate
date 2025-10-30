-- Migration: Add Automotive Vendors and Contacts for Car Body Workshop
-- Centrum Napraw Powypadkowych - Grupa Cichy-Zasada
-- Safe, idempotent version (2025-10-30)

DO $$
DECLARE
  org_id uuid;
  supplier_id uuid;
BEGIN
  -- Get organization ID (first org in system)
  SELECT organization_id INTO org_id FROM organization_profiles LIMIT 1;

  -------------------------------------------------------------------------
  -- 1. POLISH - Auto Parts Distributor
  -------------------------------------------------------------------------
  INSERT INTO suppliers (
    organization_id, name, company_registration_number, tax_number, website,
    address_line_1, address_line_2, city, state_province, postal_code, country,
    payment_terms, delivery_terms, notes, is_active, tags
  )
  VALUES (
    org_id,
    'Auto-Czesci Warszawa Sp. z o.o.',
    '5213456789',
    'PL5213456789',
    'https://www.autoczesci-warszawa.pl',
    'ul. Jerozolimskie 123',
    'Budynek B',
    'Warszawa',
    'Mazowieckie',
    '02-222',
    'Polska',
    '30 dni',
    'DDP - dostawa na miejsce',
    'Glowny dostawca czesci karoseryjnych OEM i zamiennikow. Szybka dostawa w 24h na terenie Warszawy.',
    true,
    ARRAY['czesci-karoseryjne', 'OEM', 'zamienniki', 'dostawa-24h']
  )
  ON CONFLICT (name, organization_id) DO NOTHING
  RETURNING id INTO supplier_id;

  IF supplier_id IS NULL THEN
    SELECT id INTO supplier_id FROM suppliers WHERE name = 'Auto-Czesci Warszawa Sp. z o.o.' AND organization_id = org_id;
  END IF;

  INSERT INTO supplier_contacts (
    supplier_id, first_name, last_name, email, phone, mobile,
    position, department, is_primary, is_active, notes
  )
  VALUES
    (supplier_id, 'Marek', 'Kowalski', 'marek.kowalski@autoczesci-warszawa.pl',
     '+48 22 123 45 67', '+48 601 234 567', 'Kierownik Sprzedazy', 'Dzial Handlowy',
     true, true, 'Kontakt glowny - wszystkie zamowienia czesci'),
    (supplier_id, 'Anna', 'Nowak', 'anna.nowak@autoczesci-warszawa.pl',
     '+48 22 123 45 68', '+48 602 345 678', 'Specjalista ds. Czesci', 'Dzial Handlowy',
     false, true, 'Pomoc w doborze czesci, zamowienia specjalne')
  ON CONFLICT DO NOTHING;

  -------------------------------------------------------------------------
  -- 2. GERMAN - Paint and Body Materials
  -------------------------------------------------------------------------
  INSERT INTO suppliers (
    organization_id, name, company_registration_number, tax_number, website,
    address_line_1, city, state_province, postal_code, country,
    payment_terms, delivery_terms, notes, is_active, tags
  )
  VALUES (
    org_id,
    'Lackprofi Deutschland GmbH',
    'HRB 123456',
    'DE123456789',
    'https://www.lackprofi.de',
    'Industriestrasse 45',
    'Stuttgart',
    'Baden-Wurttemberg',
    '70565',
    'Germany',
    '30 days net',
    'FCA Stuttgart',
    'Premium supplier of automotive paints, clear coats, and refinishing materials. Authorized distributor for major paint brands.',
    true,
    ARRAY['lakiery', 'automotive-paint', 'refinishing', 'premium']
  )
  ON CONFLICT (name, organization_id) DO NOTHING
  RETURNING id INTO supplier_id;

  IF supplier_id IS NULL THEN
    SELECT id INTO supplier_id FROM suppliers WHERE name = 'Lackprofi Deutschland GmbH' AND organization_id = org_id;
  END IF;

  INSERT INTO supplier_contacts (
    supplier_id, first_name, last_name, email, phone, mobile,
    position, department, is_primary, is_active, notes
  )
  VALUES
    (supplier_id, 'Hans', 'Muller', 'h.mueller@lackprofi.de',
     '+49 711 123 4567', '+49 172 123 4567', 'Export Sales Manager', 'International Sales',
     true, true, 'Main contact for Polish customers'),
    (supplier_id, 'Petra', 'Schmidt', 'p.schmidt@lackprofi.de',
     '+49 711 123 4568', '+49 173 234 5678', 'Technical Advisor', 'Technical Support',
     false, true, 'Color matching and application support')
  ON CONFLICT DO NOTHING;

  -------------------------------------------------------------------------
  -- 3. POLISH - Body Shop Equipment
  -------------------------------------------------------------------------
  INSERT INTO suppliers (
    organization_id, name, company_registration_number, tax_number, website,
    address_line_1, address_line_2, city, state_province, postal_code, country,
    payment_terms, delivery_terms, notes, is_active, tags
  )
  VALUES (
    org_id,
    'ProfiSerwis Wyposazenie Lakierni',
    '3456789012',
    'PL3456789012',
    'https://www.profiserwis.pl',
    'ul. Przemyslowa 78',
    'Hala 3',
    'Poznan',
    'Wielkopolskie',
    '61-777',
    'Polska',
    '14 dni',
    'FCA Poznan lub dostawa wlasnym transportem',
    'Kompletne wyposazenie lakierni - kabiny lakiernicze, stoly prostownicze, spawarki punktowe, narzedzia blacharskie.',
    true,
    ARRAY['wyposazenie', 'kabiny-lakiernicze', 'narzedzia', 'serwis']
  )
  ON CONFLICT (name, organization_id) DO NOTHING
  RETURNING id INTO supplier_id;

  IF supplier_id IS NULL THEN
    SELECT id INTO supplier_id FROM suppliers WHERE name = 'ProfiSerwis Wyposazenie Lakierni' AND organization_id = org_id;
  END IF;

  INSERT INTO supplier_contacts (
    supplier_id, first_name, last_name, email, phone, mobile,
    position, department, is_primary, is_active, notes
  )
  VALUES
    (supplier_id, 'Tomasz', 'Wisniewski', 'tomasz.wisniewski@profiserwis.pl',
     '+48 61 234 56 78', '+48 603 456 789', 'Doradca Techniczny', 'Sprzedaz i Serwis',
     true, true, 'Doradztwo techniczne, oferty wyposazenia'),
    (supplier_id, 'Katarzyna', 'Mazur', 'katarzyna.mazur@profiserwis.pl',
     '+48 61 234 56 79', '+48 604 567 890', 'Serwisant', 'Dzial Serwisu',
     false, true, 'Naprawy i konserwacje urzadzen')
  ON CONFLICT DO NOTHING;

  -------------------------------------------------------------------------
  -- 4. ITALIAN - Specialty Tools
  -------------------------------------------------------------------------
  INSERT INTO suppliers (
    organization_id, name, company_registration_number, tax_number, website,
    address_line_1, city, state_province, postal_code, country,
    payment_terms, delivery_terms, notes, is_active, tags
  )
  VALUES (
    org_id,
    'ItalTech Automotive Tools S.r.l.',
    'IT12345678901',
    'IT12345678901',
    'https://www.italtech-tools.it',
    'Via Industriale 234',
    'Milano',
    'Lombardia',
    '20100',
    'Italy',
    '60 days',
    'DDP - delivered to customer',
    'Specialized automotive body repair tools, hydraulic systems, welding equipment. High-quality Italian manufacturing.',
    true,
    ARRAY['narzedzia-specjalistyczne', 'hydraulika', 'spawanie', 'premium']
  )
  ON CONFLICT (name, organization_id) DO NOTHING
  RETURNING id INTO supplier_id;

  IF supplier_id IS NULL THEN
    SELECT id INTO supplier_id FROM suppliers WHERE name = 'ItalTech Automotive Tools S.r.l.' AND organization_id = org_id;
  END IF;

  INSERT INTO supplier_contacts (
    supplier_id, first_name, last_name, email, phone, mobile,
    position, department, is_primary, is_active, notes
  )
  VALUES
    (supplier_id, 'Marco', 'Rossi', 'marco.rossi@italtech-tools.it',
     '+39 02 1234 5678', '+39 345 678 9012', 'Sales Director', 'Export Department',
     true, true, 'Main contact for Eastern Europe'),
    (supplier_id, 'Giulia', 'Ferrari', 'giulia.ferrari@italtech-tools.it',
     '+39 02 1234 5679', '+39 346 789 0123', 'Customer Service Manager', 'Customer Support',
     false, true, 'Order processing and logistics')
  ON CONFLICT DO NOTHING;

  -------------------------------------------------------------------------
  -- 5. POLISH - Consumables and Abrasives
  -------------------------------------------------------------------------
  INSERT INTO suppliers (
    organization_id, name, company_registration_number, tax_number, website,
    address_line_1, city, state_province, postal_code, country,
    payment_terms, delivery_terms, notes, is_active, tags
  )
  VALUES (
    org_id,
    'BlacharTech Materialy Eksploatacyjne',
    '6789012345',
    'PL6789012345',
    'https://www.blachartech.pl',
    'ul. Kolejowa 56',
    'Krakow',
    'Malopolskie',
    '30-301',
    'Polska',
    '21 dni',
    'Dostawa wlasnym transportem lub kurier',
    'Materialy eksploatacyjne: papier scierny, tarcze, dyski, tasmy maskujace, folie ochronne, srodki czyszczace.',
    true,
    ARRAY['materialy-eksploatacyjne', 'scierniwo', 'akcesoria', 'dostawa-kurierem']
  )
  ON CONFLICT (name, organization_id) DO NOTHING
  RETURNING id INTO supplier_id;

  IF supplier_id IS NULL THEN
    SELECT id INTO supplier_id FROM suppliers WHERE name = 'BlacharTech Materialy Eksploatacyjne' AND organization_id = org_id;
  END IF;

  INSERT INTO supplier_contacts (
    supplier_id, first_name, last_name, email, phone, mobile,
    position, department, is_primary, is_active, notes
  )
  VALUES
    (supplier_id, 'Piotr', 'Lewandowski', 'piotr.lewandowski@blachartech.pl',
     '+48 12 345 67 89', '+48 605 678 901', 'Przedstawiciel Handlowy', 'Sprzedaz',
     true, true, 'Region: Warszawa i okolice, regularne wizyty co 2 tygodnie'),
    (supplier_id, 'Monika', 'Kaczmarek', 'monika.kaczmarek@blachartech.pl',
     '+48 12 345 67 90', '+48 606 789 012', 'Obsluga Klienta', 'Biuro Sprzedazy',
     false, true, 'Przyjmowanie zamowien telefonicznych i email')
  ON CONFLICT DO NOTHING;

  -------------------------------------------------------------------------
  -- 6. CZECH - Car Electronics
  -------------------------------------------------------------------------
  INSERT INTO suppliers (
    organization_id, name, company_registration_number, tax_number, website,
    address_line_1, city, state_province, postal_code, country,
    payment_terms, delivery_terms, notes, is_active, tags
  )
  VALUES (
    org_id,
    'AutoElektronika Praha s.r.o.',
    'CZ12345678',
    'CZ12345678',
    'https://www.autoelektronika.cz',
    'Prumyslova 123',
    'Praha',
    'Praha',
    '140 00',
    'Czech Republic',
    '30 days',
    'FCA Praha or courier delivery',
    'Car electronics, diagnostics tools, sensors, modules. Specialized in modern vehicle electronics repair.',
    true,
    ARRAY['elektronika', 'diagnostyka', 'czujniki', 'moduly']
  )
  ON CONFLICT (name, organization_id) DO NOTHING
  RETURNING id INTO supplier_id;

  IF supplier_id IS NULL THEN
    SELECT id INTO supplier_id FROM suppliers WHERE name = 'AutoElektronika Praha s.r.o.' AND organization_id = org_id;
  END IF;

  INSERT INTO supplier_contacts (
    supplier_id, first_name, last_name, email, phone, mobile,
    position, department, is_primary, is_active, notes
  )
  VALUES
    (supplier_id, 'Jan', 'Novak', 'jan.novak@autoelektronika.cz',
     '+420 224 123 456', '+420 603 123 456', 'Technical Sales Manager', 'Sales',
     true, true, 'Speaks Polish, technical support included'),
    (supplier_id, 'Eva', 'Svobodova', 'eva.svobodova@autoelektronika.cz',
     '+420 224 123 457', '+420 604 234 567', 'Order Coordinator', 'Logistics',
     false, true, 'Order processing and shipping')
  ON CONFLICT DO NOTHING;

  -------------------------------------------------------------------------
  -- 7. FRENCH - Premium Paint Systems
  -------------------------------------------------------------------------
  INSERT INTO suppliers (
    organization_id, name, company_registration_number, tax_number, website,
    address_line_1, address_line_2, city, state_province, postal_code, country,
    payment_terms, delivery_terms, notes, is_active, tags
  )
  VALUES (
    org_id,
    'Systeme Peinture Professionnel S.A.S.',
    'SIREN 123456789',
    'FR12345678901',
    'https://www.systeme-peinture.fr',
    '45 Avenue de la Republique',
    'Zone Industrielle Nord',
    'Lyon',
    'Auvergne-Rhone-Alpes',
    '69003',
    'France',
    '45 jours',
    'DAP - Delivered at Place',
    'Systemes de peinture premium pour carrosserie. Formulations ecologiques a faible COV. Formation technique incluse.',
    true,
    ARRAY['lakiery-premium', 'eco-friendly', 'szkolenia', 'systemy-lakiernicze']
  )
  ON CONFLICT (name, organization_id) DO NOTHING
  RETURNING id INTO supplier_id;

  IF supplier_id IS NULL THEN
    SELECT id INTO supplier_id FROM suppliers WHERE name = 'Systeme Peinture Professionnel S.A.S.' AND organization_id = org_id;
  END IF;

  INSERT INTO supplier_contacts (
    supplier_id, first_name, last_name, email, phone, mobile,
    position, department, is_primary, is_active, notes
  )
  VALUES
    (supplier_id, 'Pierre', 'Dubois', 'pierre.dubois@systeme-peinture.fr',
     '+33 4 72 12 34 56', '+33 6 12 34 56 78', 'Directeur Commercial Export', 'Export',
     true, true, 'English and German speaker, export specialist'),
    (supplier_id, 'Marie', 'Laurent', 'marie.laurent@systeme-peinture.fr',
     '+33 4 72 12 34 57', '+33 6 23 45 67 89', 'Conseillere Technique', 'Support Technique',
     false, true, 'Color matching expert, training sessions')
  ON CONFLICT DO NOTHING;

  -------------------------------------------------------------------------
  -- 8. POLISH - Safety Equipment
  -------------------------------------------------------------------------
  INSERT INTO suppliers (
    organization_id, name, company_registration_number, tax_number, website,
    address_line_1, city, state_province, postal_code, country,
    payment_terms, delivery_terms, notes, is_active, tags
  )
  VALUES (
    org_id,
    'BHP-Auto Srodki Ochrony Osobistej',
    '8901234567',
    'PL8901234567',
    'https://www.bhp-auto.pl',
    'ul. Transportowa 89',
    'Gdansk',
    'Pomorskie',
    '80-001',
    'Polska',
    '14 dni',
    'Dostawa kurierem 24h',
    'Kompletne srodki BHP dla lakierni i warsztatow blacharskich. Odziez ochronna, maski, rekawice, gogle, respiratory.',
    true,
    ARRAY['BHP', 'odziez-ochronna', 'respiratory', 'dostawa-24h']
  )
  ON CONFLICT (name, organization_id) DO NOTHING
  RETURNING id INTO supplier_id;

  IF supplier_id IS NULL THEN
    SELECT id INTO supplier_id FROM suppliers WHERE name = 'BHP-Auto Srodki Ochrony Osobistej' AND organization_id = org_id;
  END IF;

  INSERT INTO supplier_contacts (
    supplier_id, first_name, last_name, email, phone, mobile,
    position, department, is_primary, is_active, notes
  )
  VALUES
    (supplier_id, 'Adam', 'Szymanski', 'adam.szymanski@bhp-auto.pl',
     '+48 58 123 45 67', '+48 607 890 123', 'Specjalista BHP', 'Doradztwo i Sprzedaz',
     true, true, 'Doradztwo w zakresie srodkow ochronnych, audyty BHP'),
    (supplier_id, 'Barbara', 'Wozniak', 'barbara.wozniak@bhp-auto.pl',
     '+48 58 123 45 68', '+48 608 901 234', 'Kierownik Sprzedazy', 'Sprzedaz',
     false, true, 'Zamowienia hurtowe, umowy stalej wspolpracy')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Successfully added or verified 8 automotive vendors with contacts for car body workshop';
END $$;
