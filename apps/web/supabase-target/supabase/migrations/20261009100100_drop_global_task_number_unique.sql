-- Follow-up to 20261009050336_organization_counters: planning task numbers are per organization
-- now (unique on organization_id + task_number), so the global unique constraint on task_number
-- alone would reject the first PT-000001 of a second organization. The index belongs to the
-- constraint, so the constraint is dropped (nothing references task_number; the only foreign key
-- to planning_tasks uses its id). Run in the SQL Editor (the Supabase MCP refuses DROP).

ALTER TABLE public.planning_tasks DROP CONSTRAINT IF EXISTS planning_tasks_task_number_unique;
