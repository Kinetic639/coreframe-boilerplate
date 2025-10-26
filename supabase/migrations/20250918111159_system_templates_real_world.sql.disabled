-- Remove existing placeholder templates
DELETE FROM template_attributes WHERE template_id IN (
  SELECT id FROM templates WHERE organization_id IS NULL
);
DELETE FROM templates WHERE organization_id IS NULL;

-- Insert 5 realistic system templates with different use cases

-- 1. Home Inventory Template (Simple: name, quantity, location)
INSERT INTO templates (id, name, description, color, supported_contexts, organization_id, created_by)
VALUES (
  gen_random_uuid(),
  'Domowy inwentarz',
  'Prosty szablon do zarzdzania przedmiotami w domu - nazwa, ilo[ i lokalizacja',
  '#22c55e',
  ARRAY['warehouse']::text[],
  NULL,
  NULL
);

-- Get the home inventory template ID for attributes
WITH home_template AS (
  SELECT id FROM templates WHERE name = 'Domowy inwentarz' AND organization_id IS NULL
)
INSERT INTO template_attributes (id, template_id, name, type, is_required, default_value, options, validation_rules, display_order, help_text)
SELECT
  gen_random_uuid(),
  home_template.id,
  attr.name,
  attr.type,
  attr.is_required,
  attr.default_value,
  attr.options,
  attr.validation_rules,
  attr.display_order,
  attr.help_text
FROM home_template,
(VALUES
  ('Nazwa przedmiotu', 'text', true, NULL, NULL, '{"maxLength": 100}', 1, 'Podaj nazw przedmiotu'),
  ('Ilo[', 'number', true, '1', NULL, '{"min": 0}', 2, 'Ile sztuk posiadasz'),
  ('Lokalizacja', 'select', true, NULL, '["Salon", "Kuchnia", "Sypialnia", "Aazienka", "Piwnica", "Gara|", "Inne"]', NULL, 3, 'Gdzie znajduje si przedmiot'),
  ('Opis', 'textarea', false, NULL, NULL, '{"maxLength": 500}', 4, 'Opcjonalny opis przedmiotu'),
  ('Data zakupu', 'date', false, NULL, NULL, NULL, 5, 'Kiedy zostaB zakupiony')
) AS attr(name, type, is_required, default_value, options, validation_rules, display_order, help_text);

-- 2. Retail Products Template (SKU, price, category, supplier)
INSERT INTO templates (id, name, description, color, supported_contexts, organization_id, created_by)
VALUES (
  gen_random_uuid(),
  'Produkty sklepowe',
  'Szablon dla sklepów detalicznych z SKU, cenami, kategoriami i dostawcami',
  '#3b82f6',
  ARRAY['warehouse']::text[],
  NULL,
  NULL
);

WITH retail_template AS (
  SELECT id FROM templates WHERE name = 'Produkty sklepowe' AND organization_id IS NULL
)
INSERT INTO template_attributes (id, template_id, name, type, is_required, default_value, options, validation_rules, display_order, help_text)
SELECT
  gen_random_uuid(),
  retail_template.id,
  attr.name,
  attr.type,
  attr.is_required,
  attr.default_value,
  attr.options,
  attr.validation_rules,
  attr.display_order,
  attr.help_text
FROM retail_template,
(VALUES
  ('SKU', 'text', true, NULL, NULL, '{"maxLength": 50, "pattern": "^[A-Z0-9-]+$"}', 1, 'Unikalny kod produktu'),
  ('Nazwa produktu', 'text', true, NULL, NULL, '{"maxLength": 200}', 2, 'PeBna nazwa produktu'),
  ('Kategoria', 'select', true, NULL, '["Odzie|", "Elektronika", "Dom i Ogród", "Sport", "Ksi|ki", "Kosmetyki", "{ywno[", "Inne"]', NULL, 3, 'Kategoria produktu'),
  ('Cena zakupu', 'number', true, NULL, NULL, '{"min": 0, "step": 0.01}', 4, 'Cena zakupu netto'),
  ('Cena sprzeda|y', 'number', true, NULL, NULL, '{"min": 0, "step": 0.01}', 5, 'Cena sprzeda|y brutto'),
  ('Dostawca', 'text', false, NULL, NULL, '{"maxLength": 100}', 6, 'Nazwa dostawcy'),
  ('Kod kreskowy', 'text', false, NULL, NULL, '{"maxLength": 20}', 7, 'EAN/UPC kod kreskowy'),
  ('Minimalna ilo[', 'number', false, '5', NULL, '{"min": 0}', 8, 'Próg ostrze|enia o niskim stanie'),
  ('Opis', 'textarea', false, NULL, NULL, '{"maxLength": 1000}', 9, 'SzczegóBowy opis produktu')
) AS attr(name, type, is_required, default_value, options, validation_rules, display_order, help_text);

-- 3. Electronics Template (brand, model, warranty, specifications)
INSERT INTO templates (id, name, description, color, supported_contexts, organization_id, created_by)
VALUES (
  gen_random_uuid(),
  'Elektronika',
  'Szablon dla sprztu elektronicznego z mark, modelem, gwarancj i specyfikacjami',
  '#8b5cf6',
  ARRAY['warehouse']::text[],
  NULL,
  NULL
);

WITH electronics_template AS (
  SELECT id FROM templates WHERE name = 'Elektronika' AND organization_id IS NULL
)
INSERT INTO template_attributes (id, template_id, name, type, is_required, default_value, options, validation_rules, display_order, help_text)
SELECT
  gen_random_uuid(),
  electronics_template.id,
  attr.name,
  attr.type,
  attr.is_required,
  attr.default_value,
  attr.options,
  attr.validation_rules,
  attr.display_order,
  attr.help_text
FROM electronics_template,
(VALUES
  ('Marka', 'text', true, NULL, NULL, '{"maxLength": 50}', 1, 'Marka producenta'),
  ('Model', 'text', true, NULL, NULL, '{"maxLength": 100}', 2, 'Model urzdzenia'),
  ('Numer seryjny', 'text', false, NULL, NULL, '{"maxLength": 50}', 3, 'Unikalny numer seryjny'),
  ('Kategoria', 'select', true, NULL, '["Smartfon", "Laptop", "Tablet", "Telewizor", "Audio", "Gaming", "Akcesoria", "Inne"]', NULL, 4, 'Typ urzdzenia'),
  ('Data zakupu', 'date', false, NULL, NULL, NULL, 5, 'Data zakupu urzdzenia'),
  ('Okres gwarancji (miesice)', 'number', false, '24', NULL, '{"min": 0, "max": 120}', 6, 'DBugo[ gwarancji w miesicach'),
  ('Cena zakupu', 'number', false, NULL, NULL, '{"min": 0, "step": 0.01}', 7, 'Cena zakupu'),
  ('Stan', 'select', true, 'Nowy', '["Nowy", "U|ywany", "Odnowiony", "Uszkodzony", "Do naprawy"]', NULL, 8, 'Stan techniczny urzdzenia'),
  ('Specyfikacje', 'textarea', false, NULL, NULL, '{"maxLength": 2000}', 9, 'SzczegóBowe specyfikacje techniczne'),
  ('Uwagi', 'textarea', false, NULL, NULL, '{"maxLength": 500}', 10, 'Dodatkowe uwagi lub informacje')
) AS attr(name, type, is_required, default_value, options, validation_rules, display_order, help_text);

-- 4. Food & Beverages Template (expiry date, batch number, nutritional info)
INSERT INTO templates (id, name, description, color, supported_contexts, organization_id, created_by)
VALUES (
  gen_random_uuid(),
  '{ywno[ i napoje',
  'Szablon dla produktów spo|ywczych z datami wa|no[ci, numerami partii i informacjami |ywieniowymi',
  '#f59e0b',
  ARRAY['warehouse']::text[],
  NULL,
  NULL
);

WITH food_template AS (
  SELECT id FROM templates WHERE name = '{ywno[ i napoje' AND organization_id IS NULL
)
INSERT INTO template_attributes (id, template_id, name, type, is_required, default_value, options, validation_rules, display_order, help_text)
SELECT
  gen_random_uuid(),
  food_template.id,
  attr.name,
  attr.type,
  attr.is_required,
  attr.default_value,
  attr.options,
  attr.validation_rules,
  attr.display_order,
  attr.help_text
FROM food_template,
(VALUES
  ('Nazwa produktu', 'text', true, NULL, NULL, '{"maxLength": 200}', 1, 'Nazwa produktu spo|ywczego'),
  ('Kategoria', 'select', true, NULL, '["Miso i wdliny", "NabiaB", "Pieczywo", "Owoce i warzywa", "Napoje", "SBodycze", "Produkty suche", "Mro|onki", "Inne"]', NULL, 2, 'Kategoria produktu'),
  ('Data wa|no[ci', 'date', true, NULL, NULL, NULL, 3, 'Data upBywu wa|no[ci'),
  ('Numer partii', 'text', false, NULL, NULL, '{"maxLength": 50}', 4, 'Numer partii produkcyjnej'),
  ('Producent', 'text', true, NULL, NULL, '{"maxLength": 100}', 5, 'Nazwa producenta'),
  ('Waga/Objto[', 'text', false, NULL, NULL, '{"maxLength": 20}', 6, 'Waga lub objto[ opakowania'),
  ('Cena za jednostk', 'number', false, NULL, NULL, '{"min": 0, "step": 0.01}', 7, 'Cena za sztuk/kg/litr'),
  ('Warunki przechowywania', 'select', false, 'Temperatura pokojowa', '["Temperatura pokojowa", "ChBodnia (2-8°C)", "Mroznia (-18°C)", "Suche miejsce", "Miejsce ciemne"]', NULL, 8, 'Wymagane warunki przechowywania'),
  ('Alergeny', 'text', false, NULL, NULL, '{"maxLength": 200}', 9, 'Lista alergenów'),
  ('Warto[ci od|ywcze', 'textarea', false, NULL, NULL, '{"maxLength": 1000}', 10, 'Informacje o warto[ciach od|ywczych')
) AS attr(name, type, is_required, default_value, options, validation_rules, display_order, help_text);

-- 5. Manufacturing Parts Template (part number, material, dimensions, supplier)
INSERT INTO templates (id, name, description, color, supported_contexts, organization_id, created_by)
VALUES (
  gen_random_uuid(),
  'Cz[ci produkcyjne',
  'Szablon dla cz[ci produkcyjnych z numerami katalogowymi, materiaBami i wymiarami',
  '#ef4444',
  ARRAY['warehouse']::text[],
  NULL,
  NULL
);

WITH manufacturing_template AS (
  SELECT id FROM templates WHERE name = 'Cz[ci produkcyjne' AND organization_id IS NULL
)
INSERT INTO template_attributes (id, template_id, name, type, is_required, default_value, options, validation_rules, display_order, help_text)
SELECT
  gen_random_uuid(),
  manufacturing_template.id,
  attr.name,
  attr.type,
  attr.is_required,
  attr.default_value,
  attr.options,
  attr.validation_rules,
  attr.display_order,
  attr.help_text
FROM manufacturing_template,
(VALUES
  ('Numer cz[ci', 'text', true, NULL, NULL, '{"maxLength": 50}', 1, 'Unikalny numer katalogowy cz[ci'),
  ('Nazwa cz[ci', 'text', true, NULL, NULL, '{"maxLength": 200}', 2, 'Nazwa lub opis cz[ci'),
  ('Kategoria', 'select', true, NULL, '["Zruby i wkrty", "PodkBadki", "Nakrtki", "Ao|yska", "Uszczelki", "Elementy elektroniczne", "MateriaBy", "Narzdzia", "Inne"]', NULL, 3, 'Kategoria cz[ci'),
  ('MateriaB', 'text', false, NULL, NULL, '{"maxLength": 100}', 4, 'MateriaB z którego wykonano cz['),
  ('Wymiary', 'text', false, NULL, NULL, '{"maxLength": 100}', 5, 'Wymiary cz[ci (dBugo[ x szeroko[ x wysoko[)'),
  ('Waga (g)', 'number', false, NULL, NULL, '{"min": 0, "step": 0.1}', 6, 'Waga cz[ci w gramach'),
  ('Dostawca', 'text', false, NULL, NULL, '{"maxLength": 100}', 7, 'GBówny dostawca cz[ci'),
  ('Cena jednostkowa', 'number', false, NULL, NULL, '{"min": 0, "step": 0.01}', 8, 'Cena za sztuk'),
  ('Minimalne zamówienie', 'number', false, '1', NULL, '{"min": 1}', 9, 'Minimalna ilo[ zamówienia'),
  ('Czas dostawy (dni)', 'number', false, '7', NULL, '{"min": 0}', 10, 'Standardowy czas dostawy'),
  ('Specyfikacja techniczna', 'textarea', false, NULL, NULL, '{"maxLength": 2000}', 11, 'SzczegóBowa specyfikacja techniczna'),
  ('Uwagi', 'textarea', false, NULL, NULL, '{"maxLength": 500}', 12, 'Dodatkowe uwagi lub informacje')
) AS attr(name, type, is_required, default_value, options, validation_rules, display_order, help_text);