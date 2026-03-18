-- insert_virtual_locations_for_all_branches.sql

-- Domyślne wirtualne lokalizacje do utworzenia dla każdego oddziału
with virtuals (name, code, sort_order) as (
  values
    ('Przyjęcia zewnętrzne', 'RECEIVE_EXT', 1),
    ('Reklamacje', 'RECLAMATION', 2),
    ('Zablokowane', 'BLOCKED', 3)
)

-- Wstaw tylko jeśli nie istnieje taka lokalizacja w danym oddziale
insert into locations (id, organization_id, branch_id, name, code, level, sort_order, is_virtual)
select
  gen_random_uuid(),
  b.organization_id,
  b.id as branch_id,
  v.name,
  v.code,
  1 as level,
  v.sort_order,
  true as is_virtual
from branches b
cross join virtuals v
where not exists (
  select 1 from locations l
  where l.branch_id = b.id
    and l.code = v.code
);
