-- create_virtual_locations_trigger.sql

-- 1. Poprawiona funkcja bez parametrów
create or replace function create_virtual_locations_for_branch()
returns trigger as $$
declare
  org_id uuid;
  branch_id uuid := NEW.id;
begin
  -- Pobierz organization_id
  select organization_id into org_id from branches where id = branch_id;

  -- Wstaw domyślne lokalizacje jeśli ich nie ma
  insert into locations (id, organization_id, branch_id, name, code, level, sort_order, is_virtual)
  select
    gen_random_uuid(),
    org_id,
    branch_id,
    v.name,
    v.code,
    1 as level,
    v.sort_order,
    true as is_virtual
  from (
    values
      ('Przyjęcia zewnętrzne', 'RECEIVE_EXT', 1),
      ('Reklamacje', 'RECLAMATION', 2),
      ('Zablokowane', 'BLOCKED', 3)
  ) as v(name, code, sort_order)
  where not exists (
    select 1 from locations l
    where l.branch_id = branch_id
      and l.code = v.code
  );

  return NEW;
end;
$$ language plpgsql;

-- 2. Trigger (bez parametrów!)
drop trigger if exists trg_create_virtual_locations on branches;

create trigger trg_create_virtual_locations
after insert on branches
for each row
execute procedure create_virtual_locations_for_branch();
