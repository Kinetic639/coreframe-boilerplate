-- insert_virtual_locations.sql
insert into locations (id, organization_id, branch_id, name, code, level, sort_order, is_virtual)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Przyjęcia zewnętrzne', 'RECEIVE_EXT', 1, 1, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Reklamacje', 'RECLAMATION', 1, 2, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Zablokowane', 'BLOCKED', 1, 3, true);
