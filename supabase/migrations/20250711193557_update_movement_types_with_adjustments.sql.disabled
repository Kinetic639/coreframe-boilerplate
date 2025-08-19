-- Recreate movement_types
drop table if exists movement_types cascade;

create table movement_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  requires_confirmation boolean not null default false,
  created_at timestamptz default now()
);

-- Insert updated types
insert into movement_types (slug, name, description, requires_confirmation) values
  ('purchase_in', 'Przyjęcie z zewnątrz', 'Towar z zakupu lub zewnętrznej dostawy', false),
  ('transfer_in', 'Transfer przychodzący', 'Towar z innego oddziału', true),
  ('transfer_out', 'Transfer wychodzący', 'Towar do innego oddziału', true),
  ('adjustment_plus', 'Korekta dodatnia', 'Ręczne zwiększenie stanu magazynowego', false),
  ('adjustment_minus', 'Korekta ujemna', 'Ręczne zmniejszenie stanu magazynowego', false),
  ('reclamation_out', 'Reklamacja', 'Zwrot do dostawcy lub producenta', false),
  ('blocked_move', 'Przeniesienie do blokowanych', 'Towar wyłączony z obrotu', false);
