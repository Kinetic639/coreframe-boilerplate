-- Add new columns to movement_types table
ALTER TABLE public.movement_types
ADD COLUMN IF NOT EXISTS creates_reservation boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_movement_request boolean DEFAULT false;

-- Update existing movement types with new column values
UPDATE public.movement_types
SET creates_reservation = true
WHERE code IN ('201', '301', '311', '411', '601', '602', '603');

UPDATE public.movement_types
SET requires_movement_request = true
WHERE code IN ('201', '301', '302', '311', '312', '411', '206');

-- Insert new movement types (using ON CONFLICT to be idempotent)
-- Receipts (111, 112, 121, 122)
INSERT INTO public.movement_types (code, name, name_pl, description, category, affects_stock, polish_document_type, requires_approval, creates_reservation, requires_movement_request, requires_destination_location)
VALUES
  ('111', 'Positive Receipt Adjustment', 'Korekta przyjecia (+)', 'Korekta przyjecia zwiekszajaca ilosc lub wartosc', 'receipt', 1, 'PZ-KOR+', false, false, false, true),
  ('112', 'Negative Receipt Adjustment', 'Korekta przyjecia (-)', 'Korekta przyjecia zmniejszajaca ilosc lub wartosc', 'receipt', -1, 'PZ-KOR-', false, false, false, false),
  ('121', 'Customer Return Receipt', 'Zwrot od klienta', 'Przyjecie zwrotu od klienta. Moze trafiac do QC', 'receipt', 1, 'PZ-ZW', false, false, false, true),
  ('122', 'Returnable Packaging Receipt', 'Przyjecie opakowan zwrotnych', 'Przyjecie opakowan zwrotnych / palet', 'receipt', 1, 'PZ-OPK', false, false, false, true)
ON CONFLICT (code) DO NOTHING;

-- Issues (211, 221)
INSERT INTO public.movement_types (code, name, name_pl, description, category, affects_stock, polish_document_type, requires_approval, creates_reservation, requires_movement_request, requires_source_location)
VALUES
  ('211', 'Sample / Promo Issue', 'Wydanie probek', 'Wydanie probek, materialow marketingowych', 'issue', -1, 'WZ-SAMP', false, false, true, true),
  ('221', 'Export Issue', 'Wydanie eksportowe', 'Wydanie eksportowe (WDT/WNT)', 'issue', -1, 'WZ-EXPORT', false, true, true, true)
ON CONFLICT (code) DO NOTHING;

-- Transfer corrections (321, 322)
INSERT INTO public.movement_types (code, name, name_pl, description, category, affects_stock, polish_document_type, requires_approval, creates_reservation, requires_movement_request, requires_source_location, requires_destination_location)
VALUES
  ('321', 'Inter-Warehouse Issue Correction', 'Korekta wydania MM', 'Korekta/storno ruchu 301', 'transfer', 1, 'MM-KOR-', false, false, false, false, true),
  ('322', 'Inter-Warehouse Receipt Correction', 'Korekta przyjecia MM', 'Korekta/storno ruchu 302', 'transfer', -1, 'MM-KOR+', false, false, false, true, false)
ON CONFLICT (code) DO NOTHING;

-- Production (412, 421, 422, 431)
INSERT INTO public.movement_types (code, name, name_pl, description, category, affects_stock, polish_document_type, requires_approval, creates_reservation, requires_movement_request, requires_source_location, requires_destination_location)
VALUES
  ('412', 'Production Issue Correction', 'Korekta RW-PROD', 'Korekta RW-PROD', 'adjustment', 1, 'RW-PROD-KOR', false, false, false, false, false),
  ('421', 'Production Receipt', 'Przyjecie produkcji', 'Przyjecie wyrobow gotowych lub kompletacji', 'receipt', 1, 'PW', false, false, false, false, true),
  ('422', 'Production Receipt Correction', 'Korekta PW', 'Korekta PW', 'receipt', -1, 'PW-KOR', false, false, false, false, false),
  ('431', 'De-Assembly / Break Down', 'Rozkompletowanie', 'Rozkompletowanie zestawow', 'adjustment', 0, 'PW-DEM', false, false, false, true, true)
ON CONFLICT (code) DO NOTHING;

-- Manual corrections (511, 512)
INSERT INTO public.movement_types (code, name, name_pl, description, category, affects_stock, polish_document_type, requires_approval, creates_reservation, requires_movement_request)
VALUES
  ('511', 'Manual Stock Correction (+)', 'Korekta manualna (+)', 'Zwiekszenie stanu poza inwentaryzacja', 'adjustment', 1, 'KOR+', false, false, false),
  ('512', 'Manual Stock Correction (-)', 'Korekta manualna (-)', 'Zmniejszenie stanu poza inwentaryzacja', 'adjustment', -1, 'KOR-', false, false, false)
ON CONFLICT (code) DO NOTHING;

-- Returns (621, 622)
INSERT INTO public.movement_types (code, name, name_pl, description, category, affects_stock, polish_document_type, requires_approval, creates_reservation, requires_movement_request, requires_source_location)
VALUES
  ('621', 'Return to Supplier', 'Zwrot do dostawcy', 'Zwrot towaru dostawcy', 'issue', -1, 'ZW-DOST', false, true, true, true),
  ('622', 'Return to Supplier Correction', 'Korekta zwrotu do dostawcy', 'Korekta ruchu ZW-DOST', 'issue', 1, 'ZW-DOST-KOR', false, false, false, false)
ON CONFLICT (code) DO NOTHING;

-- Disposal (623, 624) - reassigned from 601/602
INSERT INTO public.movement_types (code, name, name_pl, description, category, affects_stock, polish_document_type, requires_approval, creates_reservation, requires_movement_request, requires_source_location)
VALUES
  ('623', 'Disposal / Scrap', 'Likwidacja', 'Likwidacja, zlomowan nie, utylizacja', 'adjustment', -1, 'LZ', true, false, true, true),
  ('624', 'Disposal Correction', 'Korekta likwidacji', 'Korekta ruchu LZ', 'adjustment', 1, 'LZ-KOR', true, false, false, false)
ON CONFLICT (code) DO NOTHING;

-- Quality Control (701, 702, 703)
INSERT INTO public.movement_types (code, name, name_pl, description, category, affects_stock, polish_document_type, requires_approval, creates_reservation, requires_movement_request, requires_source_location, requires_destination_location)
VALUES
  ('701', 'Quality Hold', 'Blokada QC', 'Przeniesienie towaru do bin QC (blokada jakosciowa)', 'adjustment', 0, 'QC-BLOCK', true, true, true, true, true),
  ('702', 'Quality Release', 'Zwolnienie QC', 'Zwolnienie z QC do normalnego obrotu', 'adjustment', 0, 'QC-REL', true, false, true, true, true),
  ('703', 'Sampling Issue', 'Pobranie probki', 'Pobranie probki do testow', 'issue', -1, 'QC-SAMP', false, true, false, true, false)
ON CONFLICT (code) DO NOTHING;

-- Bin movements (801-808)
INSERT INTO public.movement_types (code, name, name_pl, description, category, affects_stock, polish_document_type, requires_approval, creates_reservation, requires_movement_request, requires_source_location, requires_destination_location, generates_document)
VALUES
  ('801', 'Bin-to-Bin Move', 'Przesuniecie BIN', 'Przesuniecie miejscowe w ramach jednego magazynu', 'transfer', 0, 'MMZ', false, false, false, true, true, false),
  ('802', 'Move to Damaged Zone', 'Przesuniecie do uszkodzen', 'Przesuniecie do strefy uszkodzen', 'transfer', 0, 'MMJ', false, false, false, true, true, false),
  ('803', 'Move to Staging / Buffer', 'Przesuniecie do staging', 'Przesuniecie do strefy staging/picking buffer', 'transfer', 0, 'MMO', false, false, false, true, true, false),
  ('804', 'Loading Dock Move', 'Przesuniecie dock', 'Przesuniecie logistyczne (dock → receiving → stock)', 'transfer', 0, 'MML', false, false, false, true, true, false),
  ('805', 'Replenishment', 'Uzupelnienie', 'Uzupelnienie pickingu z rezerwy', 'transfer', 0, 'MMP', false, false, true, true, true, false),
  ('806', 'Bin Consolidation', 'Scalanie BIN', 'Scalanie lokalizacji', 'transfer', 0, 'MMK', false, false, false, true, true, false),
  ('807', 'Bin Splitting', 'Rozdzielanie BIN', 'Rozdzielanie lokalizacji', 'transfer', 0, 'MMR', false, false, false, true, true, false),
  ('808', 'Bin Balancing', 'Balansowanie BIN', 'Balansowanie stanow miedzy BIN-ami', 'transfer', 0, 'MMB', false, false, false, true, true, false)
ON CONFLICT (code) DO NOTHING;

-- Consignment (901-903)
INSERT INTO public.movement_types (code, name, name_pl, description, category, affects_stock, polish_document_type, requires_approval, creates_reservation, requires_movement_request, requires_source_location, requires_destination_location)
VALUES
  ('901', 'Ownership Change', 'Zmiana wlasciciela', 'Zmiana wlasciciela towaru bez zmiany BIN', 'adjustment', 0, 'KONS-OWN', true, false, false, false, false),
  ('902', 'Consignment Receipt', 'Przyjecie konsygnacji', 'Przyjecie towaru konsygnacyjnego', 'receipt', 1, 'KONS-IN', false, false, false, false, true),
  ('903', 'Consignment Issue', 'Wydanie konsygnacji', 'Pobranie z konsygnacji (powstaje koszt)', 'issue', -1, 'KONS-OUT', false, true, true, true, false)
ON CONFLICT (code) DO NOTHING;
