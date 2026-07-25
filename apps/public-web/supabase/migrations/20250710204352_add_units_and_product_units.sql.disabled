-- 1. Globalne jednostki bazowe
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- np. "szt", "l", "kg"
  label TEXT NOT NULL,       -- pełna nazwa: "sztuka", "litr"
  category TEXT NOT NULL,    -- np. "ilość", "objętość", "masa", "długość", "powierzchnia"
  precision SMALLINT NOT NULL DEFAULT 2, -- ile miejsc po przecinku można używać
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Przykładowe jednostki bazowe (opcjonalnie)
INSERT INTO public.units (name, label, category, precision)
VALUES
  ('szt', 'sztuka', 'ilość', 0),
  ('l', 'litr', 'objętość', 2),
  ('kg', 'kilogram', 'masa', 3),
  ('m', 'metr', 'długość', 2),
  ('m2', 'metr kwadratowy', 'powierzchnia', 2);

-- 2. Jednostki produktu (opakowania, konwersje)
CREATE TABLE public.product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id),
  unit_name TEXT NOT NULL,              -- np. "karton 50", "puszka 5L"
  conversion_factor NUMERIC(12, 4) NOT NULL CHECK (conversion_factor > 0), -- np. 50.0000
  unit_type TEXT NOT NULL CHECK (unit_type IN ('base', 'packaging')), -- enum-like
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, unit_name)
);

-- Opcjonalny indeks pomocniczy
CREATE INDEX ON public.product_units (product_id, is_default DESC, sort_order);

-- 3. Dodanie FK do tabeli `products` dla jednostki bazowej
ALTER TABLE public.products
ADD COLUMN base_unit_id UUID REFERENCES public.units(id);