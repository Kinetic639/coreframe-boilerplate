-- Recreate movement_types
drop table if exists movement_types cascade;

create table movement_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  direction text not null check (direction in ('in', 'out', 'internal')),
  requires_confirmation boolean not null default false,
  system boolean not null default false,
  available_to_user boolean not null default true,
  created_at timestamp with time zone default now()
);

insert into movement_types (name, slug, direction, requires_confirmation, system, available_to_user) values
-- 🛒 Zakupy
('Przyjęcie z zewnątrz', 'purchase_in', 'in', false, false, true),
('Zwrot do dostawcy', 'purchase_return', 'out', false, false, true),

-- 🔁 Transfery
('Transfer wychodzący do oddziału', 'transfer_out', 'out', true, false, true),
('Transfer przychodzący z oddziału', 'transfer_in', 'in', true, false, false),
('Transfer wewnętrzny', 'transfer_internal', 'internal', false, false, true),

-- 🧾 Rezerwacje
('Rezerwacja produktu', 'reservation_out', 'out', false, false, true),
('Zwolnienie rezerwacji', 'reservation_release', 'in', false, false, true),

-- 📋 Korekty / Audyty
('Korekta dodatnia', 'adjustment_plus', 'in', false, false, true),
('Korekta ujemna', 'adjustment_minus', 'out', false, false, true),
('Ruch wynikający z audytu', 'inventory_audit', 'internal', false, true, false),

-- 🚫 Blokady
('Zablokowanie produktu', 'blocked_move', 'internal', false, false, true),
('Odblokowanie produktu', 'unblock_move', 'internal', false, false, true),

-- 🔁 Reklamacje
('Reklamacja do dostawcy', 'reclamation_out', 'out', false, false, true),
('Zwrot od klienta', 'reclamation_in', 'in', false, false, true),

-- 💥 Likwidacje
('Utylizacja produktu', 'scrap_out', 'out', false, false, true);
